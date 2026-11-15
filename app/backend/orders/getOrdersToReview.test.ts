import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { getOrdersToReview } from "./getOrdersToReview.server";

vi.mock("../graphql/throttle-handling/helpers/runGraphQL", () => ({
  runGraphQL: vi.fn(),
}));

const admin = {} as AdminApiContextWithoutRest;
const gid = (n: number) => `gid://shopify/Order/${n}`;
const WARN_ONLY = { parcelWeightLimitKg: 25, autoSplitHeavyOrders: false };

type FakeOrder = {
  note?: string;
  attributes?: { key: string; value: string }[];
  grams?: number;
  methodType?: string;
};

function mockOrders(ordersByNumber: Record<number, FakeOrder>) {
  vi.mocked(runGraphQL).mockImplementation(async (...args) => {
    const ids = (args[4] as { ids: string[] }).ids;
    return {
      nodes: ids.map((id) => {
        const order = ordersByNumber[Number(id.split("/").pop())] ?? {};
        return {
          id,
          name: `#${id.split("/").pop()}`,
          note: order.note ?? null,
          customAttributes: order.attributes ?? [],
          currentTotalWeight: String(order.grams ?? 1000),
          fulfillmentOrders: {
            nodes: [
              {
                deliveryMethod: { methodType: order.methodType ?? "SHIPPING" },
              },
            ],
          },
          customer: { displayName: "Ana Pop" },
        };
      }),
    } as never;
  });
}

describe("getOrdersToReview", () => {
  beforeEach(() => {
    vi.mocked(runGraphQL).mockReset();
  });

  it("returns only orders with a note, reading 50 orders per call", async () => {
    mockOrders({
      2: { note: "Nu sunați, scrieți SMS" },
      60: { attributes: [{ key: "Etaj", value: "4" }] },
    });

    const orderIds = Array.from({ length: 60 }, (_, index) => gid(index + 1));
    const result = await getOrdersToReview(admin, "shop", orderIds, WARN_ONLY);

    expect(runGraphQL).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        id: gid(2),
        name: "#2",
        customerName: "Ana Pop",
        note: "Nu sunați, scrieți SMS",
        attributes: [],
        weightKg: 1,
        shipsOverWeightLimit: false,
      },
      {
        id: gid(60),
        name: "#60",
        customerName: "Ana Pop",
        note: null,
        attributes: [{ key: "Etaj", value: "4" }],
        weightKg: 1,
        shipsOverWeightLimit: false,
      },
    ]);
  });

  it("returns shipping orders over the weight limit while auto split is off", async () => {
    mockOrders({
      1: { grams: 30_000 },
      2: { grams: 30_000, methodType: "PICK_UP" },
      3: { grams: 20_000 },
    });

    const result = await getOrdersToReview(
      admin,
      "shop",
      [gid(1), gid(2), gid(3)],
      WARN_ONLY,
    );

    expect(
      result.map((order) => [order.name, order.shipsOverWeightLimit]),
    ).toEqual([["#1", true]]);
    expect(result[0].weightKg).toBe(30);
  });

  it("leaves heavy orders out when auto split will handle them", async () => {
    mockOrders({ 1: { grams: 30_000 } });

    const result = await getOrdersToReview(admin, "shop", [gid(1)], {
      ...WARN_ONLY,
      autoSplitHeavyOrders: true,
    });

    expect(result).toEqual([]);
  });
});
