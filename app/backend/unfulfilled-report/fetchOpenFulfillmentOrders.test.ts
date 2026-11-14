import { describe, expect, it } from "vitest";
import { parseOpenFulfillmentOrders } from "./fetchOpenFulfillmentOrders.server";

const fo = (id: number, status = "OPEN", methodType = "SHIPPING") => ({
  id: `gid://shopify/FulfillmentOrder/${id}`,
  status,
  deliveryMethod: { methodType },
  order: { id: `gid://shopify/Order/${id}`, name: `#${1000 + id}` },
});

const item = (
  parent: number,
  remainingQuantity: number,
  name = "Mici - 1 kg",
  variantId: string | null = "gid://shopify/ProductVariant/1",
) => ({
  id: `gid://shopify/FulfillmentOrderLineItem/${parent}${remainingQuantity}`,
  remainingQuantity,
  lineItem: { name, variant: variantId ? { id: variantId } : null },
  __parentId: `gid://shopify/FulfillmentOrder/${parent}`,
});

describe("parseOpenFulfillmentOrders", () => {
  it("attaches line items to their fulfillment order, wherever they appear", () => {
    const result = parseOpenFulfillmentOrders([
      fo(1),
      fo(2, "IN_PROGRESS", "PICK_UP"),
      item(1, 2),
      item(2, 1, "Custom", null),
      item(1, 3, "Antricot", "gid://shopify/ProductVariant/2"),
    ]);

    expect(result).toEqual([
      {
        id: "gid://shopify/FulfillmentOrder/1",
        orderId: "gid://shopify/Order/1",
        orderName: "#1001",
        methodType: "SHIPPING",
        lineItems: [
          {
            variantId: "gid://shopify/ProductVariant/1",
            name: "Mici - 1 kg",
            remainingQuantity: 2,
          },
          {
            variantId: "gid://shopify/ProductVariant/2",
            name: "Antricot",
            remainingQuantity: 3,
          },
        ],
      },
      {
        id: "gid://shopify/FulfillmentOrder/2",
        orderId: "gid://shopify/Order/2",
        orderName: "#1002",
        methodType: "PICK_UP",
        lineItems: [{ variantId: null, name: "Custom", remainingQuantity: 1 }],
      },
    ]);
  });

  it("skips line items with nothing left to fulfil", () => {
    const [result] = parseOpenFulfillmentOrders([fo(1), item(1, 0)]);
    expect(result.lineItems).toEqual([]);
  });

  it("skips closed and cancelled fulfillment orders, should any slip through", () => {
    expect(
      parseOpenFulfillmentOrders([
        fo(1, "CLOSED"),
        fo(2, "CANCELLED"),
        item(1, 2),
        item(2, 2),
      ]),
    ).toEqual([]);
  });
});
