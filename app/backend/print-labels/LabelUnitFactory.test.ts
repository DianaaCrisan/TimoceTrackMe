import { describe, it, expect, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "app/backend/models/AdminApiContextWithoutRest";
import { LabelUnitFactory } from "./LabelUnitFactory";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { LineItemDetails } from "../get-unfulfilled-items/graphql-query-get-fulfillment-orders-by-mode/models/LineItemDetails";
import { BoxType } from "../items-packing/models/BoxType";
import { LineItem } from "app/commons/models/LineItem";

const admin = {} as unknown as AdminApiContextWithoutRest;

describe("LabelUnitFactory", () => {
  it("returns a single PICKUP unit with items when pickup label exists", async () => {
    // mocks
    const getPickupOrderLabelPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("PICKUP-PDF"));

    const getUnfulfilledItems = vi.fn().mockResolvedValue({
      orderName: "#1001",
      fulfillments: [
        {
          fulfillmentOrderId: "gid://shopify/FulfillmentOrder/11",
          fulfillmentOrderLineItems: [
            new LineItemDetails(
              "Cherries - 2kg", // custom variant identifier
              "10", // sku
              "f1",
              "product title irrelevant",
              2, // weight
              BoxType.Small,
              2, // remaining quantity
              "v1",
              ["Spain"],
            ),
            new LineItemDetails(
              "Dragon Fruit - 4kg", // custom variant identifier
              "11", // sku
              "f2",
              "product title irrelevant",
              2, // weight
              BoxType.Small,
              1, // remaining quantity
              "v2",
              ["Spain"],
            ),
          ],
        },
      ],
    });

    const getTrackingInfoWithItems = vi.fn(); // not called when pickup succeeds
    const getCarrierLabelPDF = vi.fn(); // not called

    const factory = new LabelUnitFactory(admin, "shopURL", "ro-RO", {
      getPickupOrderLabelPDF,
      getUnfulfilledItems,
      getTrackingInfoWithItems,
      getCarrierLabelPDF,
    });

    const { units, labelUnitKind } = await factory.buildForOrder(
      "gid://shopify/Order/1",
    );

    expect(labelUnitKind).toBe(LabelUnitKind.PICKUP);
    expect(units).toHaveLength(1);
    const u = units[0];
    expect(u.kind).toBe(LabelUnitKind.PICKUP);
    expect(u.unitId).toBe("gid://shopify/FulfillmentOrder/11");
    expect(u.displayName).toBe(
      "Cherries - 2kg (Spania)(2), Dragon Fruit - 4kg (Spania)(1)",
    );
    expect(u.labelPDF).toBeInstanceOf(Buffer);
    expect(u.errors).toEqual([]);
    expect(u.lineItems).toEqual([
      new LineItem("v1", 2, "Cherries - 2kg", ["Spain"], "10"),
      new LineItem("v2", 1, "Dragon Fruit - 4kg", ["Spain"], "11"),
    ]);
    expect(getTrackingInfoWithItems).not.toHaveBeenCalled();
    expect(getCarrierLabelPDF).not.toHaveBeenCalled();
  });

  it("returns multiple PICKUP units when a pickup order has multiple fulfillments (unitId = fulfillment id)", async () => {
    const getPickupOrderLabelPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("PICKUP-PDF"));

    const fulfillmentId1 = "gid://shopify/FulfillmentOrder/21";
    const fulfillmentId2 = "gid://shopify/FulfillmentOrder/22";

    // TWO fulfillments, each with its own unfulfilled items
    const getUnfulfilledItems = vi.fn().mockResolvedValue({
      orderName: "#1001",
      fulfillments: [
        {
          fulfillmentOrderId: fulfillmentId1,
          fulfillmentOrderLineItems: [
            new LineItemDetails(
              "Cherries - 2kg", // custom variant identifier
              "10", // sku
              "f1",
              "product title irrelevant",
              2, // weight
              BoxType.Small,
              2, // remaining quantity
              "v1",
              ["Spain"],
            ),
          ],
        },
        {
          fulfillmentOrderId: fulfillmentId2,
          fulfillmentOrderLineItems: [
            new LineItemDetails(
              "Mango - 3kg", // custom variant identifier
              "12", // sku
              "f3",
              "product title irrelevant",
              3, // weight
              BoxType.Small,
              1, // remaining quantity
              "v3",
              ["Spain"],
            ),
            new LineItemDetails(
              "Melon - 5kg", // custom variant identifier
              "13", // sku
              "f4",
              "product title irrelevant",
              5, // weight
              BoxType.Big,
              4, // remaining quantity
              "v4",
              ["Spain"],
            ),
          ],
        },
      ],
    });

    const getTrackingInfoWithItems = vi.fn(); // not called
    const getCarrierLabelPDF = vi.fn(); // not called

    const factory = new LabelUnitFactory(admin, "shopURL", "ro-RO", {
      getPickupOrderLabelPDF,
      getUnfulfilledItems,
      getTrackingInfoWithItems,
      getCarrierLabelPDF,
    });

    const { units, labelUnitKind } = await factory.buildForOrder(
      "gid://shopify/Order/9",
    );

    // We should get 2 PICKUP units – one per fulfillment
    expect(labelUnitKind).toBe(LabelUnitKind.PICKUP);
    expect(units).toHaveLength(2);

    const u1 = units.find((u) => u.unitId === fulfillmentId1)!;
    const u2 = units.find((u) => u.unitId === fulfillmentId2)!;

    // Unit 1
    expect(u1.kind).toBe(LabelUnitKind.PICKUP);
    expect(u1.labelPDF).toBeInstanceOf(Buffer);
    expect(u1.displayName).toBe("Cherries - 2kg (Spania)(2)");
    expect(u1.lineItems).toEqual([
      new LineItem("v1", 2, "Cherries - 2kg", ["Spain"], "10"),
    ]);
    expect(u1.errors).toEqual([]);

    // Unit 2
    expect(u2.kind).toBe(LabelUnitKind.PICKUP);
    expect(u2.labelPDF).toBeInstanceOf(Buffer);
    expect(u2.displayName).toBe(
      "Mango - 3kg (Spania)(1), Melon - 5kg (Spania)(4)",
    );
    expect(u2.lineItems).toEqual([
      new LineItem("v3", 1, "Mango - 3kg", ["Spain"], "12"),
      new LineItem("v4", 4, "Melon - 5kg", ["Spain"], "13"),
    ]);
    expect(u2.errors).toEqual([]);

    expect(getTrackingInfoWithItems).not.toHaveBeenCalled();
    expect(getCarrierLabelPDF).not.toHaveBeenCalled();
  });

  it("returns DELIVERY units (one per fulfillment) when no pickup; captures fetch errors", async () => {
    const getPickupOrderLabelPDF = vi.fn().mockResolvedValue(null);

    const getUnfulfilledItems = vi.fn(); // not called
    const getTrackingInfoWithItems = vi.fn().mockResolvedValue([
      {
        fulfillmentId: "gid://shopify/Fulfillment/11",
        fulfillmentName: "#1001-F1",
        trackingNumber: "T1",
        lineItems: [new LineItem("v1", 1, "Cherries - 2kg", ["Spain"], "10")],
      },
      {
        fulfillmentId: "gid://shopify/Fulfillment/12",
        fulfillmentName: "#1001-F2",
        trackingNumber: "T2",
        lineItems: [
          new LineItem("v2", 3, "Dragon Fruit - 4kg", ["Spain"], "11"),
        ],
      },
    ]);

    // first label ok, second throws
    const getCarrierLabelPDF = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from("PDF-F1"))
      .mockRejectedValueOnce(new Error("carrier server down"));

    const factory = new LabelUnitFactory(admin, "shopURL", "ro-RO", {
      getPickupOrderLabelPDF,
      getUnfulfilledItems,
      getTrackingInfoWithItems,
      getCarrierLabelPDF,
    });

    const { units } = await factory.buildForOrder("gid://shopify/Order/2");

    expect(units).toHaveLength(2);

    const [u1, u2] = units;
    expect(u1.kind).toBe(LabelUnitKind.DELIVERY);
    expect(u1.displayName).toBe("#1001-F1");
    expect(u1.labelPDF).toBeInstanceOf(Buffer);
    expect(u1.errors).toEqual([]);

    expect(u2.kind).toBe(LabelUnitKind.DELIVERY);
    expect(u2.displayName).toBe("#1001-F2");
    expect(u2.labelPDF).toBeNull();
    expect(u2.errors.join(" ")).toContain(
      "Order gid://shopify/Order/2: Label '456' for tracking number 'T2' failed to load: Error: carrier server down",
    );

    expect(getTrackingInfoWithItems).toHaveBeenCalledOnce();
    expect(getCarrierLabelPDF).toHaveBeenCalledTimes(2);
  });
});
