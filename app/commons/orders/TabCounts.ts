import type { OrdersCount } from "./OrdersCount";
import type { COUNTED_ORDERS_DASHBOARD_FILTERS } from "./OrdersDashboardFilter";

export type CountedOrdersDashboardFilter =
  (typeof COUNTED_ORDERS_DASHBOARD_FILTERS)[number];

/**
 * Null for a tab whose count could not be loaded. A tab the scope does not
 * show (e.g. "Not in a pack" inside a pack) is left out.
 */
export type TabCounts = Partial<
  Record<CountedOrdersDashboardFilter, OrdersCount | null>
>;

/** "12", or "10000+" once Shopify stops counting. */
export function formatTabCount(count: OrdersCount): string {
  return `${count.count}${count.isAtLeast ? "+" : ""}`;
}
