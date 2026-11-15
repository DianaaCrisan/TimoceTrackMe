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
import { startPackTagging } from "./PackOrderTags.server";
import {
  PackRepository,
  toPackView,
  type PackTarget,
} from "./PackRepository.server";

/** Who is asking: tagging runs after the request, on the shop's own session. */
type ShopContext = { shop: string; shopUrl: string };

export type AddOrdersResult = {
  pack: FulfillmentPackView;
  addedCount: number;
  movedCount: number;
  alreadyInPackCount: number;
  inClosedPackCount: number;
};

export type RemoveOrdersResult = {
  removedCount: number;
  notInPackCount: number;
  inClosedPackCount: number;
};

export type ClosePackResult = {
  movedCount: number;
  movedTo: FulfillmentPackView | null;
};

/**
 * Pack changes, kept in step with Shopify: the database changes first (it
 * decides which pack an order is in), then the tags follow in the background.
 */
export class PackService {
  static async addOrders(
    context: ShopContext,
    orderIds: string[],
    target: PackTarget,
    t: Translate,
  ): Promise<AddOrdersResult> {
    const { plan, targetPack } = await PackRepository.addOrders(
      orderIds,
      target,
      t,
    );

    startPackTagging(context.shop, context.shopUrl, {
      targetPack,
      joining: plan.orderIdsToInsert,
      moving: plan.ordersToMove,
    });

    return {
      pack: toPackView(targetPack),
      addedCount: plan.orderIdsToInsert.length,
      movedCount: plan.ordersToMove.length,
      alreadyInPackCount: plan.alreadyInTarget.length,
      inClosedPackCount: plan.inClosedPack.length,
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
    const result = await PackRepository.assignNewOrder(orderId);
    if (result.kind === "alreadyInPack") return result;

    startPackTagging(context.shop, context.shopUrl, {
      targetPack: result.pack,
      joining: [orderId],
    });
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
    const plan = await PackRepository.removeOrders(orderIds);

    startPackTagging(context.shop, context.shopUrl, {
      leaving: plan.ordersToRemove,
    });

    return {
      removedCount: plan.ordersToRemove.length,
      notInPackCount: plan.notInPack.length,
      inClosedPackCount: plan.inClosedPack.length,
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
    const { movedOrders, movedTo } = await PackRepository.close(
      packId,
      { doneOrderIds, moveLeftovers },
      t,
    );

    if (movedTo) {
      startPackTagging(context.shop, context.shopUrl, {
        targetPack: movedTo,
        moving: movedOrders,
      });
    }

    return {
      movedCount: movedOrders.length,
      movedTo: movedTo ? toPackView(movedTo) : null,
    };
  }

  /** Tags the pack's orders whose tags are missing. */
  static async retryTagging(
    context: ShopContext,
    packId: string,
    t: Translate,
  ): Promise<{ orderCount: number }> {
    const pack = await PackRepository.getOrThrow(packId, t);
    const orderIds = await PackRepository.getUntaggedOrderIds(packId);

    if (orderIds.length > 0) {
      startPackTagging(context.shop, context.shopUrl, {
        targetPack: pack,
        joining: orderIds,
      });
    }
    return { orderCount: orderIds.length };
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

