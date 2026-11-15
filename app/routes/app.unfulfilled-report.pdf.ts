import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { buildOrderRangesFileName } from "app/backend/exports/buildOrderRangesFileName";
import { formatFileTimestamp } from "app/backend/exports/formatFileTimestamp";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { reportCache } from "app/backend/unfulfilled-report/ReportCache";
import { generateUnfulfilledReportPDF } from "app/backend/unfulfilled-report/generateUnfulfilledReportPDF";
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
  RESULT_ID_PARAM,
  type UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { RequestError } from "app/backend/core/errors/RequestError";

const TIME_ZONE_PARAM = "timeZone";

/**
 * The report as a PDF download, in the user's language.
 *
 * Prints the report the page shows (by `resultId`) while it is kept;
 * after that, or after a restart, it reads the orders again for the same
 * interval or pack. Answers JSON `{ error }` when it cannot make the PDF.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const locale = resolveLocale(formData.get(LOCALE_PARAM));
  const t = createTranslator(locale);
  const timeZone = readString(formData, TIME_ZONE_PARAM);

  try {
    let report: UnfulfilledReport | null = reportCache.get(
      session.shop,
      readString(formData, RESULT_ID_PARAM) ?? "",
    );

    if (!report) {
      const parsed = parseOrderInterval(
        readString(formData, ORDER_INTERVAL_PARAMS.from),
        readString(formData, ORDER_INTERVAL_PARAMS.to),
      );
      if (!parsed.ok) {
        return Response.json({ error: t(parsed.error) }, { status: 400 });
      }

      report = await loadReport({
        admin,
        shopUrl: ShopifyUtils.getShopAdminUrl(session.shop),
        kind: parseReportKind(readString(formData, REPORT_KIND_PARAM)),
        interval: parsed.interval,
        packId: readString(formData, REPORT_PACK_PARAM),
        t,
      });
    }

    const pdf = await generateUnfulfilledReportPDF(report, {
      locale,
      timeZone,
    });
    const fileName = buildOrderRangesFileName({
      baseName: t(
        report.kind === "sold"
          ? "fileName.soldReport"
          : "fileName.unfulfilledReport",
      ),
      orderNames: [...report.delivery.orderNames, ...report.pickup.orderNames],
      timestamp: formatFileTimestamp(
        new Date(report.generatedAt),
        timeZone,
        locale,
      ),
      extension: "pdf",
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // the name is ASCII only (see buildOrderRangesFileName)
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "AppError[UnfulfilledReport] could not create the PDF.",
      error,
    );
    return Response.json(
      {
        error: t("report.pdfFailed", {
          error: describeReportError(error, t),
        }),
      },
      { status: 500 },
    );
  }
};

function readString(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}
