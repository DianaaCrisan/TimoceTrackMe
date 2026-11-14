import type { OrderInterval } from "./OrderInterval";

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

export type UnfulfilledReport = {
  interval: OrderInterval;
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

/** The URL the page loads its data from and the one the PDF is posted to. */
export const UNFULFILLED_REPORT_PATH = "/app/unfulfilled-report";
export const UNFULFILLED_REPORT_DATA_PATH = `${UNFULFILLED_REPORT_PATH}/data`;
export const UNFULFILLED_REPORT_PDF_PATH = `${UNFULFILLED_REPORT_PATH}/pdf`;

/** The form field carrying {@link UnfulfilledReportResponse.resultId}. */
export const RESULT_ID_PARAM = "resultId";
