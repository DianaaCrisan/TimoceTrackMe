import { PRINTED_ORDER_TAG } from "app/commons/constants";
import type { OrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";

const SEARCH_QUERY_BY_FILTER: Record<OrdersDashboardFilter, string | null> = {
  all: null,
  pending_fulfillment: "fulfillment_status:unfulfilled",
  // Ready to print, not printed yet: an order has a label to print once add
  // tracking has fulfilled it (fully or in part). Cancelled orders never get
  // a label, so they would sit here forever.
  unprinted:
    `tag_not:${PRINTED_ORDER_TAG} AND NOT status:cancelled AND ` +
    "(fulfillment_status:fulfilled OR fulfillment_status:partial)",
};

/**
 * The Shopify search query behind each dashboard tab. The table, the count and
 * "Select all in this filter" must all use it, or the user would select a
 * different set of orders than the one they see.
 */
export function buildOrdersSearchQuery(
  filter: OrdersDashboardFilter,
): string | null {
  return SEARCH_QUERY_BY_FILTER[filter];
}
