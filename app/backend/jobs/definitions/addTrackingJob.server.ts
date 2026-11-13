import { addTrackingNumbers } from "../../add-tracking/addTrackingNumbers.server";
import { buildOrderResultsWorkbook } from "../../reports/buildOrderResultsWorkbook";
import { completeOrderResultRows } from "../../reports/completeOrderResultRows.server";
import {
  countOrderResults,
  summarizeOrderResults,
  type OrderResultRow,
} from "../../reports/OrderResultRow";
import type { ZipChange } from "../../add-tracking/ZipRecovery.server";
import type { JobArtifact } from "../startBackgroundJob.server";
import type { OrdersJobContext } from "./OrdersJobContext";

export const ADD_TRACKING_JOB = {
  job: "add-tracking",
  title: "Add tracking numbers",
} as const;

export async function buildAddTrackingArtifact(
  ctx: OrdersJobContext,
): Promise<JobArtifact> {
  const result = await addTrackingNumbers(ctx.admin, ctx.shopUrl, {
    orderIds: ctx.orderIds,
  });

  const rowsById = new Map<string, OrderResultRow>();

  for (const order of result.successfulOrders) {
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: order.name,
      status: "succeeded",
      details: joinDetails(
        `AWB ${order.trackingNumbers.join(", ")}`,
        describeZipChange(order.zipChange),
      ),
    });
  }

  for (const order of result.failedOrders) {
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: order.name,
      status: "failed",
      details: describeZipChange(order.zipChange),
      errors: order.errors,
    });
  }

  const rows = await completeOrderResultRows({
    admin: ctx.admin,
    shopUrl: ctx.shopUrl,
    orderIds: ctx.orderIds,
    rowsById,
    skippedDetails:
      "Nothing left to ship: already fulfilled, pickup, cancelled or on hold.",
  });

  return {
    buf: await buildOrderResultsWorkbook({
      title: ADD_TRACKING_JOB.title,
      shopAdminUrl: ctx.shopUrl,
      rows,
      createdAt: ctx.startedAt,
    }),
    fileName: "add-tracking-results.xlsx",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hasErrors: countOrderResults(rows).failed > 0,
    summary: summarizeOrderResults(rows),
  };
}

export function describeZipChange(
  zipChange: ZipChange | undefined,
): string | undefined {
  if (!zipChange) return undefined;

  return `ZIP solved automatically: ${zipChange.previousZip ?? "(missing)"} → ${zipChange.newZip} (${zipChange.confidence} confidence)`;
}

function joinDetails(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("\n");
}
