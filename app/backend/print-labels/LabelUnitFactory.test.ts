import { describe, it, expect, vi } from "vitest";
import type { PrintLabelsOrder } from "./getOrdersPrintLabelsInputData.server";
import { LabelUnitFactory } from "./LabelUnitFactory";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { LineItem } from "./models/LineItem";

describe("LabelUnitFactory", () => {
  it("returns pickup units when order is pickup", async () => {
    const generatePickupLabelPDF = vi
      .fn()
      .mockResolvedValue(new Uint8Array(Buffer.from("PICKUP-PDF")));

    const getCarrierLabelPDF = vi.fn();

    const factory = new LabelUnitFactory({
      getCarrierLabelPDF,
      generatePickupLabelPDF,
    });

    const order: PrintLabelsOrder = {
      id: "gid://shopify/Order/1",
      name: "#1001",
      createdAt: "2026-04-09T10:00:00Z",
      isPickup: true,
      pickupData: {
        confirmationNumber: "CONF-123",
        billingFirstName: "John",
        billingLastName: "Doe",
        email: "john@example.com",
        phone: "0700000000",
      },
      pickupFulfillmentOrders: [
        {
          fulfillmentOrderId: "gid://shopify/FulfillmentOrder/11",
          lineItems: [
            {
              variantId: "v1",
              quantity: 2,
              name: "Cherries - 2kg",
              sku: "10",
            },
            {
              variantId: "v2",
              quantity: 1,
              name: "Dragon Fruit - 4kg",
              sku: "11",
            },
          ],
        },
      ],
      deliveryFulfillments: [],
    };

    const { units, labelUnitKind } = await factory.buildForOrder(order);

    expect(labelUnitKind).toBe(LabelUnitKind.PICKUP);
    expect(units).toHaveLength(1);

    const u = units[0];
    expect(u.kind).toBe(LabelUnitKind.PICKUP);
    expect(u.unitId).toBe("gid://shopify/FulfillmentOrder/11");
    expect(u.labelPDF).toBeInstanceOf(Buffer);
    expect(u.errors).toEqual([]);
    expect(u.lineItems).toEqual([
      new LineItem("v1", 2, "Cherries - 2kg", "10"),
      new LineItem("v2", 1, "Dragon Fruit - 4kg", "11"),
    ]);
    expect(u.displayName).toBe(
      LineItem.buildLineItemsDisplayName([
        new LineItem("v1", 2, "Cherries - 2kg", "10"),
        new LineItem("v2", 1, "Dragon Fruit - 4kg", "11"),
      ]),
    );

    expect(generatePickupLabelPDF).toHaveBeenCalledOnce();
    expect(getCarrierLabelPDF).not.toHaveBeenCalled();
  });

  it("returns multiple pickup units when a pickup order has multiple fulfillment orders", async () => {
    const generatePickupLabelPDF = vi
      .fn()
      .mockResolvedValue(new Uint8Array(Buffer.from("PICKUP-PDF")));

    const getCarrierLabelPDF = vi.fn();

    const factory = new LabelUnitFactory({
      getCarrierLabelPDF,
      generatePickupLabelPDF,
    });

    const fulfillmentId1 = "gid://shopify/FulfillmentOrder/21";
    const fulfillmentId2 = "gid://shopify/FulfillmentOrder/22";

    const order: PrintLabelsOrder = {
      id: "gid://shopify/Order/9",
      name: "#1009",
      createdAt: "2026-04-09T10:00:00Z",
      isPickup: true,
      pickupData: {
        confirmationNumber: "CONF-999",
        billingFirstName: "Jane",
        billingLastName: "Doe",
        email: "jane@example.com",
        phone: "0711111111",
      },
      pickupFulfillmentOrders: [
        {
          fulfillmentOrderId: fulfillmentId1,
          lineItems: [
            {
              variantId: "v1",
              quantity: 2,
              name: "Cherries - 2kg",
              sku: "10",
            },
          ],
        },
        {
          fulfillmentOrderId: fulfillmentId2,
          lineItems: [
            {
              variantId: "v3",
              quantity: 1,
              name: "Mango - 3kg",
              sku: "12",
            },
            {
              variantId: "v4",
              quantity: 4,
              name: "Melon - 5kg",
              sku: "13",
            },
          ],
        },
      ],
      deliveryFulfillments: [],
    };

    const { units, labelUnitKind } = await factory.buildForOrder(order);

    expect(labelUnitKind).toBe(LabelUnitKind.PICKUP);
    expect(units).toHaveLength(2);

    const u1 = units.find((u) => u.unitId === fulfillmentId1)!;
    const u2 = units.find((u) => u.unitId === fulfillmentId2)!;

    expect(u1.kind).toBe(LabelUnitKind.PICKUP);
    expect(u1.labelPDF).toBeInstanceOf(Buffer);
    expect(u1.lineItems).toEqual([
      new LineItem("v1", 2, "Cherries - 2kg", "10"),
    ]);
    expect(u1.displayName).toBe(
      LineItem.buildLineItemsDisplayName([
        new LineItem("v1", 2, "Cherries - 2kg", "10"),
      ]),
    );
    expect(u1.errors).toEqual([]);

    expect(u2.kind).toBe(LabelUnitKind.PICKUP);
    expect(u2.labelPDF).toBeInstanceOf(Buffer);
    expect(u2.lineItems).toEqual([
      new LineItem("v3", 1, "Mango - 3kg", "12"),
      new LineItem("v4", 4, "Melon - 5kg", "13"),
    ]);
    expect(u2.displayName).toBe(
      LineItem.buildLineItemsDisplayName([
        new LineItem("v3", 1, "Mango - 3kg", "12"),
        new LineItem("v4", 4, "Melon - 5kg", "13"),
      ]),
    );
    expect(u2.errors).toEqual([]);

    expect(generatePickupLabelPDF).toHaveBeenCalledOnce();
    expect(getCarrierLabelPDF).not.toHaveBeenCalled();
  });

  it("returns delivery units when order is not pickup and captures carrier label fetch errors", async () => {
    const generatePickupLabelPDF = vi.fn();

    const getCarrierLabelPDF = vi
      .fn()
      .mockResolvedValueOnce(Buffer.from("PDF-F1"))
      .mockRejectedValueOnce(new Error("carrier server down"));

    const factory = new LabelUnitFactory({
      getCarrierLabelPDF,
      generatePickupLabelPDF,
    });

    const order: PrintLabelsOrder = {
      id: "gid://shopify/Order/2",
      name: "#1002",
      createdAt: "2026-04-09T10:00:00Z",
      isPickup: false,
      pickupData: undefined,
      pickupFulfillmentOrders: [],
      deliveryFulfillments: [
        {
          fulfillmentId: "gid://shopify/Fulfillment/11",
          fulfillmentName: "#1002-F1",
          trackingNumber: "T1",
          lineItems: [
            {
              variantId: "v1",
              quantity: 1,
              name: "Cherries - 2kg",
              sku: "10",
            },
          ],
        },
        {
          fulfillmentId: "gid://shopify/Fulfillment/12",
          fulfillmentName: "#1002-F2",
          trackingNumber: "T2",
          lineItems: [
            {
              variantId: "v2",
              quantity: 3,
              name: "Dragon Fruit - 4kg",
              sku: "11",
            },
          ],
        },
      ],
    };

    const { units, labelUnitKind } = await factory.buildForOrder(order);

    expect(labelUnitKind).toBe(LabelUnitKind.DELIVERY);
    expect(units).toHaveLength(2);

    const [u1, u2] = units;

    expect(u1.kind).toBe(LabelUnitKind.DELIVERY);
    expect(u1.displayName).toBe("#1002-F1");
    expect(u1.labelPDF).toBeInstanceOf(Buffer);
    expect(u1.errors).toEqual([]);
    expect(u1.lineItems).toEqual([
      new LineItem("v1", 1, "Cherries - 2kg", "10"),
    ]);

    expect(u2.kind).toBe(LabelUnitKind.DELIVERY);
    expect(u2.displayName).toBe("#1002-F2");
    expect(u2.labelPDF).toBeNull();
    expect(u2.lineItems).toEqual([
      new LineItem("v2", 3, "Dragon Fruit - 4kg", "11"),
    ]);
    expect(u2.errors).toEqual([
      "Order #1002: Label for tracking number 'T2' failed to load: Error: carrier server down",
    ]);

    expect(generatePickupLabelPDF).not.toHaveBeenCalled();
    expect(getCarrierLabelPDF).toHaveBeenCalledTimes(2);
    expect(getCarrierLabelPDF).toHaveBeenNthCalledWith(1, "T1");
    expect(getCarrierLabelPDF).toHaveBeenNthCalledWith(2, "T2");
  });

  it("skips pickup fulfillment orders with no line items", async () => {
    const generatePickupLabelPDF = vi
      .fn()
      .mockResolvedValue(new Uint8Array(Buffer.from("PICKUP-PDF")));

    const factory = new LabelUnitFactory({
      getCarrierLabelPDF: vi.fn(),
      generatePickupLabelPDF,
    });

    const order: PrintLabelsOrder = {
      id: "gid://shopify/Order/3",
      name: "#1003",
      createdAt: "2026-04-09T10:00:00Z",
      isPickup: true,
      pickupData: undefined,
      pickupFulfillmentOrders: [
        {
          fulfillmentOrderId: "gid://shopify/FulfillmentOrder/31",
          lineItems: [],
        },
        {
          fulfillmentOrderId: "gid://shopify/FulfillmentOrder/32",
          lineItems: [
            {
              variantId: "v9",
              quantity: 1,
              name: "Papaya - 2kg",
              sku: "19",
            },
          ],
        },
      ],
      deliveryFulfillments: [],
    };

    const { units, labelUnitKind } = await factory.buildForOrder(order);

    expect(labelUnitKind).toBe(LabelUnitKind.PICKUP);
    expect(units).toHaveLength(1);
    expect(units[0].unitId).toBe("gid://shopify/FulfillmentOrder/32");
  });

  it("throws when a pickup item is missing variantId", async () => {
    const factory = new LabelUnitFactory({
      getCarrierLabelPDF: vi.fn(),
      generatePickupLabelPDF: vi
        .fn()
        .mockResolvedValue(new Uint8Array(Buffer.from("PICKUP-PDF"))),
    });

    const order: PrintLabelsOrder = {
      id: "gid://shopify/Order/4",
      name: "#1004",
      createdAt: "2026-04-09T10:00:00Z",
      isPickup: true,
      pickupData: undefined,
      pickupFulfillmentOrders: [
        {
          fulfillmentOrderId: "gid://shopify/FulfillmentOrder/41",
          lineItems: [
            {
              variantId: null,
              quantity: 1,
              name: "Papaya - 2kg",
              sku: "19",
            },
          ],
        },
      ],
      deliveryFulfillments: [],
    };

    await expect(factory.buildForOrder(order)).rejects.toThrow(
      'Variant id missing for pickup item "Papaya - 2kg" in order gid://shopify/Order/4.',
    );
  });

  it("throws when a delivery item is missing variantId", async () => {
    const factory = new LabelUnitFactory({
      getCarrierLabelPDF: vi.fn().mockResolvedValue(Buffer.from("PDF")),
      generatePickupLabelPDF: vi.fn(),
    });

    const order: PrintLabelsOrder = {
      id: "gid://shopify/Order/5",
      name: "#1005",
      createdAt: "2026-04-09T10:00:00Z",
      isPickup: false,
      pickupData: undefined,
      pickupFulfillmentOrders: [],
      deliveryFulfillments: [
        {
          fulfillmentId: "gid://shopify/Fulfillment/51",
          fulfillmentName: "#1005-F1",
          trackingNumber: "TX-1",
          lineItems: [
            {
              variantId: null,
              quantity: 2,
              name: "Kiwi - 2kg",
              sku: "31",
            },
          ],
        },
      ],
    };

    await expect(factory.buildForOrder(order)).rejects.toThrow(
      "Variant id missing for fulfillment gid://shopify/Fulfillment/51 in order #1005.",
    );
  });
});
