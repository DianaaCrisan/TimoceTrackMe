import {
  COUNTED_ORDERS_DASHBOARD_FILTERS,
  type OrdersDashboardFilter,
} from "app/commons/orders/OrdersDashboardFilter";
import type { TabCounts } from "app/commons/orders/TabCounts";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getOrdersCount, type OrdersCount } from "./getOrdersCount.server";

type CountOrders = (
  admin: AdminApiContextWithoutRest,
  filter: OrdersDashboardFilter,
  packTag: string | null,
) => Promise<OrdersCount | null>;

type TabCountsInput = {
  /** The tabs the page shows; only the counted ones among them are counted. */
  filters: readonly OrdersDashboardFilter[];
  /** Counts only this pack's orders. */
  packTag?: string | null;
  countOrders?: CountOrders;
};

/**
 * How many orders each counted tab holds. One failed count leaves only that
 * tab without a number.
 */
export async function getTabCounts(
  admin: AdminApiContextWithoutRest,
  { filters, packTag = null, countOrders = getOrdersCount }: TabCountsInput,
): Promise<TabCounts> {
  const countedFilters = COUNTED_ORDERS_DASHBOARD_FILTERS.filter((filter) =>
    filters.includes(filter),
  );

  const entries = await Promise.all(
    countedFilters.map(async (filter) => {
      try {
        return [filter, await countOrders(admin, filter, packTag)] as const;
      } catch (error) {
        console.error(
          `AppError[TabCounts] could not count "${filter}".`,
          error,
        );
        return [filter, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as TabCounts;
}
