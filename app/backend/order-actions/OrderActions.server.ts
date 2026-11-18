import type { Locale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import type {
  OrderAddTrackingResponse,
  OrderTrackingSummary,
} from "app/commons/order-actions/OrderActions";
import {
  addTrackingNumbers,
  getEligibleShippingFulfillmentOrders,
} from "../add-tracking/addTrackingNumbers.server";
import { getOrdersTrackingInputDataInBatches } from "../add-tracking/getOrdersTrackingInputData.server";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { orderJobLocks } from "../jobs/OrderJobLocks";
import { getOrdersToReview } from "../orders/getOrdersToReview.server";
import { markLabelsPrinted } from "../print-labels/markLabelsPrinted.server";
import { buildPrintLabels } from "../print-labels/printLabels.server";
import { appendPDFToDocument } from "../print-labels/utils/appendPDFToDocument";
import { SettingsRepository } from "../settings/SettingsRepository.server";
import { fetchOrderFulfillments } from "../shipping-labels/fetchOrderFulfillments.server";
import { ShippingLabelRepository } from "../shipping-labels/ShippingLabelRepository.server";
import { summarizeOrderForTracking } from "./summarizeOrderForTracking";
import { PDFDocument } from "pdf-lib";

/**
 * TrackMe's buttons on the Shopify order page: add tracking and print the
 * label for one order, right away rather than as a background job. See
 * docs/order-page-extensions-plan.md.
 */
export class OrderActions {
  /** What add tracking would do; null when Shopify has no such order. */
  static async getSummary(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderId: string,
  ): Promise<OrderTrackingSummary | null> {
    const parcelWeight = await SettingsRepository.getParcelWeight();
    const [orderSnapshot, [trackingInput], review] = await Promise.all([
      fetchOrderFulfillments(admin, shopUrl, orderId),
      getOrdersTrackingInputDataInBatches(admin, [orderId]),
      getOrdersToReview(admin, shopUrl, [orderId], parcelWeight),
    ]);
    if (!orderSnapshot || !trackingInput) return null;

    return summarizeOrderForTracking({
      order: orderSnapshot,
      fulfillmentOrders: trackingInput.fulfillmentOrders,
      shippable: getEligibleShippingFulfillmentOrders(trackingInput),
      zip: trackingInput.shippingAddress?.zip ?? null,
      review: review[0] ?? null,
      parcelWeightLimitKg: parcelWeight.parcelWeightLimitKg,
      isBusy: orderJobLocks.findBusy([orderId]).length > 0,
    });
  }

  /**
   * Adds tracking to one order, holding the same lock as the jobs so a job
   * running on it at the same time cannot book a second AWB.
   */
  static async addTracking(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderId: string,
    locale: Locale,
  ): Promise<OrderAddTrackingResponse> {
    const t = createTranslator(locale);
    const lock = orderJobLocks.tryLock([orderId], "add-tracking");
    if (!lock.isLocked) {
      return { ok: false, error: t("orderAction.busy") };
    }

    try {
      const result = await addTrackingNumbers(admin, shopUrl, {
        orderIds: [orderId],
        parcelWeight: await SettingsRepository.getParcelWeight(),
      });
      const failed = result.failedOrders[0];
      if (failed) {
        return {
          ok: false,
          error: failed.errors.join(" "),
          ...(failed.isZipProblem ? { isZipProblem: true } : {}),
        };
      }

      const succeeded = result.successfulOrders[0];
      if (!succeeded) {
        return { ok: false, error: t("orderAction.nothingToShip") };
      }

      const zipChange = succeeded.zipChange;
      return {
        ok: true,
        trackingNumbers: succeeded.trackingNumbers,
        notices: [
          ...(zipChange
            ? [
                t("orderAction.zipSolved", {
                  from: zipChange.previousZip ?? "–",
                  to: zipChange.newZip,
                }),
              ]
            : []),
          ...(succeeded.warnings ?? []),
        ],
      };
    } finally {
      orderJobLocks.release([orderId]);
    }
  }

  /**
   * One PDF with the order's labels only (Optimus labels for its shipments,
   * or its pickup label), and the order marked as printed, the same as
   * Print labels. Null when the order has no label to print.
   */
  static async buildLabel(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderId: string,
    locale: Locale,
  ): Promise<{ pdf: Buffer | null; errors: string[] }> {
    const result = await buildPrintLabels(admin, shopUrl, {
      orderIds: [orderId],
      locale,
      labelsOnly: true,
    });
    const errors = [
      ...result.generalErrors,
      ...[...result.errorsByOrderId.values()].flat(),
    ];
    if (result.files.length === 0) return { pdf: null, errors };

    if (result.printedUnits.length > 0) {
      const marking = await markLabelsPrinted(
        admin,
        shopUrl,
        result.printedUnits,
      );
      for (const failures of marking.failuresByOrderId.values()) {
        console.error(
          `AppError[OrderActions] ${orderId} printed but not marked: ${failures.join(" ")}`,
        );
      }
    }
    if (result.printedTrackingNumbers.length > 0) {
      await ShippingLabelRepository.recordPrinted(
        result.printedTrackingNumbers,
        new Date(),
      ).catch((error) =>
        console.error(
          "AppError[OrderActions] could not save the print dates.",
          error,
        ),
      );
    }

    return {
      pdf: await mergePdfs(result.files.map((file) => file.buf)),
      errors,
    };
  }
}

async function mergePdfs(pdfs: Buffer[]): Promise<Buffer> {
  if (pdfs.length === 1) return pdfs[0];
  const merged = await PDFDocument.create();
  for (const pdf of pdfs) await appendPDFToDocument(pdf, merged);
  return Buffer.from(await merged.save());
}
