import { isPickupDeliveryMethod } from "app/commons/orders/isPickupDeliveryMethod";
import { ALL_ORDERS_INTERVAL } from "app/commons/unfulfilled-report/OrderInterval";
import type {
  ReportPack,
  UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { SectionBuilder } from "./buildUnfulfilledReport";
import type { SoldOrder } from "./fetchSoldOrders.server";

/**
 * Everything a pack's orders sold, per product variant, separately for
 * delivery and pickup. Cancelled orders and removed items do not count.
 * Fulfilled or not makes no difference: it reads the same before and after
 * add tracking.
 */
export function buildSoldReport(
  orders: SoldOrder[],
  pack: ReportPack,
  generatedAt: Date,
): UnfulfilledReport {
  const delivery = new SectionBuilder();
  const pickup = new SectionBuilder();

  for (const order of orders) {
    if (order.isCancelled || order.items.length === 0) continue;

    const section = isPickupDeliveryMethod(order.methodType)
      ? pickup
      : delivery;
    section.add(order.orderName, order.items);
  }

  return {
    kind: "sold",
    interval: ALL_ORDERS_INTERVAL,
    pack,
    generatedAt: generatedAt.toISOString(),
    delivery: delivery.build(),
    pickup: pickup.build(),
  };
}
