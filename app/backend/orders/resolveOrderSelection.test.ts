import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ORDERS_PER_JOB } from "app/commons/constants";
import { appendOrderSelection } from "app/commons/orders/OrderSelection";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { RequestError } from "../core/errors/RequestError";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import {
  parseOrderSelection,
  resolveOrderIds,
} from "./resolveOrderSelection.server";

vi.mock("../graphql/throttle-handling/helpers/runGraphQL", () => ({
  runGraphQL: vi.fn(),
}));

const admin = {} as AdminApiContextWithoutRest;
const SHOP_URL = "https://admin.shopify.com/store/timoce";
const orderGid = (n: number) => `gid://shopify/Order/${n}`;

function ordersPage(ids: number[], endCursor: string | null) {
  return {
    orders: {
      nodes: ids.map((n) => ({ id: orderGid(n) })),
      pageInfo: { hasNextPage: endCursor !== null, endCursor },
    },
  };
}

describe("parseOrderSelection", () => {
  it("reads ticked orders, dropping duplicates", () => {
    const formData = new FormData();
    appendOrderSelection(formData, {
      mode: "ids",
      orderIds: [orderGid(1), orderGid(2), orderGid(1)],
    });

    expect(parseOrderSelection(formData)).toEqual({
      mode: "ids",
      orderIds: [orderGid(1), orderGid(2)],
    });
  });

  it("refuses anything that is not an order ID", () => {
    const formData = new FormData();
    appendOrderSelection(formData, {
      mode: "ids",
      orderIds: ["gid://shopify/Product/1"],
    });

    expect(() => parseOrderSelection(formData)).toThrow(RequestError);
  });

  it("reads a whole-tab selection", () => {
    const formData = new FormData();
    appendOrderSelection(formData, {
      mode: "filter",
      filter: "pending_fulfillment",
    });

    expect(parseOrderSelection(formData)).toEqual({
      mode: "filter",
      filter: "pending_fulfillment",
    });
  });
});

describe("resolveOrderIds", () => {
  beforeEach(() => {
    vi.mocked(runGraphQL).mockReset();
  });

  it("returns ticked orders as they are", async () => {
    const orderIds = [orderGid(1), orderGid(2)];

    await expect(
      resolveOrderIds(admin, SHOP_URL, { mode: "ids", orderIds }),
    ).resolves.toEqual(orderIds);
    expect(runGraphQL).not.toHaveBeenCalled();
  });

  it("pages through every order in the tab, using the tab's search query", async () => {
    vi.mocked(runGraphQL)
      .mockResolvedValueOnce(ordersPage([1, 2], "cursor-1"))
      .mockResolvedValueOnce(ordersPage([3], null));

    await expect(
      resolveOrderIds(admin, SHOP_URL, {
        mode: "filter",
        filter: "pending_fulfillment",
      }),
    ).resolves.toEqual([orderGid(1), orderGid(2), orderGid(3)]);

    const variables = vi.mocked(runGraphQL).mock.calls.map((call) => call[4]);
    expect(variables).toEqual([
      { first: 250, after: null, query: "fulfillment_status:unfulfilled" },
      {
        first: 250,
        after: "cursor-1",
        query: "fulfillment_status:unfulfilled",
      },
    ]);
  });

  it("refuses an empty selection", async () => {
    vi.mocked(runGraphQL).mockResolvedValueOnce(ordersPage([], null));

    await expect(
      resolveOrderIds(admin, SHOP_URL, { mode: "filter", filter: "all" }),
    ).rejects.toThrow('No orders match the "All" tab.');
    await expect(
      resolveOrderIds(admin, SHOP_URL, { mode: "ids", orderIds: [] }),
    ).rejects.toThrow("No orders were selected.");
  });

  it("stops paging once past the cap and refuses the selection", async () => {
    const pageOf250 = (start: number) =>
      Array.from({ length: 250 }, (_, i) => start + i);
    vi.mocked(runGraphQL).mockImplementation(async (...args) => {
      const after = (args[4] as { after: string | null }).after;
      const page = after === null ? 0 : Number(after);
      return ordersPage(pageOf250(page * 250), String(page + 1));
    });

    await expect(
      resolveOrderIds(admin, SHOP_URL, { mode: "filter", filter: "all" }),
    ).rejects.toThrow(`at most ${MAX_ORDERS_PER_JOB} orders`);
    // 5 pages reach 1,250 IDs, the first count past 1,000
    expect(runGraphQL).toHaveBeenCalledTimes(5);
  });
});
