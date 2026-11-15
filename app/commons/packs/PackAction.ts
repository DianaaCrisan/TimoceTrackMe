/** What the pack action route (`PACKS_MANAGE_PATH`) can be asked to do. */
export const PACK_ACTION_INTENTS = [
  "create",
  "lock",
  "close",
  "reopen",
  "delete",
  "retryTagging",
  "addOrders",
  "removeOrders",
] as const;

export type PackActionIntent = (typeof PACK_ACTION_INTENTS)[number];

export const PACK_ACTION_FIELDS = {
  intent: "intent",
  packId: "packId",
  /** "true" to close a pack and move its orders not done to the next pack. */
  moveLeftovers: "moveLeftovers",
  /** For addOrders: a pack ID, or `FILLING_PACK_TARGET`. */
  target: "target",
} as const;

/** Adds orders to the filling pack, starting one if none is filling. */
export const FILLING_PACK_TARGET = "filling";

/** The message is ready to show, in the admin's language. */
export type PackActionResponse =
  | { ok: true; message: string }
  | { ok: false; error: string };
