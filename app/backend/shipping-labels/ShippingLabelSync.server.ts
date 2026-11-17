import {
  shopMonthRange,
  type ReportMonth,
} from "app/commons/shipping-labels/AwbReport";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import {
  fetchOrderFulfillments,
  fetchOrdersFulfillments,
} from "./fetchOrderFulfillments.server";
import { ShippingLabelRepository } from "./ShippingLabelRepository.server";

/**
 * Keeps the AWB report in step with Shopify. See docs/awb-report-plan.md,
 * "Keeping it in step with Shopify".
 */
export class ShippingLabelSync {
  /**
   * Reads one order's fulfillments again and reconciles its AWBs. Used by the
   * fulfillments webhooks. Returns how many AWB rows changed.
   */
  static async syncOrder(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderId: string,
  ): Promise<number> {
    const order = await fetchOrderFulfillments(admin, shopUrl, orderId);
    if (!order) return 0;
    return ShippingLabelRepository.reconcileOrder(order, new Date());
  }

  /**
   * Reconciles every order that may hold an AWB issued in the month: created
   * before it ended and changed since it started. Catches missed webhooks,
   * and brings in AWBs from before the report existed.
   */
  static async syncMonth(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    month: ReportMonth,
  ): Promise<{ orderCount: number; changedCount: number }> {
    const { start, end } = shopMonthRange(month);
    let orderCount = 0;
    let changedCount = 0;

    for await (const orders of fetchOrdersFulfillments(admin, shopUrl, {
      updatedFrom: start,
      createdBefore: end,
    })) {
      for (const order of orders) {
        orderCount++;
        changedCount += await ShippingLabelRepository.reconcileOrder(
          order,
          new Date(),
        );
      }
    }

    await ShippingLabelRepository.setSyncedAt(month, new Date());
    return { orderCount, changedCount };
  }
}
