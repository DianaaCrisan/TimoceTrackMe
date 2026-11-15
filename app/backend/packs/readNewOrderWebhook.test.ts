import { describe, expect, it } from "vitest";
import { readNewOrderWebhook } from "./readNewOrderWebhook";

const ORDER_ID = "gid://shopify/Order/5551";

describe("readNewOrderWebhook", () => {
  it("assigns an ordinary new order", () => {
    expect(
      readNewOrderWebhook({
        admin_graphql_api_id: ORDER_ID,
        name: "#1201",
        fulfillment_status: null,
        cancelled_at: null,
      }),
    ).toEqual({ kind: "assign", orderId: ORDER_ID, orderName: "#1201" });
  });

  it("assigns a partly fulfilled order: something is still to ship", () => {
    expect(
      readNewOrderWebhook({
        admin_graphql_api_id: ORDER_ID,
        fulfillment_status: "partial",
      }).kind,
    ).toBe("assign");
  });

  it("skips orders fulfilled or cancelled when they are created", () => {
    expect(
      readNewOrderWebhook({
        admin_graphql_api_id: ORDER_ID,
        fulfillment_status: "fulfilled",
      }),
    ).toEqual({ kind: "skip", reason: "alreadyFulfilled", orderId: ORDER_ID });
    expect(
      readNewOrderWebhook({
        admin_graphql_api_id: ORDER_ID,
        cancelled_at: "2026-11-15T10:00:00+02:00",
      }),
    ).toEqual({ kind: "skip", reason: "cancelled", orderId: ORDER_ID });
  });

  it("refuses a payload without an order GID", () => {
    expect(readNewOrderWebhook(null)).toEqual({ kind: "unreadable" });
    expect(readNewOrderWebhook({ id: 5551 })).toEqual({ kind: "unreadable" });
    expect(
      readNewOrderWebhook({ admin_graphql_api_id: "gid://shopify/Product/1" }),
    ).toEqual({ kind: "unreadable" });
  });
});
