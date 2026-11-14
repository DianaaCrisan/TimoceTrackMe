import { translateEn, type Translate } from "app/commons/i18n/translate";

export type OrderResultStatus = "failed" | "skipped" | "succeeded";

/** One order's outcome in a job's report. */
export type OrderResultRow = {
  orderId: string;
  orderName: string;
  status: OrderResultStatus;
  details?: string;
  errors?: string[];
};

export type OrderResultCounts = Record<OrderResultStatus, number>;

export function countOrderResults(rows: OrderResultRow[]): OrderResultCounts {
  const counts: OrderResultCounts = { failed: 0, skipped: 0, succeeded: 0 };
  rows.forEach((row) => counts[row.status]++);
  return counts;
}

/** e.g. "40 succeeded, 2 failed, 3 skipped". Zero counts are left out. */
export function summarizeOrderResults(
  rows: OrderResultRow[],
  t: Translate = translateEn,
): string {
  const counts = countOrderResults(rows);
  const parts = [
    counts.succeeded
      ? t("summary.succeeded", { count: counts.succeeded })
      : null,
    counts.failed ? t("summary.failed", { count: counts.failed }) : null,
    counts.skipped ? t("summary.skipped", { count: counts.skipped }) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : t("summary.noneProcessed");
}
