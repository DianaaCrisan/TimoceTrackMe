import type { Translate } from "app/commons/i18n/translate";
import type { OrderInterval } from "app/commons/unfulfilled-report/OrderInterval";
import type {
  ReportKind,
  UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { RequestError } from "../core/errors/RequestError";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getSoldReport } from "./getSoldReport.server";
import { getUnfulfilledReport } from "./getUnfulfilledReport.server";
import { loadReportPackScope } from "./loadReportPackScope.server";

type LoadReportInput = {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  kind: ReportKind;
  interval: OrderInterval;
  packId: string | null;
  t: Translate;
};

/**
 * The report the page and the PDF ask for:
 * - unfulfilled: for an interval of order numbers, or one pack
 * - sold: always for one pack
 */
export async function loadReport({
  admin,
  shopUrl,
  kind,
  interval,
  packId,
  t,
}: LoadReportInput): Promise<UnfulfilledReport> {
  const packScope = packId ? await loadReportPackScope(packId, t) : null;

  if (kind === "sold") {
    if (!packScope) throw new RequestError(400, t("report.soldNeedsPack"));
    return getSoldReport(admin, shopUrl, packScope);
  }
  return getUnfulfilledReport(admin, shopUrl, interval, packScope);
}
