import { isPickupDeliveryMethod } from "app/commons/orders/isPickupDeliveryMethod";
import type { OrderToReview } from "app/commons/orders/TrackingReview";
import type { OrderTrackingSummary } from "app/commons/order-actions/OrderActions";
import type { TrackingInputFulfillmentOrder } from "../add-tracking/getOrdersTrackingInputData.server";
import type { OrderSnapshot } from "../shipping-labels/reconcileOrderLabels";

/** Fulfillments in these states carry nothing. */
const INACTIVE_FULFILLMENT_STATUSES = new Set([
  "CANCELLED",
  "ERROR",
  "FAILURE",
]);

/**
 * What add tracking would do for one order, for the order page's TrackMe
 * window. Pure: the caller reads the order from Shopify.
 *
 * - `shippable`: the fulfillment orders add tracking would ship (open,
 *   delivered by courier, with units left).
 * - `review`: the order's customer note and weight check, when it has any.
 */
export function summarizeOrderForTracking(args: {
  order: OrderSnapshot;
  fulfillmentOrders: TrackingInputFulfillmentOrder[];
  shippable: TrackingInputFulfillmentOrder[];
  zip: string | null;
  review: OrderToReview | null;
  parcelWeightLimitKg: number | null;
  isBusy: boolean;
}): OrderTrackingSummary {
  const unitsToShip = args.shippable
    .flatMap((fulfillmentOrder) => fulfillmentOrder.lineItems)
    .reduce((sum, lineItem) => sum + lineItem.remainingQuantity, 0);

  const existingAwbs = [
    ...new Set(
      args.order.fulfillments
        .filter(
          (fulfillment) =>
            !INACTIVE_FULFILLMENT_STATUSES.has(fulfillment.status),
        )
        .flatMap((fulfillment) =>
          fulfillment.tracking.map((tracking) => tracking.number),
        ),
    ),
  ];

  return {
    orderName: args.order.name,
    unitsToShip,
    isPickup:
      unitsToShip === 0 &&
      args.fulfillmentOrders.some((fulfillmentOrder) =>
        isPickupDeliveryMethod(fulfillmentOrder.deliveryMethod),
      ),
    isCancelled: args.order.isCancelled ?? false,
    zip: args.zip?.trim() || null,
    existingAwbs,
    note: args.review?.note ?? null,
    attributes: args.review?.attributes ?? [],
    weightKg: args.review?.weightKg ?? null,
    shipsOverWeightLimit: args.review?.shipsOverWeightLimit ?? false,
    parcelWeightLimitKg: args.parcelWeightLimitKg,
    isBusy: args.isBusy,
  };
}
