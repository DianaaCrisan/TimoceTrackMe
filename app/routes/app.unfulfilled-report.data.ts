import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { reportCache } from "app/backend/unfulfilled-report/ReportCache";
import { describeReportError } from "app/backend/unfulfilled-report/getUnfulfilledReport.server";
import { loadReport } from "app/backend/unfulfilled-report/loadReport.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import {
  ORDER_INTERVAL_PARAMS,
  parseOrderInterval,
} from "app/commons/unfulfilled-report/OrderInterval";
import {
  parseReportKind,
  REPORT_KIND_PARAM,
  REPORT_PACK_PARAM,
  type UnfulfilledReportResponse,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { RequestError } from "app/backend/core/errors/RequestError";

/**
 * Loaded by the report page after it renders: reading every open
 * fulfillment order can take a while with many orders, and the page shows a
 * spinner meanwhile instead of a blank screen.
 *
 * With `?packId=`, only that pack's orders, whatever their numbers. With
 * `?kind=sold`, the pack's sold products instead of what is left.
 */
export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<UnfulfilledReportResponse> => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const t = createTranslator(resolveLocale(url.searchParams.get(LOCALE_PARAM)));

  const parsed = parseOrderInterval(
    url.searchParams.get(ORDER_INTERVAL_PARAMS.from),
    url.searchParams.get(ORDER_INTERVAL_PARAMS.to),
  );
  if (!parsed.ok) return { ok: false, error: t(parsed.error) };

  try {
    const report = await loadReport({
      admin,
      shopUrl: ShopifyUtils.getShopAdminUrl(session.shop),
      kind: parseReportKind(url.searchParams.get(REPORT_KIND_PARAM)),
      interval: parsed.interval,
      packId: url.searchParams.get(REPORT_PACK_PARAM),
      t,
    });

    return {
      ok: true,
      resultId: reportCache.store(session.shop, report),
      report,
    };
  } catch (error) {
    if (error instanceof RequestError) {
      return { ok: false, error: error.message };
    }
    console.error(
      "AppError[UnfulfilledReport] could not load the report.",
      error,
    );
    return {
      ok: false,
      error: t("report.loadFailed", {
        error: describeReportError(error, t),
      }),
    };
  }
};
