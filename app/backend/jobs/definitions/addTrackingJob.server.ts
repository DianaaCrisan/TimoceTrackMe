import { addTrackingNumbers } from "../../add-tracking/addTrackingNumbers.server";
import { SettingsRepository } from "../../settings/SettingsRepository.server";
import { buildOrderResultsWorkbook } from "../../reports/buildOrderResultsWorkbook";
import { completeOrderResultRows } from "../../reports/completeOrderResultRows.server";
import {
  countOrderResults,
  summarizeOrderResults,
  type OrderResultRow,
} from "../../reports/OrderResultRow";
import type { ZipChange } from "../../add-tracking/ZipRecovery.server";
import { createTranslator } from "app/commons/i18n/translate";
import { ZIP_TO_FIX_ORDER_TAG } from "app/commons/constants";
import {
  searchIndexChecks,
  waitForSearchIndex,
} from "../../orders/waitForSearchIndex.server";
import type { JobArtifact } from "../startBackgroundJob.server";
import type { OrdersJobContext } from "./OrdersJobContext";

export const ADD_TRACKING_JOB = {
  job: "add-tracking",
  title: "Add tracking numbers",
} as const;

export async function buildAddTrackingArtifact(
  ctx: OrdersJobContext,
): Promise<JobArtifact> {
  // read when the job runs, so a limit changed meanwhile applies
  const result = await addTrackingNumbers(ctx.admin, ctx.shopUrl, {
    orderIds: ctx.orderIds,
    manualZips: ctx.manualZips,
    parcelWeight: await SettingsRepository.getParcelWeight(),
    onOrderDone: ctx.progress?.orderDone,
  });

  const rowsById = new Map<string, OrderResultRow>();

  for (const order of result.successfulOrders) {
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: order.name,
      status: "succeeded",
      details: joinDetails(
        order.trackingNumbers.length > 1
          ? `${order.trackingNumbers.length} parcels, AWB ${order.trackingNumbers.join(", ")}`
          : `AWB ${order.trackingNumbers.join(", ")}`,
        describeZipChange(order.zipChange),
        ...(order.warnings ?? []),
      ),
    });
  }

  for (const order of result.failedOrders) {
    rowsById.set(order.id, {
      orderId: order.id,
      orderName: order.name,
      status: "failed",
      details: joinDetails(
        order.isZipProblem ? 'Fix the ZIP on the "ZIP to fix" tab.' : undefined,
        describeZipChange(order.zipChange),
      ),
      errors: order.errors,
    });
  }

  const zipProblemIds = result.failedOrders
    .filter((order) => order.isZipProblem)
    .map((order) => order.id);
  const zipToFixCount = zipProblemIds.length;

  // finish only once Shopify's search shows the change, so the dashboard's
  // reload already lists the orders in their new tabs
  ctx.progress?.verifying();
  await waitForSearchIndex(ctx.admin, [
    ...searchIndexChecks(
      "NOT fulfillment_status:unfulfilled",
      result.successfulOrders.map((order) => order.id),
    ),
    ...searchIndexChecks(`tag:${ZIP_TO_FIX_ORDER_TAG}`, zipProblemIds),
  ]);

  const t = createTranslator(ctx.locale);
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
    fileName: `${t("fileName.addTrackingResults")}.xlsx`,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hasErrors: countOrderResults(rows).failed > 0,
    summary: [
      summarizeOrderResults(rows, t),
      zipToFixCount > 0
        ? t("summary.zipToFix", { count: zipToFixCount })
        : null,
    ]
      .filter(Boolean)
      .join(", "),
    zipToFixCount,
  };
}

export function describeZipChange(
  zipChange: ZipChange | undefined,
): string | undefined {
  if (!zipChange) return undefined;

  if (zipChange.isEnteredByHand) {
    return `ZIP entered by hand: ${zipChange.previousZip ?? "(missing)"} → ${zipChange.newZip}`;
  }

  return `ZIP solved automatically: ${zipChange.previousZip ?? "(missing)"} → ${zipChange.newZip} (${zipChange.confidence} confidence)`;
}

function joinDetails(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("\n");
}
