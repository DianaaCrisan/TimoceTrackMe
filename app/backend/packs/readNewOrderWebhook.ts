const ORDER_GID_PATTERN = /^gid:\/\/shopify\/Order\/\d+$/;

/** What to do with an `orders/create` webhook. */
export type NewOrderDecision =
  | { kind: "assign"; orderId: string; orderName: string | null }
  /** Made already done (e.g. a Shopify POS sale): nothing to pack. */
  | { kind: "skip"; reason: "alreadyFulfilled" | "cancelled"; orderId: string }
  /** Not a payload we can act on; a retry would not change that. */
  | { kind: "unreadable" };

/**
 * Reads the parts of an `orders/create` payload that decide whether the
 * order goes into a pack.
 *
 * An order fulfilled or cancelled when it is created never gets a label, so
 * in a pack it would count as "not done" forever and keep the pack from
 * closing.
 */
export function readNewOrderWebhook(payload: unknown): NewOrderDecision {
  if (!payload || typeof payload !== "object") return { kind: "unreadable" };

  const order = payload as {
    admin_graphql_api_id?: unknown;
    name?: unknown;
    fulfillment_status?: unknown;
    cancelled_at?: unknown;
  };

  const orderId = order.admin_graphql_api_id;
  if (typeof orderId !== "string" || !ORDER_GID_PATTERN.test(orderId)) {
    return { kind: "unreadable" };
  }

  if (order.cancelled_at) {
    return { kind: "skip", reason: "cancelled", orderId };
  }
  if (order.fulfillment_status === "fulfilled") {
    return { kind: "skip", reason: "alreadyFulfilled", orderId };
  }

  return {
    kind: "assign",
    orderId,
    orderName: typeof order.name === "string" ? order.name : null,
  };
}
