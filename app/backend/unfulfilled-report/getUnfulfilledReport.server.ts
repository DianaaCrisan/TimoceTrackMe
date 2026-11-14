import type { Translate } from "app/commons/i18n/translate";
import type { OrderInterval } from "app/commons/unfulfilled-report/OrderInterval";
import type { UnfulfilledReport } from "app/commons/unfulfilled-report/UnfulfilledReport";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { BulkQueryError } from "../graphql/bulk/runBulkQuery.server";
import { buildUnfulfilledReport } from "./buildUnfulfilledReport";
import {
  fetchOpenFulfillmentOrders,
  type OpenFulfillmentOrder,
} from "./fetchOpenFulfillmentOrders.server";

/**
 * One read of the open fulfillment orders per shop at a time: requests that
 * arrive while it runs (another user, a second tab, a quick "Refresh") share
 * it. The interval is applied afterwards, so they can all share one read.
 */
const inFlightByShop = new Map<string, Promise<OpenFulfillmentOrder[]>>();

export async function getUnfulfilledReport(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  interval: OrderInterval,
): Promise<UnfulfilledReport> {
  let pending = inFlightByShop.get(shopUrl);
  if (!pending) {
    pending = fetchOpenFulfillmentOrders(admin, shopUrl).finally(() =>
      inFlightByShop.delete(shopUrl),
    );
    inFlightByShop.set(shopUrl, pending);
  }

  return buildUnfulfilledReport(await pending, interval, new Date());
}

/** A message for the user, in their language where the cause is known. */
export function describeReportError(error: unknown, t: Translate): string {
  if (error instanceof BulkQueryError) {
    if (error.reason === "busy") return t("report.bulkBusy");
    if (error.reason === "timeout") return t("report.timedOut");
    if (error.reason === "notEnabled") return t("report.bulkNotEnabled");
  }
  return error instanceof Error ? error.message : String(error);
}
