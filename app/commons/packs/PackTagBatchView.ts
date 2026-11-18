/** The admin action a batch of pack tag work comes from. */
export const PACK_TAG_BATCH_KINDS = [
  "addOrders",
  "removeOrders",
  "close",
  "retry",
] as const;

export type PackTagBatchKind = (typeof PACK_TAG_BATCH_KINDS)[number];

/**
 * One pack action's tag work, as the dashboard shows its progress. Dates are
 * ISO strings.
 */
export type PackTagBatchView = {
  id: string;
  kind: PackTagBatchKind;
  /** The pack the orders joined; null when they left their pack. */
  pack: { id: string; day: string; daySequence: number } | null;
  orderCount: number;
  /** Tagged, or moved on to a newer action. */
  doneCount: number;
  failedCount: number;
  createdAt: string;
  /** Every order tagged or given up on; Shopify search is being checked. */
  taggedAt: string | null;
  /** Shopify search shows the result, or the wait for it timed out. */
  finishedAt: string | null;
};

export function isPackTagBatchKind(value: string): value is PackTagBatchKind {
  return (PACK_TAG_BATCH_KINDS as readonly string[]).includes(value);
}
