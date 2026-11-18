import type { Translate } from "app/commons/i18n/translate";
import type {
  FulfillmentPackView,
  PackProgress,
} from "app/commons/packs/FulfillmentPack";
import { RequestError } from "../core/errors/RequestError";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { orderJobLocks } from "../jobs/OrderJobLocks";
import {
  buildOrdersSearchQuery,
  buildPackDoneQuery,
} from "../orders/buildOrdersSearchQuery";
import { countOrdersMatching } from "../orders/getOrdersCount.server";
import { fetchOrderIdsMatching } from "../orders/resolveOrderSelection.server";
import {
  PackRepository,
  toPackView,
  type PackTarget,
} from "./PackRepository.server";
import { PackTagSyncRepository } from "./PackTagSyncRepository.server";
import { packTagWorker } from "./PackTagWorker.server";

/** Who is asking: tagging runs after the request, on the shop's own session. */
type ShopContext = { shop: string; shopUrl: string };

export type AddOrdersResult = {
  pack: FulfillmentPackView;
  addedCount: number;
  movedCount: number;
  alreadyInPackCount: number;
  inClosedPackCount: number;
  /** The tag work's batch, for its progress; null if nothing changed. */
  tagBatchId: string | null;
};

export type RemoveOrdersResult = {
  removedCount: number;
  notInPackCount: number;
  inClosedPackCount: number;
  tagBatchId: string | null;
};

export type ClosePackResult = {
  movedCount: number;
  movedTo: FulfillmentPackView | null;
  tagBatchId: string | null;
};

/**
 * Pack changes, kept in step with Shopify: the database changes first (it
 * decides which pack an order is in) and queues the tag work in the same
 * transaction; `packTagWorker` then updates the tags in the background.
 */
export class PackService {
  static async addOrders(
    context: ShopContext,
    orderIds: string[],
    target: PackTarget,
    t: Translate,
  ): Promise<AddOrdersResult> {
    const { plan, targetPack, tagBatchId } = await PackRepository.addOrders(
      orderIds,
      target,
      context,
      t,
    );
    packTagWorker.kick();

    return {
      pack: toPackView(targetPack),
      addedCount: plan.orderIdsToInsert.length,
      movedCount: plan.ordersToMove.length,
      alreadyInPackCount: plan.alreadyInTarget.length,
      inClosedPackCount: plan.inClosedPack.length,
      tagBatchId,
    };
  }

  /**
   * Puts a new order into the filling pack (starting one if none is
   * filling), then tags it in the background. Returns as soon as the
   * database has it: Shopify wants a webhook answered within seconds.
   */
  static async assignNewOrder(
    context: ShopContext,
    orderId: string,
  ): Promise<
    | { kind: "assigned"; pack: FulfillmentPackView; isNewPack: boolean }
    | { kind: "alreadyInPack" }
  > {
    const result = await PackRepository.assignNewOrder(orderId, context);
    if (result.kind === "alreadyInPack") return result;

    packTagWorker.kick();
    return {
      kind: "assigned",
      pack: toPackView(result.pack),
      isNewPack: result.isNewPack,
    };
  }

  static async removeOrders(
    context: ShopContext,
    orderIds: string[],
  ): Promise<RemoveOrdersResult> {
    const { plan, tagBatchId } = await PackRepository.removeOrders(
      orderIds,
      context,
    );
    packTagWorker.kick();

    return {
      removedCount: plan.ordersToRemove.length,
      notInPackCount: plan.notInPack.length,
      inClosedPackCount: plan.inClosedPack.length,
      tagBatchId,
    };
  }

  /**
   * Closes a locked pack. Orders not done yet refuse the close, unless
   * `moveLeftovers`: then they move to the filling pack first.
   *
   * Refused while a job is running on any of the pack's orders: the job may
   * be about to finish orders the close would count as left.
   */
  static async close(
    admin: AdminApiContextWithoutRest,
    context: ShopContext,
    packId: string,
    moveLeftovers: boolean,
    t: Translate,
  ): Promise<ClosePackResult> {
    const pack = await PackRepository.getOrThrow(packId, t);

    const busyOrderIds = orderJobLocks.findBusy(
      await PackRepository.getOrderIds(packId),
    );
    if (busyOrderIds.length > 0) {
      throw new RequestError(
        409,
        t("pack.error.ordersBusy", { count: busyOrderIds.length }),
      );
    }

    const doneOrderIds = await fetchOrderIdsMatching(
      admin,
      context.shopUrl,
      buildPackDoneQuery(pack.orderTag),
    );
    const { movedOrders, movedTo, tagBatchId } = await PackRepository.close(
      packId,
      { doneOrderIds, moveLeftovers },
      context,
      t,
    );
    if (tagBatchId) packTagWorker.kick();

    return {
      movedCount: movedOrders.length,
      movedTo: movedTo ? toPackView(movedTo) : null,
      tagBatchId,
    };
  }

  /**
   * Queues again the pack's orders whose tags are not right: failed ones,
   * and any never queued. Orders still pending are left to the worker.
   */
  static async retryTagging(
    context: ShopContext,
    packId: string,
    t: Translate,
  ): Promise<{ orderCount: number; tagBatchId: string | null }> {
    const pack = await PackRepository.getOrThrow(packId, t);
    const { batchId, orderCount } = await PackTagSyncRepository.requeueForPack(
      context.shop,
      pack,
    );
    if (batchId) packTagWorker.kick();

    return { orderCount, tagBatchId: batchId };
  }

  /** Total and done, counted on the pack's tag. A failed count is null. */
  static async getProgress(
    admin: AdminApiContextWithoutRest,
    pack: { orderTag: string },
  ): Promise<PackProgress> {
    const count = (query: string | null) =>
      countOrdersMatching(admin, query).catch((error) => {
        console.error(
          `AppError[PackProgress] could not count pack ${pack.orderTag}.`,
          error,
        );
        return null;
      });

    const [total, done] = await Promise.all([
      count(buildOrdersSearchQuery("all", pack.orderTag)),
      count(buildPackDoneQuery(pack.orderTag)),
    ]);
    return { total, done };
  }
}
