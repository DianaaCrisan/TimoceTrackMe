import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getTabCounts } from "./getTabCounts.server";

vi.mock("./getOrdersCount.server", () => ({ getOrdersCount: vi.fn() }));

const admin = {} as AdminApiContextWithoutRest;

describe("getTabCounts", () => {
  it("counts the Pending fulfillment and Unprinted tabs", async () => {
    const countOrders = vi.fn(async (_admin: unknown, filter: string) => ({
      count: filter === "unprinted" ? 4 : 12,
      isAtLeast: false,
    }));

    await expect(getTabCounts(admin, countOrders)).resolves.toEqual({
      pending_fulfillment: { count: 12, isAtLeast: false },
      unprinted: { count: 4, isAtLeast: false },
    });
    expect(countOrders).toHaveBeenCalledTimes(2);
  });

  it("leaves only the failed tab without a number", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const countOrders = vi.fn(async (_admin: unknown, filter: string) => {
      if (filter === "unprinted") throw new Error("throttled");
      return { count: 12, isAtLeast: false };
    });

    await expect(getTabCounts(admin, countOrders)).resolves.toEqual({
      pending_fulfillment: { count: 12, isAtLeast: false },
      unprinted: null,
    });
  });
});
