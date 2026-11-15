import JSZip from "jszip";
import { markLabelsPrinted } from "../../print-labels/markLabelsPrinted.server";
import { buildPrintLabels } from "../../print-labels/printLabels.server";
import { buildOrderResultsWorkbook } from "../../reports/buildOrderResultsWorkbook";
import { completeOrderResultRows } from "../../reports/completeOrderResultRows.server";
import {
  countOrderResults,
  type OrderResultRow,
} from "../../reports/OrderResultRow";
import { DEFAULT_LOCALE } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import type { JobArtifact } from "../startBackgroundJob.server";
import type { OrdersJobContext } from "./OrdersJobContext";

export const PRINT_LABELS_JOB = {
  job: "print-labels",
  title: "Print labels",
} as const;

/**
 * A zip with the shipping and pickup label PDFs and a per-order report, plus
 * `errors.txt` for problems that belong to no single order.
 *
 * Every order with a label in the PDF is marked as printed (fulfillment event
 * and tag) before the zip is built, so marking failures can go in the report.
 *
 * Fails the job only when there are errors and no PDF at all; a run where
 * every order is simply skipped still produces its report.
 *
 * The PDFs and every file name follow the language of whoever started it.
 */
export async function buildPrintLabelsArtifact(
  ctx: OrdersJobContext,
): Promise<JobArtifact> {
  const locale = ctx.locale ?? DEFAULT_LOCALE;
  const t = createTranslator(locale);
  const result = await buildPrintLabels(ctx.admin, ctx.shopUrl, {
    orderIds: ctx.orderIds,
    timeZone: ctx.timeZone,
    locale,
  });

  const orderErrors = [...result.errorsByOrderId.values()].flat();
  if (
    result.files.length === 0 &&
    (orderErrors.length > 0 || result.generalErrors.length > 0)
  ) {
    throw new Error(
      `No labels could be generated:\n${[...result.generalErrors, ...orderErrors].join("\n")}`,
    );
  }

  const { failuresByOrderId: markingFailuresByOrderId } =
    result.printedUnits.length > 0
      ? await markLabelsPrinted(ctx.admin, ctx.shopUrl, result.printedUnits)
      : { failuresByOrderId: new Map<string, string[]>() };

  const labelCountByOrderId = new Map<string, number>();
  for (const unit of result.printedUnits) {
    labelCountByOrderId.set(
      unit.orderId,
      (labelCountByOrderId.get(unit.orderId) ?? 0) + 1,
    );
  }

  const rowsById = new Map<string, OrderResultRow>();
  const reportedOrderIds = new Set([
    ...labelCountByOrderId.keys(),
    ...result.errorsByOrderId.keys(),
  ]);
  for (const orderId of reportedOrderIds) {
    const labelCount = labelCountByOrderId.get(orderId) ?? 0;
    const labelErrors = result.errorsByOrderId.get(orderId) ?? [];
    const markingFailures = markingFailuresByOrderId.get(orderId) ?? [];

    rowsById.set(orderId, {
      orderId,
      orderName: result.orderNamesById.get(orderId) ?? "-",
      // a missing label means a parcel without one, so the order needs a look
      status: labelErrors.length > 0 ? "failed" : "succeeded",
      details: describeLabels(labelCount, markingFailures.length === 0),
      errors: [...labelErrors, ...markingFailures],
    });
  }

  const rows = await completeOrderResultRows({
    admin: ctx.admin,
    shopUrl: ctx.shopUrl,
    orderIds: ctx.orderIds,
    rowsById,
    knownNamesById: result.orderNamesById,
    skippedDetails:
      "No label to print: no tracking number yet, or nothing left to pick up.",
  });

  const zip = new JSZip();
  for (const file of result.files) zip.file(file.fileName, file.buf);
  zip.file(
    `${t("fileName.printLabelsResults")}.xlsx`,
    await buildOrderResultsWorkbook({
      title: PRINT_LABELS_JOB.title,
      shopAdminUrl: ctx.shopUrl,
      rows,
      createdAt: ctx.startedAt,
    }),
  );
  const errorsFileName = `${t("fileName.errors")}.txt`;
  if (result.generalErrors.length > 0) {
    zip.file(errorsFileName, `${result.generalErrors.join("\n")}\n`);
  }

  const failedOrderCount = countOrderResults(rows).failed;
  const markingFailureCount = markingFailuresByOrderId.size;
  const summary = [
    t("summary.labels", {
      labels: result.printedUnits.length,
      count: labelCountByOrderId.size,
    }),
    failedOrderCount > 0
      ? t("summary.ordersFailed", { count: failedOrderCount })
      : null,
    markingFailureCount > 0
      ? t("summary.notMarkedPrinted", { count: markingFailureCount })
      : null,
    result.generalErrors.length > 0
      ? t("summary.seeErrorsFile", { fileName: errorsFileName })
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    buf: await zip.generateAsync({ type: "nodebuffer" }),
    fileName: `${t("fileName.labelsZip")}_${result.timestamp}.zip`,
    contentType: "application/zip",
    hasErrors:
      failedOrderCount > 0 ||
      markingFailureCount > 0 ||
      result.generalErrors.length > 0,
    summary,
  };
}

function describeLabels(labelCount: number, isMarkedPrinted: boolean): string {
  if (labelCount === 0) return "No label printed";

  const labels = `${labelCount} label${labelCount > 1 ? "s" : ""}`;
  return isMarkedPrinted ? `${labels}, marked as printed` : labels;
}
