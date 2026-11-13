import type { OrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";

/**
 * The Shopify search query behind each dashboard tab. The table, the count and
 * "Select all in this filter" must all use it, or the user would select a
 * different set of orders than the one they see.
 */
export function buildOrdersSearchQuery(
  filter: OrdersDashboardFilter,
): string | null {
  return filter === "pending_fulfillment"
    ? "fulfillment_status:unfulfilled"
    : null;
}
