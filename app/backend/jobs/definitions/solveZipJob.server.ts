import { buildOrderResultsWorkbook } from "../../reports/buildOrderResultsWorkbook";
import { completeOrderResultRows } from "../../reports/completeOrderResultRows.server";
import {
  countOrderResults,
  summarizeOrderResults,
  type OrderResultRow,
} from "../../reports/OrderResultRow";
import { SolveZipService } from "../../zip-solver/SolveZipService";
import { createTranslator } from "app/commons/i18n/translate";
import type { JobArtifact } from "../startBackgroundJob.server";
import type { OrdersJobContext } from "./OrdersJobContext";

export const SOLVE_ZIP_JOB = {
  job: "solve-zip",
  title: "Solve ZIP codes",
} as const;

export async function buildSolveZipArtifact(
  ctx: OrdersJobContext,
): Promise<JobArtifact> {
  const result = await SolveZipService.solveMissingZipCodesWithOrderIds(
    ctx.admin,
    ctx.shopUrl,
    ctx.orderIds,
  );

  const rowsById = new Map<string, OrderResultRow>();

  for (const order of result.processedOrdersSolvedZip) {
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: order.name,
      status: "succeeded",
      details: `ZIP set to ${order.zipCode} (${order.confidenceLevel} confidence)`,
    });
  }

  for (const order of result.processedOrdersUnsolvedZip) {
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: order.name,
      status: "failed",
      details: [order.address1, order.city, order.provinceCode]
        .filter(Boolean)
        .join(", "),
      errors: [
        order.error ??
          `No confident ZIP suggestion (confidence: ${order.confidenceLevel ?? "unknown"}).`,
      ],
    });
  }

  // Also covers orders whose ZIP was found but could not be saved, so these
  // override a "succeeded" row.
  for (const order of result.unsupportedOrders) {
    const existing = rowsById.get(order.id);
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: existing?.orderName ?? order.name,
      status: "failed",
      details: existing?.details,
      errors: [...(existing?.errors ?? []), ...order.errorStack],
    });
  }

  const rows = await completeOrderResultRows({
    admin: ctx.admin,
    shopUrl: ctx.shopUrl,
    orderIds: ctx.orderIds,
    rowsById,
    skippedDetails: "Already has a ZIP code, or is a pickup order.",
  });

  return {
    buf: await buildOrderResultsWorkbook({
      title: SOLVE_ZIP_JOB.title,
      shopAdminUrl: ctx.shopUrl,
      rows,
      createdAt: ctx.startedAt,
    }),
    fileName: "solve-zip-results.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hasErrors: countOrderResults(rows).failed > 0,
    summary: summarizeOrderResults(rows, createTranslator(ctx.locale)),
  };
}
