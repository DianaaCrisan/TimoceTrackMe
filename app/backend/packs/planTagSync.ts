import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";

export type TagSyncPlan = {
  /** Sent first, so a tag in both lists could never end up removed. */
  remove: string[];
  add: string[];
};

/**
 * The tag calls that bring one order in line with the database.
 *
 * - in a pack: it should carry that pack's tag and `in-pachet`
 * - in no pack: neither, so `in-pachet` comes off
 * - `staleTags`: tags of packs it left since its tags were last right
 *
 * Worked out from where the order is now, not from what was asked: an order
 * moved A → B → C before the worker reached it gets C's tags in one go, and
 * A's and B's come off.
 */
export function planTagSync(
  currentPackTag: string | null,
  staleTags: readonly string[],
): TagSyncPlan {
  const wanted = currentPackTag ? [currentPackTag, PACKED_ORDER_TAG] : [];
  const unwanted = currentPackTag
    ? staleTags
    : [...staleTags, PACKED_ORDER_TAG];

  return {
    remove: [...new Set(unwanted)].filter((tag) => !wanted.includes(tag)),
    add: wanted,
  };
}
