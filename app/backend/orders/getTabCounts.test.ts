import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import {
  ORDERS_DASHBOARD_FILTERS,
  PACK_DASHBOARD_FILTERS,
} from "app/commons/orders/OrdersDashboardFilter";
import { getTabCounts } from "./getTabCounts.server";

vi.mock("./getOrdersCount.server", () => ({ getOrdersCount: vi.fn() }));

const admin = {} as AdminApiContextWithoutRest;

describe("getTabCounts", () => {
  it("counts every counted tab the page shows", async () => {
    const countOrders = vi.fn(async (_admin: unknown, filter: string) => ({
      count: filter === "unprinted" ? 4 : filter === "zip_to_fix" ? 3 : 12,
      isAtLeast: false,
    }));

    await expect(
      getTabCounts(admin, {
        filters: ORDERS_DASHBOARD_FILTERS,
        countOrders,
      }),
    ).resolves.toEqual({
      pending_fulfillment: { count: 12, isAtLeast: false },
      zip_to_fix: { count: 3, isAtLeast: false },
      unprinted: { count: 4, isAtLeast: false },
      not_in_pack: { count: 12, isAtLeast: false },
    });
    expect(countOrders).toHaveBeenCalledTimes(4);
  });

  it("inside a pack, counts only the pack's orders and skips Not in a pack", async () => {
    const countOrders = vi.fn(async () => ({ count: 2, isAtLeast: false }));

    const counts = await getTabCounts(admin, {
      filters: PACK_DASHBOARD_FILTERS,
      packTag: "pachet-2026-11-14-1",
      countOrders,
    });

    expect(Object.keys(counts)).toEqual([
      "pending_fulfillment",
      "zip_to_fix",
      "unprinted",
    ]);
    expect(countOrders).toHaveBeenCalledWith(
      admin,
      "unprinted",
      "pachet-2026-11-14-1",
    );
  });

  it("leaves only the failed tab without a number", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const countOrders = vi.fn(async (_admin: unknown, filter: string) => {
      if (filter === "unprinted") throw new Error("throttled");
      return { count: 12, isAtLeast: false };
    });

    await expect(
      getTabCounts(admin, { filters: PACK_DASHBOARD_FILTERS, countOrders }),
    ).resolves.toEqual({
      pending_fulfillment: { count: 12, isAtLeast: false },
      zip_to_fix: { count: 12, isAtLeast: false },
      unprinted: null,
    });
  });
});
