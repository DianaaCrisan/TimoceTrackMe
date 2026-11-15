import type { Translate } from "../i18n/translate";
import type { TranslationKey } from "../i18n/translations";
import {
  formatPackName,
  type FulfillmentPackView,
} from "../packs/FulfillmentPack";
import { formatOrderIntervalScope, type OrderInterval } from "./OrderInterval";

/** One product variant still to fulfil, summed over every order in the section. */
export type ReportRow = {
  /** The variant ID, or the item name for items without a variant. */
  key: string;
  /** "Product - Variant", as on the order. */
  name: string;
  quantity: number;
};

/** The delivery or the pickup part of the report. */
export type ReportSection = {
  /** Sorted by order number. */
  orderNames: string[];
  /** The same orders as a compact list: ["#1201-1206", "#1209"]. */
  orderRanges: string[];
  /** Sorted by product name. */
  rows: ReportRow[];
  totalQuantity: number;
};

/**
 * - `unfulfilled`: what is still left to fulfil
 * - `sold`: every item on one pack's orders (current quantities, cancelled
 *   orders left out), to print once tracking is added
 */
export type ReportKind = "unfulfilled" | "sold";

/** The pack a report covers, enough to name it in any language. */
export type ReportPack = Pick<FulfillmentPackView, "id" | "day" | "daySequence">;

/**
 * A per-product report, split into delivery and pickup. Named after its
 * first use, it also carries the sold products report (`kind`).
 */
export type UnfulfilledReport = {
  kind: ReportKind;
  interval: OrderInterval;
  /**
   * Set when the report covers one pack's orders: `interval` is then open
   * (every order number), and the pack is what limits it.
   */
  pack: ReportPack | null;
  /** ISO time the orders were read from Shopify. */
  generatedAt: string;
  delivery: ReportSection;
  pickup: ReportSection;
};

export type ReportSectionKey = "delivery" | "pickup";

export const REPORT_SECTIONS: ReportSectionKey[] = ["delivery", "pickup"];

/** What the page's data request answers. */
export type UnfulfilledReportResponse =
  | {
      ok: true;
      /** Hands the same report to the PDF download, while it is kept. */
      resultId: string;
      report: UnfulfilledReport;
    }
  | { ok: false; error: string };

/** "Pachet 14.11.2026/2", or which order numbers it covers. */
export function formatReportScope(
  report: Pick<UnfulfilledReport, "interval" | "pack">,
  t: Translate,
): string {
  return report.pack
    ? formatPackName(report.pack, t)
    : formatOrderIntervalScope(report.interval, t);
}

/** The URL / form field naming the pack a report covers. */
export const REPORT_PACK_PARAM = "packId";

/** The URL / form field naming the report kind; unset means unfulfilled. */
export const REPORT_KIND_PARAM = "kind";

export function parseReportKind(value: unknown): ReportKind {
  return value === "sold" ? "sold" : "unfulfilled";
}

const REPORT_HEADINGS: Record<ReportKind, TranslationKey> = {
  unfulfilled: "report.heading",
  sold: "report.soldHeading",
};

export function formatReportHeading(kind: ReportKind, t: Translate): string {
  return t(REPORT_HEADINGS[kind]);
}

/** The sold products report page: always for one pack (`?packId=`). */
export const SOLD_REPORT_PATH = "/app/sold-report";

/** The URL the page loads its data from and the one the PDF is posted to. */
export const UNFULFILLED_REPORT_PATH = "/app/unfulfilled-report";
export const UNFULFILLED_REPORT_DATA_PATH = `${UNFULFILLED_REPORT_PATH}/data`;
export const UNFULFILLED_REPORT_PDF_PATH = `${UNFULFILLED_REPORT_PATH}/pdf`;

/** The form field carrying {@link UnfulfilledReportResponse.resultId}. */
export const RESULT_ID_PARAM = "resultId";
