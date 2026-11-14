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
) => Promise<OrdersCount | null>;

/**
 * How many orders each counted tab holds. One failed count leaves only that
 * tab without a number.
 */
export async function getTabCounts(
  admin: AdminApiContextWithoutRest,
  countOrders: CountOrders = getOrdersCount,
): Promise<TabCounts> {
  const entries = await Promise.all(
    COUNTED_ORDERS_DASHBOARD_FILTERS.map(async (filter) => {
      try {
        return [filter, await countOrders(admin, filter)] as const;
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
