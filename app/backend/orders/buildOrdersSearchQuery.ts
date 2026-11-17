import { PRINTED_ORDER_TAG, ZIP_TO_FIX_ORDER_TAG } from "app/commons/constants";
import type { OrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";

const SEARCH_QUERY_BY_FILTER: Record<OrdersDashboardFilter, string | null> = {
  all: null,
  pending_fulfillment: "fulfillment_status:unfulfilled",
  // Add tracking failed on the ZIP and there is still something to ship. An
  // order fulfilled or cancelled some other way drops out on its own.
  zip_to_fix:
    `tag:${ZIP_TO_FIX_ORDER_TAG} AND NOT status:cancelled AND ` +
    "(fulfillment_status:unfulfilled OR fulfillment_status:partial)",
  // Ready to print, not printed yet: a delivery order has a label to print
  // once add tracking has fulfilled it (fully or in part); a pickup order
  // has one from the start, since add tracking skips it. Cancelled orders
  // never get a label, so they would sit here forever.
  unprinted:
    `tag_not:${PRINTED_ORDER_TAG} AND NOT status:cancelled AND ` +
    "(fulfillment_status:fulfilled OR fulfillment_status:partial OR " +
    "delivery_method:pick-up)",
  // Still needs work (something to ship, or a label to print) and in no pack.
  not_in_pack:
    `tag_not:${PACKED_ORDER_TAG} AND NOT status:cancelled AND ` +
    "(fulfillment_status:unfulfilled OR fulfillment_status:partial OR " +
    `tag_not:${PRINTED_ORDER_TAG})`,
};

/**
 * The Shopify search query behind each dashboard tab. The table, the count and
 * "Select all in this filter" must all use it, or the user would select a
 * different set of orders than the one they see.
 *
 * With `packTag`, only that pack's orders: the pack's tag is ANDed on.
 */
export function buildOrdersSearchQuery(
  filter: OrdersDashboardFilter,
  packTag: string | null = null,
): string | null {
  const tabQuery = SEARCH_QUERY_BY_FILTER[filter];
  if (!packTag) return tabQuery;

  const packQuery = `tag:${packTag}`;
  return tabQuery ? `${packQuery} AND (${tabQuery})` : packQuery;
}

/**
 * A pack's finished orders: cancelled, or fulfilled with nothing left to do.
 * - delivery: fulfilled by add tracking, then its label printed
 * - pickup: fulfilled when marked as picked up. The app never fulfills a
 *   pickup order, so that is the moment it is done, label printed or not.
 */
export function buildPackDoneQuery(packTag: string): string {
  return (
    `tag:${packTag} AND (status:cancelled OR (fulfillment_status:fulfilled ` +
    `AND (tag:${PRINTED_ORDER_TAG} OR delivery_method:pick-up)))`
  );
}
