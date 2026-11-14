import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { buildOrderRangesFileName } from "app/backend/exports/buildOrderRangesFileName";
import { formatFileTimestamp } from "app/backend/exports/formatFileTimestamp";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { reportCache } from "app/backend/unfulfilled-report/ReportCache";
import { generateUnfulfilledReportPDF } from "app/backend/unfulfilled-report/generateUnfulfilledReportPDF";
import {
  describeReportError,
  getUnfulfilledReport,
} from "app/backend/unfulfilled-report/getUnfulfilledReport.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import {
  ORDER_INTERVAL_PARAMS,
  parseOrderInterval,
} from "app/commons/unfulfilled-report/OrderInterval";
import {
  RESULT_ID_PARAM,
  type UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";

const TIME_ZONE_PARAM = "timeZone";

/**
 * The report as a PDF download, in the user's language.
 *
 * Prints the report the page shows (by `resultId`) while it is kept;
 * after that, or after a restart, it reads the orders again for the same
 * interval. Answers JSON `{ error }` when it cannot make the PDF.
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

      report = await getUnfulfilledReport(
        admin,
        ShopifyUtils.getShopAdminUrl(session.shop),
        parsed.interval,
      );
    }

    const pdf = await generateUnfulfilledReportPDF(report, {
      locale,
      timeZone,
    });
    const fileName = buildOrderRangesFileName({
      baseName: t("fileName.unfulfilledReport"),
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
