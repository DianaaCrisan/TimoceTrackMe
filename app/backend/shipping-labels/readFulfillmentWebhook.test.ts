import { describe, expect, it } from "vitest";
import { readFulfillmentWebhookOrderId } from "./readFulfillmentWebhook";

describe("readFulfillmentWebhookOrderId", () => {
  it("turns the REST order ID into a GID", () => {
    expect(readFulfillmentWebhookOrderId({ order_id: 5512345678 })).toBe(
      "gid://shopify/Order/5512345678",
    );
    expect(readFulfillmentWebhookOrderId({ order_id: "5512345678" })).toBe(
      "gid://shopify/Order/5512345678",
    );
  });

  it.each([
    null,
    "x",
    {},
    { order_id: null },
    { order_id: "12a" },
    { order_id: 1.5 },
  ])("returns null for %j", (payload) => {
    expect(readFulfillmentWebhookOrderId(payload)).toBeNull();
  });
});
