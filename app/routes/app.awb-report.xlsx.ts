import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { buildAwbReportWorkbook } from "app/backend/shipping-labels/buildAwbReportWorkbook";
import { ShippingLabelRepository } from "app/backend/shipping-labels/ShippingLabelRepository.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import {
  parseReportMonth,
  REPORT_MONTH_PARAM,
} from "app/commons/shipping-labels/AwbReport";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The AWB report of one month as an Excel download, in the user's language.
 * Answers JSON `{ error }` when it cannot make the file.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const locale = resolveLocale(formData.get(LOCALE_PARAM));
  const t = createTranslator(locale);

  const monthValue = formData.get(REPORT_MONTH_PARAM);
  const month = parseReportMonth(
    typeof monthValue === "string" ? monthValue : null,
  );
  if (!month) {
    return Response.json(
      { error: t("awbReport.invalidMonth") },
      { status: 400 },
    );
  }

  try {
    const workbook = await buildAwbReportWorkbook({
      month,
      rows: await ShippingLabelRepository.listIssuedIn(month),
      shopAdminUrl: ShopifyUtils.getShopAdminUrl(session.shop),
      generatedAt: new Date(),
      locale,
    });
    // ASCII only, like every exported file name
    const fileName = `${t("fileName.awbReport")}_${month}.xlsx`;

    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "AppError[AwbReport] could not create the Excel file.",
      error,
    );
    return Response.json(
      {
        error: t("awbReport.downloadFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500 },
    );
  }
};
