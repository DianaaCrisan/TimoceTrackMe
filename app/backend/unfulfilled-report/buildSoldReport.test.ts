import { describe, expect, it } from "vitest";
import type { SoldOrdersQuery } from "app/types/admin.generated";
import { buildSoldReport } from "./buildSoldReport";
import { parseSoldOrders, type SoldOrder } from "./fetchSoldOrders.server";

const PACK = { id: "pack-1", day: "2026-11-16", daySequence: 1 };
const NOW = new Date("2026-11-16T12:00:00Z");

const order = (
  orderName: string,
  methodType: string,
  items: [variantId: string | null, name: string, quantity: number][],
  isCancelled = false,
): SoldOrder => ({
  orderName,
  methodType,
  isCancelled,
  hasMoreItems: false,
  items: items.map(([variantId, name, quantity]) => ({
    variantId,
    name,
    quantity,
  })),
});

describe("buildSoldReport", () => {
  it("adds up what each pack order sold, delivery and pickup apart", () => {
    const report = buildSoldReport(
      [
        order("#1002", "SHIPPING", [["v1", "Mici - 1 kg", 2]]),
        order("#1001", "SHIPPING", [
          ["v1", "Mici - 1 kg", 3],
          [null, "Ambalare cadou", 1],
        ]),
        order("#1003", "PICK_UP", [["v2", "Antricot", 1]]),
      ],
      PACK,
      NOW,
    );

    expect(report.kind).toBe("sold");
    expect(report.pack).toEqual(PACK);
    expect(report.delivery.orderNames).toEqual(["#1001", "#1002"]);
    expect(report.delivery.rows).toEqual([
      { key: "name:Ambalare cadou", name: "Ambalare cadou", quantity: 1 },
      { key: "v1", name: "Mici - 1 kg", quantity: 5 },
    ]);
    expect(report.pickup.totalQuantity).toBe(1);
  });

  it("leaves out cancelled orders and orders with nothing left on them", () => {
    const report = buildSoldReport(
      [
        order("#1", "SHIPPING", [["v1", "A", 4]], true),
        order("#2", "SHIPPING", []),
      ],
      PACK,
      NOW,
    );

    expect(report.delivery.orderNames).toEqual([]);
    expect(report.delivery.totalQuantity).toBe(0);
  });
});

describe("parseSoldOrders", () => {
  it("drops removed items, deleted orders, and reads the delivery method", () => {
    const nodes = [
      null,
      {
        id: "gid://shopify/Order/1",
        name: "#1",
        cancelledAt: null,
        fulfillmentOrders: {
          nodes: [{ deliveryMethod: { methodType: "PICK_UP" } }],
        },
        lineItems: {
          nodes: [
            { name: "A", currentQuantity: 2, variant: { id: "v1" } },
            { name: "B", currentQuantity: 0, variant: { id: "v2" } },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
    ] as unknown as SoldOrdersQuery["nodes"];

    expect(parseSoldOrders(nodes)).toEqual([
      {
        orderName: "#1",
        methodType: "PICK_UP",
        isCancelled: false,
        items: [{ variantId: "v1", name: "A", quantity: 2 }],
        hasMoreItems: false,
      },
    ]);
  });
});
