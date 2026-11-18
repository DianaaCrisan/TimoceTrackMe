import type { FulfillmentPack, Prisma } from "@prisma/client";
import prisma from "app/db.server";
import type { Translate } from "app/commons/i18n/translate";
import {
  buildPackTag,
  isFillingPack,
  toShopDay,
  type FulfillmentPackView,
} from "app/commons/packs/FulfillmentPack";
import {
  DEFAULT_PACK_MAX_ORDERS,
  getWaitingReason,
} from "app/commons/packs/PackSchedule";
import { RequestError } from "../core/errors/RequestError";
import { SETTINGS_SINGLETON_ID } from "../settings/SettingsRepository.server";
import { PackTagSyncRepository } from "./PackTagSyncRepository.server";
import {
  planAddToPack,
  planRemoveFromPack,
  type AddToPackPlan,
  type CurrentMembership,
  type OrderLeavingPack,
  type RemoveFromPackPlan,
} from "./planMembershipChange";

type Tx = Prisma.TransactionClient;

/** A pack with its tag. The tag never leaves the server: see `toPackView`. */
export type PackRecord = FulfillmentPackView & { orderTag: string };

/** The pack as sent to the browser. */
export function toPackView(record: PackRecord): FulfillmentPackView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { orderTag, ...view } = record;
  return view;
}

/** Where orders go: an existing pack, or the filling pack (made if missing). */
export type PackTarget = { kind: "pack"; packId: string } | { kind: "filling" };

/**
 * The shop whose orders change. The tag work for a change is queued in the
 * same transaction (see `PackTagSyncRepository`), for that shop's session.
 */
export type TagWorkShop = { shop: string };

const CLOSED_PACKS_SHOWN = 20;

const NEWEST_FIRST = [
  { day: "desc" },
  { daySequence: "desc" },
] satisfies Prisma.FulfillmentPackOrderByWithRelationInput[];

/**
 * Every change to packs or their orders runs in a transaction holding this
 * Postgres advisory lock, so they happen one at a time:
 * - two requests cannot both create "the" filling pack
 * - an order cannot be added to a pack while it is being locked or closed
 *
 * The key is an arbitrary number that only this code uses.
 */
async function withPacksLock<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724501)`;
    return work(tx);
  });
}

export class PackRepository {
  /** Packs not closed (filling first, then newest), then the latest closed. */
  static async list(): Promise<{
    workingPacks: PackRecord[];
    closedPacks: PackRecord[];
  }> {
    const [working, closed] = await Promise.all([
      prisma.fulfillmentPack.findMany({
        where: { status: { not: "CLOSED" } },
        orderBy: NEWEST_FIRST,
      }),
      prisma.fulfillmentPack.findMany({
        where: { status: "CLOSED" },
        orderBy: { closedAt: "desc" },
        take: CLOSED_PACKS_SHOWN,
      }),
    ]);

    const records = await toRecords([...working, ...closed]);
    // the filling pack first, then the rest newest first
    const workingPacks = records
      .slice(0, working.length)
      .sort((a, b) => Number(isFillingPack(b)) - Number(isFillingPack(a)));

    return { workingPacks, closedPacks: records.slice(working.length) };
  }

  static async get(packId: string): Promise<PackRecord | null> {
    const pack = await prisma.fulfillmentPack.findUnique({
      where: { id: packId },
    });
    if (!pack) return null;

    const [record] = await toRecords([pack]);
    return record;
  }

  /** Throws a 400 for a pack that does not exist. */
  static async getOrThrow(packId: string, t: Translate): Promise<PackRecord> {
    const pack = await this.get(packId);
    if (!pack) throw new RequestError(400, t("pack.error.notFound"));
    return pack;
  }

  /** A new, empty filling pack. Refused while another pack is filling. */
  static async createFillingPack(t: Translate): Promise<FulfillmentPack> {
    return withPacksLock(async (tx) => {
      const filling = await findFillingPack(tx);
      if (filling) {
        throw new RequestError(409, t("pack.error.alreadyFilling"));
      }
      return createPack(tx);
    });
  }

  /** "Start working": the pack stops taking new orders. */
  static async lock(packId: string, t: Translate): Promise<void> {
    await withPacksLock(async (tx) => {
      const pack = await getInTx(tx, packId, t);
      if (pack.status !== "OPEN") {
        throw new RequestError(409, t("pack.error.notFilling"));
      }
      const orderCount = await tx.fulfillmentPackOrder.count({
        where: { packId },
      });
      if (orderCount === 0) {
        throw new RequestError(409, t("pack.error.lockEmpty"));
      }
      await tx.fulfillmentPack.update({
        where: { id: packId },
        data: { status: "LOCKED", lockedAt: new Date() },
      });
    });
  }

  /**
   * Closes a locked pack. Its orders not in `doneOrderIds` move to the
   * filling pack first (made if missing); with `moveLeftovers` false, any
   * such order refuses the close instead.
   *
   * The leftovers are worked out inside the lock, so an order added while
   * the done orders were being looked up is not left behind.
   */
  static async close(
    packId: string,
    {
      doneOrderIds,
      moveLeftovers,
    }: { doneOrderIds: string[]; moveLeftovers: boolean },
    { shop }: TagWorkShop,
    t: Translate,
  ): Promise<{
    movedOrders: OrderLeavingPack[];
    movedTo: PackRecord | null;
    tagBatchId: string | null;
  }> {
    return withPacksLock(async (tx) => {
      const pack = await getInTx(tx, packId, t);
      if (pack.status !== "LOCKED") {
        throw new RequestError(409, t("pack.error.closeNotLocked"));
      }

      const done = new Set(doneOrderIds);
      const leftoverIds = (
        await tx.fulfillmentPackOrder.findMany({
          where: { packId },
          select: { orderId: true },
        })
      )
        .map((row) => row.orderId)
        .filter((orderId) => !done.has(orderId));

      if (leftoverIds.length > 0 && !moveLeftovers) {
        throw new RequestError(
          409,
          t("pack.error.ordersLeft", { count: leftoverIds.length }),
        );
      }

      const movedOrders = leftoverIds.map((orderId) => ({
        orderId,
        fromTag: pack.orderTag,
      }));
      let movedTo: FulfillmentPack | null = null;
      let tagBatchId: string | null = null;
      if (leftoverIds.length > 0) {
        movedTo = (await findFillingPack(tx)) ?? (await createPack(tx));
        await moveRows(tx, leftoverIds, movedTo);
        await markStarted(tx, movedTo);
        tagBatchId = await PackTagSyncRepository.enqueue(tx, {
          shop,
          changes: movedOrders.map(toTagChange),
          batch: { kind: "close", packId: movedTo.id },
        });
      }

      await tx.fulfillmentPack.update({
        where: { id: packId },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      return {
        movedOrders,
        movedTo: movedTo ? await toRecord(tx, movedTo) : null,
        tagBatchId,
      };
    });
  }

  /** Back to locked, for a pack closed by mistake. */
  static async reopen(packId: string, t: Translate): Promise<void> {
    await withPacksLock(async (tx) => {
      const pack = await getInTx(tx, packId, t);
      if (pack.status !== "CLOSED") {
        throw new RequestError(409, t("pack.error.notClosed"));
      }
      await tx.fulfillmentPack.update({
        where: { id: packId },
        data: { status: "LOCKED", closedAt: null },
      });
    });
  }

  /** Only an empty pack can be deleted. */
  static async delete(packId: string, t: Translate): Promise<void> {
    await withPacksLock(async (tx) => {
      await getInTx(tx, packId, t);
      const orderCount = await tx.fulfillmentPackOrder.count({
        where: { packId },
      });
      if (orderCount > 0) {
        throw new RequestError(409, t("pack.error.deleteNotEmpty"));
      }
      await tx.fulfillmentPack.delete({ where: { id: packId } });
    });
  }

  /**
   * Puts orders into a pack. Orders in another open or locked pack move;
   * orders in a closed pack stay there.
   */
  static async addOrders(
    orderIds: string[],
    target: PackTarget,
    { shop }: TagWorkShop,
    t: Translate,
  ): Promise<{
    plan: AddToPackPlan;
    targetPack: PackRecord;
    tagBatchId: string | null;
  }> {
    return withPacksLock(async (tx) => {
      const targetPack =
        target.kind === "pack"
          ? await getInTx(tx, target.packId, t)
          : ((await findFillingPack(tx)) ?? (await createPack(tx)));
      if (targetPack.status === "CLOSED") {
        throw new RequestError(409, t("pack.error.targetClosed"));
      }

      const plan = planAddToPack(
        orderIds,
        await findMemberships(tx, orderIds),
        targetPack.id,
      );

      await tx.fulfillmentPackOrder.createMany({
        data: plan.orderIdsToInsert.map((orderId) => ({
          orderId,
          packId: targetPack.id,
        })),
      });
      await moveRows(
        tx,
        plan.ordersToMove.map((order) => order.orderId),
        targetPack,
      );
      if (plan.orderIdsToInsert.length + plan.ordersToMove.length > 0) {
        await markStarted(tx, targetPack);
      }
      const tagBatchId = await PackTagSyncRepository.enqueue(tx, {
        shop,
        changes: [
          ...plan.orderIdsToInsert.map((orderId) => ({ orderId })),
          ...plan.ordersToMove.map(toTagChange),
        ],
        batch: { kind: "addOrders", packId: targetPack.id },
      });

      return {
        plan,
        targetPack: await toRecord(tx, targetPack),
        tagBatchId,
      };
    });
  }

  /**
   * A new order goes into the filling pack, which is created when none is
   * filling (after the last one was locked, or for the first order ever).
   *
   * An order already in a pack stays where it is: Shopify can deliver the
   * same webhook more than once, and the admin may have moved the order since.
   */
  static async assignNewOrder(
    orderId: string,
    { shop }: TagWorkShop,
  ): Promise<
    | { kind: "assigned"; pack: PackRecord; isNewPack: boolean }
    | { kind: "alreadyInPack" }
  > {
    return withPacksLock(async (tx) => {
      const existing = await tx.fulfillmentPackOrder.findUnique({
        where: { orderId },
      });
      if (existing) return { kind: "alreadyInPack" };

      const filling = await findFillingPack(tx);
      const pack = filling ?? (await createPack(tx));
      await tx.fulfillmentPackOrder.create({
        data: { orderId, packId: pack.id },
      });
      await markStarted(tx, pack);
      // no batch: a single new order has no progress to show
      await PackTagSyncRepository.enqueue(tx, {
        shop,
        changes: [{ orderId }],
        batch: null,
      });

      return {
        kind: "assigned",
        pack: await toRecord(tx, pack),
        isNewPack: !filling,
      };
    });
  }

  /** Takes orders out of their pack. Orders in a closed pack stay. */
  static async removeOrders(
    orderIds: string[],
    { shop }: TagWorkShop,
  ): Promise<{ plan: RemoveFromPackPlan; tagBatchId: string | null }> {
    return withPacksLock(async (tx) => {
      const plan = planRemoveFromPack(
        orderIds,
        await findMemberships(tx, orderIds),
      );
      await tx.fulfillmentPackOrder.deleteMany({
        where: {
          orderId: { in: plan.ordersToRemove.map((order) => order.orderId) },
        },
      });
      const tagBatchId = await PackTagSyncRepository.enqueue(tx, {
        shop,
        changes: plan.ordersToRemove.map(toTagChange),
        batch: { kind: "removeOrders", packId: null },
      });
      return { plan, tagBatchId };
    });
  }

  /**
   * The orders, from a Shopify search, that really belong where the search
   * found them: in `packId`, or in no pack when it is null. Orders whose
   * tags are still being updated are left out too: the search shows them
   * where they were.
   */
  static async filterSettledOrders(
    orderIds: string[],
    packId: string | null,
  ): Promise<string[]> {
    const [memberships, pending] = await Promise.all([
      prisma.fulfillmentPackOrder.findMany({
        where: { orderId: { in: orderIds } },
        select: { orderId: true, packId: true },
      }),
      prisma.packTagSync.findMany({
        where: { orderId: { in: orderIds }, status: "PENDING" },
        select: { orderId: true },
      }),
    ]);
    const packIdByOrderId = new Map(
      memberships.map((row) => [row.orderId, row.packId]),
    );
    const pendingIds = new Set(pending.map((row) => row.orderId));

    return orderIds.filter(
      (orderId) =>
        !pendingIds.has(orderId) &&
        (packIdByOrderId.get(orderId) ?? null) === packId,
    );
  }

  static async getOrderIds(packId: string): Promise<string[]> {
    const rows = await prisma.fulfillmentPackOrder.findMany({
      where: { packId },
      select: { orderId: true },
    });
    return rows.map((row) => row.orderId);
  }
}

/** An order leaving a pack: its old pack's tag has to come off. */
function toTagChange(order: OrderLeavingPack) {
  return { orderId: order.orderId, staleTag: order.fromTag };
}

/**
 * The pack taking new orders: the newest OPEN pack, unless it is waiting
 * (see `getWaitingReason`): full, or past a scheduled cut. Then the next
 * order starts a new pack.
 *
 * Counted inside the packs lock (every caller holds it), so two orders
 * arriving at the limit cannot both get in.
 *
 * An empty pack never waits: with no first order, nothing has been cut.
 */
async function findFillingPack(tx: Tx): Promise<FulfillmentPack | null> {
  const newestOpen = await tx.fulfillmentPack.findFirst({
    where: { status: "OPEN" },
    orderBy: NEWEST_FIRST,
  });
  if (!newestOpen) return null;

  const [rules, orderCount] = await Promise.all([
    readPackRules(tx),
    tx.fulfillmentPackOrder.count({ where: { packId: newestOpen.id } }),
  ]);
  return getWaitingReason(newestOpen, orderCount, rules, new Date())
    ? null
    : newestOpen;
}

type PackRules = { startWeekdays: number[]; packMaxOrders: number | null };

/** Read here, not through SettingsRepository, so it joins the transaction. */
async function readPackRules(db: Tx): Promise<PackRules> {
  const settings = await db.appSettings.findUnique({
    where: { id: SETTINGS_SINGLETON_ID },
    select: { packStartWeekdays: true, packMaxOrders: true },
  });
  return {
    startWeekdays: settings?.packStartWeekdays ?? [],
    packMaxOrders: settings?.packMaxOrders ?? DEFAULT_PACK_MAX_ORDERS,
  };
}

/**
 * Today's next pack: 14.11.2026/1, then /2… Safe because every caller holds
 * the packs lock.
 *
 * Prisma reads and writes a `@db.Date` as a JS Date at UTC midnight, so the
 * day is built that way, never from local-time getters.
 */
async function createPack(tx: Tx): Promise<FulfillmentPack> {
  const day = toShopDay(new Date());
  const dayAsDate = new Date(`${day}T00:00:00.000Z`);
  const { _max } = await tx.fulfillmentPack.aggregate({
    where: { day: dayAsDate },
    _max: { daySequence: true },
  });
  const daySequence = (_max.daySequence ?? 0) + 1;

  return tx.fulfillmentPack.create({
    data: {
      day: dayAsDate,
      daySequence,
      orderTag: buildPackTag(day, daySequence),
    },
  });
}

async function getInTx(
  tx: Tx,
  packId: string,
  t: Translate,
): Promise<FulfillmentPack> {
  const pack = await tx.fulfillmentPack.findUnique({ where: { id: packId } });
  if (!pack) throw new RequestError(400, t("pack.error.notFound"));
  return pack;
}

/** Moved orders need the new pack's tags, so they count as untagged again. */
async function moveRows(
  tx: Tx,
  orderIds: string[],
  target: FulfillmentPack,
): Promise<void> {
  if (orderIds.length === 0) return;
  await tx.fulfillmentPackOrder.updateMany({
    where: { orderId: { in: orderIds } },
    data: { packId: target.id, addedAt: new Date(), taggedAt: null },
  });
}

/** The first order in names the pack. */
async function markStarted(tx: Tx, pack: FulfillmentPack): Promise<void> {
  if (pack.startedAt) return;
  await tx.fulfillmentPack.update({
    where: { id: pack.id },
    data: { startedAt: new Date() },
  });
}

async function findMemberships(
  tx: Tx,
  orderIds: string[],
): Promise<CurrentMembership[]> {
  const rows = await tx.fulfillmentPackOrder.findMany({
    where: { orderId: { in: orderIds } },
    include: { pack: { select: { status: true, orderTag: true } } },
  });
  return rows.map((row) => ({
    orderId: row.orderId,
    packId: row.packId,
    packStatus: row.pack.status,
    packTag: row.pack.orderTag,
  }));
}

async function toRecord(tx: Tx, pack: FulfillmentPack): Promise<PackRecord> {
  const fresh = await tx.fulfillmentPack.findUniqueOrThrow({
    where: { id: pack.id },
  });
  const [record] = await toRecords([fresh], tx);
  return record;
}

async function toRecords(
  packs: FulfillmentPack[],
  db: Tx = prisma,
): Promise<PackRecord[]> {
  if (packs.length === 0) return [];

  const packIds = packs.map((pack) => pack.id);
  const now = new Date();
  const [orderCounts, tagCounts, rules] = await Promise.all([
    db.fulfillmentPackOrder.groupBy({
      by: ["packId"],
      where: { packId: { in: packIds } },
      _count: { _all: true },
    }),
    PackTagSyncRepository.countByPack(db, packIds),
    readPackRules(db),
  ]);
  const countFor = (
    counts: { packId: string; _count: { _all: number } }[],
    packId: string,
  ) => counts.find((row) => row.packId === packId)?._count._all ?? 0;

  return packs.map((pack) => {
    const orderCount = countFor(orderCounts, pack.id);
    const waitingReason = getWaitingReason(pack, orderCount, rules, now);
    return {
      id: pack.id,
      day: pack.day.toISOString().slice(0, 10),
      daySequence: pack.daySequence,
      status: pack.status,
      isWaiting: waitingReason !== null,
      waitingReason,
      startedAt: pack.startedAt?.toISOString() ?? null,
      lockedAt: pack.lockedAt?.toISOString() ?? null,
      closedAt: pack.closedAt?.toISOString() ?? null,
      orderCount,
      taggingCount: tagCounts.get(pack.id)?.pending ?? 0,
      tagFailedCount: tagCounts.get(pack.id)?.failed ?? 0,
      orderTag: pack.orderTag,
    };
  });
}
