import type { Prisma } from "@prisma/client";
import prisma from "app/db.server";
import {
  isPackTagBatchKind,
  type PackTagBatchKind,
  type PackTagBatchView,
} from "app/commons/packs/PackTagBatchView";

type Db = Prisma.TransactionClient;

/** One order to bring in line; `staleTag`: the pack tag it just lost. */
export type TagChange = { orderId: string; staleTag?: string };

/** A queued order, as the worker reads it. */
export type PendingTagSync = {
  orderId: string;
  shop: string;
  staleTags: string[];
  version: number;
  batchId: string | null;
};

/** A batch whose orders are all tagged (or given up on), to finish. */
export type BatchToFinish = {
  id: string;
  shop: string;
  orderIds: string[];
};

/** Where a batch's tagged orders should now show up in Shopify search. */
export type SearchTargets = {
  /** Pack tag → its orders. */
  byPackTag: Map<string, string[]>;
  inNoPack: string[];
};

export type PackTagCounts = { pending: number; failed: number };

const LAST_ERROR_MAX_LENGTH = 1000;

/**
 * The queue of pack tag work, in the database. See `PackTagWorker` for who
 * drains it, and docs/background-work-visibility-plan.md for why.
 */
export const PackTagSyncRepository = {
  /**
   * Queues tag work. Call it in the transaction that changes the packs, so
   * the queue always matches the membership.
   *
   * An order already queued keeps one row: its stale tags add up, and it is
   * pending again from now, in the new batch. Returns the new batch's ID, or
   * null without `batch` or without changes.
   */
  async enqueue(
    tx: Db,
    {
      shop,
      changes,
      batch,
    }: {
      shop: string;
      changes: TagChange[];
      batch: { kind: PackTagBatchKind; packId: string | null } | null;
    },
  ): Promise<string | null> {
    if (changes.length === 0) return null;

    const orderIds = [...new Set(changes.map((change) => change.orderId))];
    // parallel arrays for unnest; '' stands for "no stale tag"
    const changeOrderIds = changes.map((change) => change.orderId);
    const changeStaleTags = changes.map((change) => change.staleTag ?? "");

    const batchId = batch
      ? (
          await tx.packTagBatch.create({
            data: {
              shop,
              kind: batch.kind,
              packId: batch.packId,
              orderIds,
              orderCount: orderIds.length,
            },
            select: { id: true },
          })
        ).id
      : null;

    await tx.$executeRaw`
      INSERT INTO "PackTagSync"
        ("orderId", "shop", "staleTags", "status", "attempts", "lastError",
         "version", "requestedAt", "batchId")
      SELECT
        c."orderId",
        ${shop}::TEXT,
        array_remove(array_agg(DISTINCT c."staleTag"), ''),
        'PENDING',
        0,
        NULL,
        1,
        CURRENT_TIMESTAMP,
        ${batchId}::TEXT
      FROM unnest(${changeOrderIds}::TEXT[], ${changeStaleTags}::TEXT[])
        AS c("orderId", "staleTag")
      -- one row per order: ON CONFLICT cannot touch the same row twice
      GROUP BY c."orderId"
      ON CONFLICT ("orderId") DO UPDATE SET
        "shop" = EXCLUDED."shop",
        "staleTags" = ARRAY(
          SELECT DISTINCT unnest("PackTagSync"."staleTags" || EXCLUDED."staleTags")
        ),
        "status" = 'PENDING',
        "attempts" = 0,
        "lastError" = NULL,
        "version" = "PackTagSync"."version" + 1,
        "requestedAt" = CURRENT_TIMESTAMP,
        "batchId" = EXCLUDED."batchId"
    `;

    return batchId;
  },

  /** The oldest pending orders. */
  async findPending(limit: number): Promise<PendingTagSync[]> {
    return prisma.packTagSync.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      take: limit,
      select: {
        orderId: true,
        shop: true,
        staleTags: true,
        version: true,
        batchId: true,
      },
    });
  },

  /** The order's pack now, with its tag; null when in no pack. */
  async findMembership(
    orderId: string,
  ): Promise<{ packId: string; packTag: string } | null> {
    const row = await prisma.fulfillmentPackOrder.findUnique({
      where: { orderId },
      select: { packId: true, pack: { select: { orderTag: true } } },
    });
    return row ? { packId: row.packId, packTag: row.pack.orderTag } : null;
  },

  /**
   * The order's tags are right. Its row goes, unless the order changed while
   * it was being tagged: then the row stays, for the worker's next round.
   */
  async markDone(sync: PendingTagSync, packId: string | null): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.packTagSync.deleteMany({
        where: { orderId: sync.orderId, version: sync.version },
      });
      if (count === 1 && packId) {
        await tx.fulfillmentPackOrder.updateMany({
          where: { orderId: sync.orderId, packId },
          data: { taggedAt: new Date() },
        });
      }
    });
  },

  /** Gave up on the order, for the pack's Retry button. */
  async markFailed(sync: PendingTagSync, error: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.packTagSync.updateMany({
        where: { orderId: sync.orderId, version: sync.version },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastError: error.slice(0, LAST_ERROR_MAX_LENGTH),
        },
      });
      if (count === 1 && sync.batchId) {
        await tx.packTagBatch.updateMany({
          where: { id: sync.batchId },
          data: { failedCount: { increment: 1 } },
        });
      }
    });
  },

  /** Unfinished batches with no order still pending. */
  async findBatchesToFinish(): Promise<BatchToFinish[]> {
    return prisma.packTagBatch.findMany({
      where: { finishedAt: null, syncs: { none: { status: "PENDING" } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, shop: true, orderIds: true },
    });
  },

  async markBatchTagged(batchId: string): Promise<void> {
    await prisma.packTagBatch.updateMany({
      where: { id: batchId, taggedAt: null },
      data: { taggedAt: new Date() },
    });
  },

  async markBatchFinished(batchId: string): Promise<void> {
    await prisma.packTagBatch.updateMany({
      where: { id: batchId, finishedAt: null },
      data: { finishedAt: new Date() },
    });
  },

  /**
   * Where these orders' tags now say they are. Orders still queued (pending
   * or failed) are left out: their tags are not right yet.
   */
  async findSearchTargets(orderIds: string[]): Promise<SearchTargets> {
    const [queued, memberships] = await Promise.all([
      prisma.packTagSync.findMany({
        where: { orderId: { in: orderIds } },
        select: { orderId: true },
      }),
      prisma.fulfillmentPackOrder.findMany({
        where: { orderId: { in: orderIds } },
        select: { orderId: true, pack: { select: { orderTag: true } } },
      }),
    ]);
    const queuedIds = new Set(queued.map((row) => row.orderId));
    const packTagByOrderId = new Map(
      memberships.map((row) => [row.orderId, row.pack.orderTag]),
    );

    const targets: SearchTargets = { byPackTag: new Map(), inNoPack: [] };
    for (const orderId of new Set(orderIds)) {
      if (queuedIds.has(orderId)) continue;

      const packTag = packTagByOrderId.get(orderId);
      if (!packTag) {
        targets.inNoPack.push(orderId);
        continue;
      }
      const ids = targets.byPackTag.get(packTag) ?? [];
      ids.push(orderId);
      targets.byPackTag.set(packTag, ids);
    }
    return targets;
  },

  /**
   * Batches still running, and those finished since `finishedSince`, newest
   * first: what the dashboard's progress shows.
   */
  async listRecentBatches(
    finishedSince: Date,
    limit = 20,
  ): Promise<PackTagBatchView[]> {
    const batches = await prisma.packTagBatch.findMany({
      where: {
        OR: [{ finishedAt: null }, { finishedAt: { gte: finishedSince } }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        packId: true,
        orderCount: true,
        failedCount: true,
        createdAt: true,
        taggedAt: true,
        finishedAt: true,
      },
    });
    if (batches.length === 0) return [];

    const packIds = [
      ...new Set(batches.flatMap((batch) => batch.packId ?? [])),
    ];
    const [pendingCounts, packs] = await Promise.all([
      prisma.packTagSync.groupBy({
        by: ["batchId"],
        where: {
          batchId: { in: batches.map((batch) => batch.id) },
          status: "PENDING",
        },
        _count: { _all: true },
      }),
      prisma.fulfillmentPack.findMany({
        where: { id: { in: packIds } },
        select: { id: true, day: true, daySequence: true },
      }),
    ]);
    const pendingByBatchId = new Map(
      pendingCounts.map((row) => [row.batchId, row._count._all]),
    );
    const packById = new Map(packs.map((pack) => [pack.id, pack]));

    return batches.map((batch) => {
      const pack = batch.packId ? packById.get(batch.packId) : undefined;
      const pendingCount = pendingByBatchId.get(batch.id) ?? 0;
      return {
        id: batch.id,
        kind: isPackTagBatchKind(batch.kind) ? batch.kind : "addOrders",
        pack: pack
          ? {
              id: pack.id,
              day: pack.day.toISOString().slice(0, 10),
              daySequence: pack.daySequence,
            }
          : null,
        orderCount: batch.orderCount,
        doneCount: Math.max(
          0,
          batch.orderCount - pendingCount - batch.failedCount,
        ),
        failedCount: batch.failedCount,
        createdAt: batch.createdAt.toISOString(),
        taggedAt: batch.taggedAt?.toISOString() ?? null,
        finishedAt: batch.finishedAt?.toISOString() ?? null,
      };
    });
  },

  /**
   * Orders among these whose tags are still being updated, with the pack
   * the database has them in now (null: leaving their pack).
   */
  async findPendingOrders(
    orderIds: string[],
  ): Promise<
    Map<string, { day: string; daySequence: number } | null>
  > {
    const pending = new Map<string, { day: string; daySequence: number } | null>();
    if (orderIds.length === 0) return pending;

    const syncs = await prisma.packTagSync.findMany({
      where: { orderId: { in: orderIds }, status: "PENDING" },
      select: { orderId: true },
    });
    if (syncs.length === 0) return pending;

    const memberships = await prisma.fulfillmentPackOrder.findMany({
      where: { orderId: { in: syncs.map((sync) => sync.orderId) } },
      select: {
        orderId: true,
        pack: { select: { day: true, daySequence: true } },
      },
    });
    const packByOrderId = new Map(
      memberships.map((row) => [
        row.orderId,
        {
          day: row.pack.day.toISOString().slice(0, 10),
          daySequence: row.pack.daySequence,
        },
      ]),
    );
    for (const sync of syncs) {
      pending.set(sync.orderId, packByOrderId.get(sync.orderId) ?? null);
    }
    return pending;
  },

  /** Finished batches are only kept for the progress shown right after. */
  async deleteBatchesFinishedBefore(date: Date): Promise<void> {
    await prisma.packTagBatch.deleteMany({
      where: { finishedAt: { lt: date } },
    });
  },

  /**
   * Queued orders per pack, by status. An order counts for the pack it is
   * in, and for any pack whose tag it still has to lose: both packs' tabs
   * still show it wrong.
   */
  async countByPack(
    db: Db,
    packIds: string[],
  ): Promise<Map<string, PackTagCounts>> {
    const counts = new Map<string, PackTagCounts>();
    if (packIds.length === 0) return counts;

    const rows = await db.$queryRaw<
      { packId: string; status: "PENDING" | "FAILED"; count: number }[]
    >`
      SELECT p."id" AS "packId", s."status"::TEXT AS "status",
             COUNT(*)::INT AS "count"
      FROM "PackTagSync" s
      LEFT JOIN "FulfillmentPackOrder" o ON o."orderId" = s."orderId"
      JOIN "FulfillmentPack" p
        ON p."id" = o."packId" OR p."orderTag" = ANY(s."staleTags")
      WHERE p."id" = ANY(${packIds}::TEXT[])
      GROUP BY p."id", s."status"
    `;

    for (const row of rows) {
      const entry = counts.get(row.packId) ?? { pending: 0, failed: 0 };
      if (row.status === "PENDING") entry.pending = row.count;
      else entry.failed = row.count;
      counts.set(row.packId, entry);
    }
    return counts;
  },

  /**
   * Queues a pack's orders whose tags are not right again: those that
   * failed, those that failed to leave it, and any never queued (an order
   * from before the queue existed). Orders already pending are left alone.
   */
  async requeueForPack(
    shop: string,
    pack: { id: string; orderTag: string },
  ): Promise<{ batchId: string | null; orderCount: number }> {
    return prisma.$transaction(async (tx) => {
      const [untagged, failedToLeave] = await Promise.all([
        tx.fulfillmentPackOrder.findMany({
          where: { packId: pack.id, taggedAt: null },
          select: { orderId: true },
        }),
        tx.packTagSync.findMany({
          where: { status: "FAILED", staleTags: { has: pack.orderTag } },
          select: { orderId: true },
        }),
      ]);
      const candidateIds = [
        ...new Set([...untagged, ...failedToLeave].map((row) => row.orderId)),
      ];
      const alreadyPending = new Set(
        (
          await tx.packTagSync.findMany({
            where: { orderId: { in: candidateIds }, status: "PENDING" },
            select: { orderId: true },
          })
        ).map((row) => row.orderId),
      );
      const orderIds = candidateIds.filter((id) => !alreadyPending.has(id));

      const batchId = await PackTagSyncRepository.enqueue(tx, {
        shop,
        changes: orderIds.map((orderId) => ({ orderId })),
        batch: { kind: "retry", packId: pack.id },
      });
      return { batchId, orderCount: orderIds.length };
    });
  },
};
