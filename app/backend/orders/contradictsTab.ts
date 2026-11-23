import { PRINTED_ORDER_TAG, ZIP_TO_FIX_ORDER_TAG } from "app/commons/constants";
import type { OrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";

/** What an order says about itself now, as read with the dashboard list. */
export type OrderFacts = {
  tags: readonly string[];
  displayFulfillmentStatus: string;
  cancelledAt?: string | null;
};

/** Fulfilled by add tracking, in full or in part: it has left "unfulfilled". */
const SHIPPED_STATUSES = new Set(["FULFILLED", "PARTIALLY_FULFILLED"]);

/**
 * Whether an order listed in a tab no longer belongs there.
 *
 * Shopify picks a tab's orders through its search index, which lags behind
 * changes, but the fields read for each order are current. An order whose own
 * fields rule out the tab is shown there only because the index is behind:
 * the dashboard greys it out until a reload drops it.
 *
 * Only says yes when sure: anything the fields cannot settle counts as
 * belonging, so a row is never greyed out by mistake.
 */
export function contradictsTab(
  order: OrderFacts,
  filter: OrdersDashboardFilter,
  packTag: string | null,
): boolean {
  const hasTag = (tag: string) => order.tags.includes(tag);
  const isCancelled = order.cancelledAt != null;

  if (packTag && !hasTag(packTag)) return true;

  switch (filter) {
    case "all":
      return false;
    case "pending_fulfillment":
      return (
        SHIPPED_STATUSES.has(order.displayFulfillmentStatus) || isCancelled
      );
    case "zip_to_fix":
      return (
        !hasTag(ZIP_TO_FIX_ORDER_TAG) ||
        isCancelled ||
        order.displayFulfillmentStatus === "FULFILLED"
      );
    case "on_hold":
      // the search matches this very status: anything else has been released
      return order.displayFulfillmentStatus !== "ON_HOLD" || isCancelled;
    case "unprinted":
      return hasTag(PRINTED_ORDER_TAG) || isCancelled;
    case "not_in_pack":
      return (
        hasTag(PACKED_ORDER_TAG) ||
        isCancelled ||
        // nothing left to do: shipped and its label printed
        (order.displayFulfillmentStatus === "FULFILLED" &&
          hasTag(PRINTED_ORDER_TAG))
      );
  }
}
