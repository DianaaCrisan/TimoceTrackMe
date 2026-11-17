import { describe, expect, it } from "vitest";
import type { PrintLabelsOrder } from "./getOrdersPrintLabelsInputData.server";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { toPrintedTrackingNumbers } from "./printLabels.server";

const order: PrintLabelsOrder = {
  id: "gid://shopify/Order/1",
  name: "#1001",
  createdAt: "2026-10-31T20:00:00Z",
  isPickup: false,
  pickupFulfillmentOrders: [],
  deliveryFulfillments: [1, 2].map((n) => ({
    fulfillmentId: `gid://shopify/Fulfillment/${n}`,
    fulfillmentName: `#1001-F${n}`,
    trackingNumber: `AWB-${n}`,
    lineItems: [],
  })),
};

describe("toPrintedTrackingNumbers", () => {
  it("returns the tracking number of each printed fulfillment only", () => {
    expect(
      toPrintedTrackingNumbers(
        [
          {
            orderId: order.id,
            unitId: "gid://shopify/Fulfillment/2",
            displayName: "#1001-F2",
            kind: LabelUnitKind.DELIVERY,
          },
          // a fulfillment not among the ones read
          {
            orderId: order.id,
            unitId: "gid://shopify/Fulfillment/9",
            displayName: "#1001-F9",
            kind: LabelUnitKind.DELIVERY,
          },
        ],
        [order],
      ),
    ).toEqual(["AWB-2"]);
  });
});
