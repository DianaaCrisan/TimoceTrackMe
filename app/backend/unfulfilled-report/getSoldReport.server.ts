import type { UnfulfilledReport } from "app/commons/unfulfilled-report/UnfulfilledReport";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type { ReportPackScope } from "./buildUnfulfilledReport";
import { buildSoldReport } from "./buildSoldReport";
import { fetchSoldOrders } from "./fetchSoldOrders.server";

/**
 * The sold products report for one pack. Its orders come from the database,
 * so the report does not wait for Shopify search to see the pack's tag.
 */
export async function getSoldReport(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  { pack, orderIds }: ReportPackScope,
): Promise<UnfulfilledReport> {
  const orders = await fetchSoldOrders(admin, shopUrl, [...orderIds]);

  const truncated = orders.filter((order) => order.hasMoreItems);
  if (truncated.length > 0) {
    // not expected at a butcher's shop; logged rather than silently undercounted
    console.error(
      `AppError[SoldReport] ${truncated.map((o) => o.orderName).join(", ")} have more than 250 line items; only the first 250 are counted.`,
    );
  }

  return buildSoldReport(orders, pack, new Date());
}
