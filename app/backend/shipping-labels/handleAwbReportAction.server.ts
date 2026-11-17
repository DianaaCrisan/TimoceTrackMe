import { resolveLocale, LOCALE_PARAM } from "app/commons/i18n/Locale";
import { createTranslator, type Translate } from "app/commons/i18n/translate";
import {
  AWB_REPORT_FIELDS,
  AWB_REPORT_INTENT,
  parseReportMonth,
  REPORT_MONTH_PARAM,
  shopDayStart,
  type AwbReportActionResponse,
  type AwbReportIntent,
  type AwbStatus,
} from "app/commons/shipping-labels/AwbReport";
import { MAX_HAND_ADDED_AWBS } from "app/commons/shipping-labels/parseHandAddedAwbs";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { addLabelsByHand } from "./addLabelsByHand.server";
import { ShippingLabelRepository } from "./ShippingLabelRepository.server";
import { ShippingLabelSync } from "./ShippingLabelSync.server";

/** The AWB report page's actions: refresh a month, add by hand, delete. */
export async function handleAwbReportAction(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  formData: FormData,
): Promise<AwbReportActionResponse> {
  const t = createTranslator(resolveLocale(formData.get(LOCALE_PARAM)));
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const intent = Object.values(AWB_REPORT_INTENT).find(
    (value) => value === field(AWB_REPORT_FIELDS.intent),
  );
  const fail = (
    error: string,
    lineErrors?: string[],
  ): AwbReportActionResponse => ({
    ok: false,
    intent: intent ?? null,
    error,
    ...(lineErrors ? { lineErrors } : {}),
  });

  switch (intent) {
    case AWB_REPORT_INTENT.refresh: {
      const month = parseReportMonth(field(REPORT_MONTH_PARAM));
      if (!month) return fail(t("awbReport.invalidMonth"));
      try {
        const { orderCount, changedCount } = await ShippingLabelSync.syncMonth(
          admin,
          shopUrl,
          month,
        );
        return ok(
          intent,
          t("awbReport.refreshed", { orders: orderCount, count: changedCount }),
        );
      } catch (error) {
        console.error(
          "AppError[AwbReport] refresh from Shopify failed.",
          error,
        );
        return fail(t("awbReport.refreshFailed", { error: message(error) }));
      }
    }

    case AWB_REPORT_INTENT.addByHand:
      try {
        return await addByHand(admin, shopUrl, intent, field, t, fail);
      } catch (error) {
        console.error("AppError[AwbReport] add by hand failed.", error);
        return fail(t("awbReport.refreshFailed", { error: message(error) }));
      }

    case AWB_REPORT_INTENT.delete: {
      const trackingNumber = field(AWB_REPORT_FIELDS.trackingNumber);
      const deleted =
        trackingNumber &&
        (await ShippingLabelRepository.deleteAddedByHand(trackingNumber));
      return deleted
        ? ok(intent, t("awbReport.deleted", { awb: trackingNumber }))
        : fail(t("awbReport.deleteNotAllowed"));
    }

    default:
      return fail(t("awbReport.unknownAction"));
  }
}

async function addByHand(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  intent: AwbReportIntent,
  field: (name: string) => string,
  t: Translate,
  fail: (error: string, lineErrors?: string[]) => AwbReportActionResponse,
): Promise<AwbReportActionResponse> {
  const statusValue = field(AWB_REPORT_FIELDS.status);
  const status: AwbStatus | null =
    statusValue === "USED" || statusValue === "CANCELLED" ? statusValue : null;
  if (!status) return fail(t("awbReport.add.badStatus"));

  const issuedAt = shopDayStart(field(AWB_REPORT_FIELDS.day));
  if (!issuedAt) return fail(t("awbReport.add.badDay"));

  const result = await addLabelsByHand(admin, shopUrl, {
    text: field(AWB_REPORT_FIELDS.awbs),
    status,
    issuedAt,
    note: field(AWB_REPORT_FIELDS.note) || null,
  });

  switch (result.kind) {
    case "empty":
      return fail(t("awbReport.add.empty"));
    case "tooMany":
      return fail(t("awbReport.add.tooMany", { max: MAX_HAND_ADDED_AWBS }));
    case "lineErrors":
      return fail(
        t("awbReport.add.lineErrorsIntro"),
        result.errors.map((error) =>
          t("awbReport.add.lineError", {
            line: error.line,
            text: error.text,
            reason: t(`awbReport.add.reason.${error.reason}`),
          }),
        ),
      );
    case "saved":
      return {
        ...ok(intent, t("awbReport.add.saved", { count: result.added.length })),
        ...(result.alreadyInReport.length > 0
          ? {
              notice: t("awbReport.add.alreadyInReport", {
                awbs: result.alreadyInReport.join(", "),
              }),
            }
          : {}),
      };
  }
}

function ok(intent: AwbReportIntent, text: string): AwbReportActionResponse {
  return { ok: true, intent, message: text };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
