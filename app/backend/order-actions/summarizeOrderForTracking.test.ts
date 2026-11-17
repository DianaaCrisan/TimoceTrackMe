import { describe, expect, it } from "vitest";
import type { TrackingInputFulfillmentOrder } from "../add-tracking/getOrdersTrackingInputData.server";
import type { OrderSnapshot } from "../shipping-labels/reconcileOrderLabels";
import { readOrderActionParams } from "./readOrderActionParams";
import { summarizeOrderForTracking } from "./summarizeOrderForTracking";

const order = (
  fulfillments: OrderSnapshot["fulfillments"] = [],
): OrderSnapshot => ({
  id: "gid://shopify/Order/1",
  name: "#1001",
  createdAt: new Date("2026-11-17T10:00:00Z"),
  fulfillments,
});

const fulfillmentOrder = (
  deliveryMethod: string,
  remaining: number[],
): TrackingInputFulfillmentOrder => ({
  id: `fo-${deliveryMethod}`,
  status: "OPEN",
  deliveryMethod,
  lineItems: remaining.map((remainingQuantity, i) => ({
    fulfillmentOrderLineItemId: `li-${i}`,
    orderLineItemId: `oli-${i}`,
    name: `Item ${i}`,
    remainingQuantity,
  })),
});

const base = {
  zip: "400001",
  review: null,
  parcelWeightLimitKg: 25,
  isBusy: false,
};

describe("summarizeOrderForTracking", () => {
  it("counts the units add tracking would ship and lists the AWBs already on active fulfillments", () => {
    const shipping = fulfillmentOrder("SHIPPING", [2, 1]);
    const summary = summarizeOrderForTracking({
      ...base,
      order: order([
        {
          id: "f1",
          status: "SUCCESS",
          createdAt: new Date(),
          updatedAt: new Date(),
          tracking: [{ number: "6256000001", company: "Optimus" }],
        },
        {
          id: "f2",
          status: "CANCELLED",
          createdAt: new Date(),
          updatedAt: new Date(),
          tracking: [{ number: "6256000000", company: "Optimus" }],
        },
      ]),
      fulfillmentOrders: [shipping],
      shippable: [shipping],
    });

    expect(summary).toMatchObject({
      orderName: "#1001",
      unitsToShip: 3,
      isPickup: false,
      existingAwbs: ["6256000001"],
      zip: "400001",
    });
  });

  it("says pickup when there is nothing to ship and the order is picked up in store", () => {
    expect(
      summarizeOrderForTracking({
        ...base,
        zip: "  ",
        order: order(),
        fulfillmentOrders: [fulfillmentOrder("PICK_UP", [1])],
        shippable: [],
      }),
    ).toMatchObject({ unitsToShip: 0, isPickup: true, zip: null });
  });

  it("carries the customer note and the weight check", () => {
    expect(
      summarizeOrderForTracking({
        ...base,
        order: order(),
        fulfillmentOrders: [],
        shippable: [],
        review: {
          id: "gid://shopify/Order/1",
          name: "#1001",
          customerName: "Ana",
          note: "Sunați înainte",
          attributes: [],
          weightKg: 31,
          shipsOverWeightLimit: true,
        },
      }),
    ).toMatchObject({
      note: "Sunați înainte",
      weightKg: 31,
      shipsOverWeightLimit: true,
    });
  });
});

describe("readOrderActionParams", () => {
  it("takes only order GIDs and falls back to the default language", () => {
    const read = (values: Record<string, string>) =>
      readOrderActionParams((name) => values[name] ?? null);

    expect(read({ orderId: "gid://shopify/Order/12", locale: "ro" })).toEqual({
      orderId: "gid://shopify/Order/12",
      locale: "ro",
    });
    expect(read({ orderId: "gid://shopify/Product/12" }).orderId).toBeNull();
    expect(read({ orderId: "12" }).orderId).toBeNull();
  });
});
