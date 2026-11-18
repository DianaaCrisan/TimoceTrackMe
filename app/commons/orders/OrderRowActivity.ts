/**
 * Why a dashboard row is greyed out: it is being changed, or Shopify's
 * search still lists it where it no longer belongs. Such a row cannot be
 * ticked; a reload settles it.
 */
export type OrderRowActivity =
  /** Joining a pack; its tags are being updated. */
  | { kind: "joiningPack"; pack: { day: string; daySequence: number } }
  /** Leaving its pack; its tags are being updated. */
  | { kind: "leavingPack" }
  /** A job is working on it, e.g. "add-tracking". */
  | { kind: "inJob"; job: string }
  /** Done changing, but Shopify search has not caught up yet. */
  | { kind: "stale" };

/** Order ID → its activity; orders not in it are settled. */
export type OrderRowActivities = Record<string, OrderRowActivity>;
