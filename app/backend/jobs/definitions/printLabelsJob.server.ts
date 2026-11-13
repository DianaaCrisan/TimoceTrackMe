import JSZip from "jszip";
import { buildPrintLabels } from "../../print-labels/printLabels.server";
import { buildOrderResultsWorkbook } from "../../reports/buildOrderResultsWorkbook";
import { completeOrderResultRows } from "../../reports/completeOrderResultRows.server";
import type { OrderResultRow } from "../../reports/OrderResultRow";
import type { JobArtifact } from "../startBackgroundJob.server";
import type { OrdersJobContext } from "./OrdersJobContext";

export const PRINT_LABELS_JOB = {
  job: "print-labels",
  title: "Print labels",
} as const;

/**
 * A zip with the shipping and pickup label PDFs, a per-order report, and
 * `errors.txt` when some labels could not be made.
 *
 * Fails the job only when there are errors and no PDF at all; a run where
 * every order is simply skipped still produces its report.
 */
export async function buildPrintLabelsArtifact(
  ctx: OrdersJobContext,
): Promise<JobArtifact> {
  const result = await buildPrintLabels(ctx.admin, ctx.shopUrl, {
    orderIds: ctx.orderIds,
    timeZone: ctx.timeZone,
  });

  if (result.files.length === 0 && result.errors.length > 0) {
    throw new Error(
      `No labels could be generated:\n${result.errors.join("\n")}`,
    );
  }

  const labelCountByOrderId = new Map<string, number>();
  for (const unit of result.printedUnits) {
    labelCountByOrderId.set(
      unit.orderId,
      (labelCountByOrderId.get(unit.orderId) ?? 0) + 1,
    );
  }

  const rowsById = new Map<string, OrderResultRow>();
  for (const [orderId, labelCount] of labelCountByOrderId) {
    rowsById.set(orderId, {
      orderId,
      orderName: result.orderNamesById.get(orderId) ?? "-",
      status: "succeeded",
      details: `${labelCount} label${labelCount > 1 ? "s" : ""}`,
    });
  }

  const rows = await completeOrderResultRows({
    admin: ctx.admin,
    shopUrl: ctx.shopUrl,
    orderIds: ctx.orderIds,
    rowsById,
    knownNamesById: result.orderNamesById,
    skippedDetails:
      "No label to print: no tracking number yet, or nothing left to pick up. See errors.txt if a label failed.",
  });

  const zip = new JSZip();
  for (const file of result.files) zip.file(file.fileName, file.buf);
  zip.file(
    "print-labels-results.xlsx",
    await buildOrderResultsWorkbook({
      title: PRINT_LABELS_JOB.title,
      shopAdminUrl: ctx.shopUrl,
      rows,
      createdAt: ctx.startedAt,
    }),
  );
  if (result.errors.length > 0) {
    zip.file("errors.txt", `${result.errors.join("\n")}\n`);
  }

  const printedOrderCount = labelCountByOrderId.size;
  const summaryParts = [
    `${result.printedUnits.length} labels for ${printedOrderCount} orders`,
    result.errors.length > 0 ? `${result.errors.length} errors` : null,
  ].filter(Boolean);

  return {
    buf: await zip.generateAsync({ type: "nodebuffer" }),
    fileName: `labels_${result.timestamp}.zip`,
    contentType: "application/zip",
    hasErrors: result.errors.length > 0,
    summary: summaryParts.join(", "),
  };
}
