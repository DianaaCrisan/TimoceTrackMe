/**
 * The order GID from a `fulfillments/create` or `fulfillments/update`
 * payload (REST shape: `order_id` is a number), or null.
 */
export function readFulfillmentWebhookOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const orderId = (payload as { order_id?: unknown }).order_id;

  if (typeof orderId === "number" && Number.isSafeInteger(orderId)) {
    return `gid://shopify/Order/${orderId}`;
  }
  if (typeof orderId === "string" && /^\d+$/.test(orderId)) {
    return `gid://shopify/Order/${orderId}`;
  }
  return null;
}
