import { describe, expect, it } from "vitest";
import { buildUnfulfilledReport } from "./buildUnfulfilledReport";
import type { OpenFulfillmentOrder } from "./fetchOpenFulfillmentOrders.server";

const ALL = { from: null, to: null };
const NOW = new Date("2026-11-14T10:00:00Z");

let nextId = 1;
const fulfillmentOrder = (
  orderName: string,
  methodType: string,
  lineItems: [variantId: string | null, name: string, quantity: number][],
): OpenFulfillmentOrder => ({
  id: `gid://shopify/FulfillmentOrder/${nextId++}`,
  orderId: `gid://shopify/Order/${orderName.replace("#", "")}`,
  orderName,
  methodType,
  lineItems: lineItems.map(([variantId, name, remainingQuantity]) => ({
    variantId,
    name,
    remainingQuantity,
  })),
});

describe("buildUnfulfilledReport", () => {
  it("adds up quantities per variant, separately for delivery and pickup", () => {
    const report = buildUnfulfilledReport(
      [
        fulfillmentOrder("#1002", "SHIPPING", [
          ["v1", "Mici - 1 kg", 2],
          ["v2", "Antricot - 500 g", 1],
        ]),
        fulfillmentOrder("#1001", "SHIPPING", [["v1", "Mici - 1 kg", 3]]),
        fulfillmentOrder("#1003", "PICK_UP", [["v1", "Mici - 1 kg", 4]]),
      ],
      ALL,
      NOW,
    );

    expect(report.delivery).toEqual({
      orderNames: ["#1001", "#1002"],
      orderRanges: ["#1001-1002"],
      rows: [
        { key: "v2", name: "Antricot - 500 g", quantity: 1 },
        { key: "v1", name: "Mici - 1 kg", quantity: 5 },
      ],
      totalQuantity: 6,
    });
    expect(report.pickup).toEqual({
      orderNames: ["#1003"],
      orderRanges: ["#1003"],
      rows: [{ key: "v1", name: "Mici - 1 kg", quantity: 4 }],
      totalQuantity: 4,
    });
    expect(report.generatedAt).toBe("2026-11-14T10:00:00.000Z");
  });

  it("counts local delivery and pickup points as delivery", () => {
    const report = buildUnfulfilledReport(
      [
        fulfillmentOrder("#1", "LOCAL", [["v1", "A", 1]]),
        fulfillmentOrder("#2", "PICKUP_POINT", [["v1", "A", 1]]),
      ],
      ALL,
      NOW,
    );

    expect(report.delivery.orderNames).toEqual(["#1", "#2"]);
    expect(report.pickup.orderNames).toEqual([]);
  });

  it("puts an order split between delivery and pickup in both sections", () => {
    const report = buildUnfulfilledReport(
      [
        fulfillmentOrder("#7", "SHIPPING", [["v1", "A", 1]]),
        fulfillmentOrder("#7", "PICK_UP", [["v2", "B", 2]]),
      ],
      ALL,
      NOW,
    );

    expect(report.delivery.orderNames).toEqual(["#7"]);
    expect(report.pickup.orderNames).toEqual(["#7"]);
    expect(report.pickup.rows).toEqual([{ key: "v2", name: "B", quantity: 2 }]);
  });

  it("only counts orders in the interval", () => {
    const report = buildUnfulfilledReport(
      [
        fulfillmentOrder("#1199", "SHIPPING", [["v1", "A", 1]]),
        fulfillmentOrder("#1200", "SHIPPING", [["v1", "A", 2]]),
        fulfillmentOrder("#1250", "PICK_UP", [["v1", "A", 3]]),
        fulfillmentOrder("#1251", "PICK_UP", [["v1", "A", 4]]),
      ],
      { from: 1200, to: 1250 },
      NOW,
    );

    expect(report.delivery.orderNames).toEqual(["#1200"]);
    expect(report.delivery.totalQuantity).toBe(2);
    expect(report.pickup.orderNames).toEqual(["#1250"]);
    expect(report.pickup.totalQuantity).toBe(3);
    expect(report.interval).toEqual({ from: 1200, to: 1250 });
  });

  it("groups items without a variant by name", () => {
    const report = buildUnfulfilledReport(
      [
        fulfillmentOrder("#1", "SHIPPING", [[null, "Custom tray", 1]]),
        fulfillmentOrder("#2", "SHIPPING", [[null, "Custom tray", 2]]),
      ],
      ALL,
      NOW,
    );

    expect(report.delivery.rows).toEqual([
      { key: "name:Custom tray", name: "Custom tray", quantity: 3 },
    ]);
  });

  it("leaves out fulfillment orders with nothing left to fulfil", () => {
    const report = buildUnfulfilledReport(
      [fulfillmentOrder("#1", "SHIPPING", [])],
      ALL,
      NOW,
    );

    expect(report.delivery).toEqual({
      orderNames: [],
      orderRanges: [],
      rows: [],
      totalQuantity: 0,
    });
  });

  it("sorts orders by number, not as text", () => {
    const report = buildUnfulfilledReport(
      [
        fulfillmentOrder("#1000", "SHIPPING", [["v1", "A", 1]]),
        fulfillmentOrder("#999", "SHIPPING", [["v1", "A", 1]]),
      ],
      ALL,
      NOW,
    );

    expect(report.delivery.orderNames).toEqual(["#999", "#1000"]);
    expect(report.delivery.orderRanges).toEqual(["#999-1000"]);
  });
});
