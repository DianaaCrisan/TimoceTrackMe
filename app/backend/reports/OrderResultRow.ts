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
export function summarizeOrderResults(rows: OrderResultRow[]): string {
  const counts = countOrderResults(rows);
  const parts = [
    counts.succeeded ? `${counts.succeeded} succeeded` : null,
    counts.failed ? `${counts.failed} failed` : null,
    counts.skipped ? `${counts.skipped} skipped` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "No orders processed";
}
