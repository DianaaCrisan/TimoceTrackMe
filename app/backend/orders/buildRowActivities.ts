import type { OrderRowActivities } from "app/commons/orders/OrderRowActivity";

type PackDay = { day: string; daySequence: number };

/**
 * Why each visible row is greyed out, if it is. One reason per row, the most
 * telling first: a job at work, then pack tags being updated, then Shopify
 * search lagging behind a change that is already done.
 */
export function buildRowActivities({
  jobOwners,
  pendingTags,
  staleOrderIds,
}: {
  /** Order → the job kind holding it. */
  jobOwners: Map<string, string>;
  /** Order with pending tags → the pack it is joining; null when leaving. */
  pendingTags: Map<string, PackDay | null>;
  staleOrderIds: string[];
}): OrderRowActivities {
  const activities: OrderRowActivities = {};

  for (const orderId of staleOrderIds) {
    activities[orderId] = { kind: "stale" };
  }
  for (const [orderId, pack] of pendingTags) {
    activities[orderId] = pack
      ? { kind: "joiningPack", pack }
      : { kind: "leavingPack" };
  }
  for (const [orderId, job] of jobOwners) {
    activities[orderId] = { kind: "inJob", job };
  }
  return activities;
}
