import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type { SolvedOrdersResponse } from "../zip-solver/models/SolvedOrdersResponse";
import { ZipRecovery, type OrderWithZip } from "./ZipRecovery.server";

const admin = {} as AdminApiContextWithoutRest;
const SHOP_URL = "https://admin.shopify.com/store/timoce";

function solved(id: string, zipCode: string): SolvedOrdersResponse {
  return {
    processedOrdersSolvedZip: [
      { id, name: id, zipCode, confidenceLevel: "high", error: null },
    ],
    processedOrdersUnsolvedZip: [],
    unsupportedOrders: [],
  };
}

function unsolved(id: string, error: string | null): SolvedOrdersResponse {
  return {
    processedOrdersSolvedZip: [],
    processedOrdersUnsolvedZip: [
      { id, name: id, confidenceLevel: "low", error },
    ],
    unsupportedOrders: [],
  };
}

const order = (id: string, zip: string | null): OrderWithZip => ({
  id,
  shippingAddress: { zip },
});

describe("ZipRecovery.fillMissingZips", () => {
  it("solves every order without a ZIP in one call and patches them", async () => {
    const solveZips = vi.fn(async () => ({
      ...solved("a", "400001"),
      processedOrdersUnsolvedZip: [
        { id: "b", name: "b", confidenceLevel: "low", error: null },
      ],
    }));
    const recovery = new ZipRecovery(admin, SHOP_URL, solveZips);
    const orderA = order("a", null);
    const orderB = order("b", "");
    const orderC = order("c", "500001");

    await recovery.fillMissingZips([orderA, orderB, orderC]);

    expect(solveZips).toHaveBeenCalledTimes(1);
    expect(solveZips).toHaveBeenCalledWith(admin, SHOP_URL, ["a", "b"], false);
    expect(orderA.shippingAddress?.zip).toBe("400001");
    expect(recovery.getChange("a")).toEqual({
      previousZip: null,
      newZip: "400001",
      confidence: "high",
    });
    expect(orderB.shippingAddress?.zip).toBe("");
    expect(recovery.getMissingZipReason("b")).toBe(
      "no confident suggestion (confidence: low)",
    );
    expect(orderC.shippingAddress?.zip).toBe("500001");
  });

  it("makes no call when every order has a ZIP", async () => {
    const solveZips = vi.fn();
    const recovery = new ZipRecovery(admin, SHOP_URL, solveZips);

    await recovery.fillMissingZips([order("a", "400001")]);

    expect(solveZips).not.toHaveBeenCalled();
  });

  it("turns a solver failure into a reason instead of throwing", async () => {
    const recovery = new ZipRecovery(admin, SHOP_URL, async () => {
      throw new Error("service down");
    });

    await recovery.fillMissingZips([order("a", null)]);

    expect(recovery.getMissingZipReason("a")).toBe(
      "the ZIP solver failed: service down",
    );
  });

  it("does not trust a ZIP that could not be saved to Shopify", async () => {
    const recovery = new ZipRecovery(admin, SHOP_URL, async () => ({
      ...solved("a", "400001"),
      unsupportedOrders: [
        { id: "a", name: "a", errorStack: ["orderUpdate failed"] },
      ],
    }));
    const orderA = order("a", null);

    await recovery.fillMissingZips([orderA]);

    expect(orderA.shippingAddress?.zip).toBeNull();
    expect(recovery.getMissingZipReason("a")).toBe("orderUpdate failed");
  });
});

describe("ZipRecovery.retryAfterRejection", () => {
  it("re-solves a rejected ZIP, forcing the solver, and asks for a retry", async () => {
    const solveZips = vi.fn(async () => solved("a", "400002"));
    const recovery = new ZipRecovery(admin, SHOP_URL, solveZips);
    const orderA = order("a", "400001");

    await expect(recovery.retryAfterRejection(orderA)).resolves.toEqual({
      shouldRetry: true,
    });
    expect(solveZips).toHaveBeenCalledWith(admin, SHOP_URL, ["a"], true);
    expect(orderA.shippingAddress?.zip).toBe("400002");
    expect(recovery.getChange("a")).toMatchObject({
      previousZip: "400001",
      newZip: "400002",
    });
  });

  it("does not retry when the solver suggests the same ZIP", async () => {
    const recovery = new ZipRecovery(admin, SHOP_URL, async () =>
      solved("a", "400001"),
    );

    await expect(
      recovery.retryAfterRejection(order("a", "400001")),
    ).resolves.toEqual({
      shouldRetry: false,
      reason: "the ZIP solver suggests the same ZIP (400001)",
    });
    expect(recovery.getChange("a")).toBeUndefined();
  });

  it("does not retry when the ZIP cannot be solved", async () => {
    const recovery = new ZipRecovery(admin, SHOP_URL, async () =>
      unsolved("a", "street not found"),
    );

    await expect(
      recovery.retryAfterRejection(order("a", "400001")),
    ).resolves.toEqual({ shouldRetry: false, reason: "street not found" });
  });

  it("solves each order at most once per run", async () => {
    const solveZips = vi
      .fn()
      .mockResolvedValueOnce(solved("a", "400002"))
      .mockResolvedValueOnce(solved("a", "400003"));
    const recovery = new ZipRecovery(admin, SHOP_URL, solveZips);
    const orderA = order("a", "400001");

    await recovery.retryAfterRejection(orderA);
    const second = await recovery.retryAfterRejection(orderA);

    expect(solveZips).toHaveBeenCalledTimes(1);
    expect(second).toEqual({
      shouldRetry: false,
      reason: "ZIP 400002 was already solved automatically in this run",
    });
  });

  it("does not re-solve an order the pre-flight already solved", async () => {
    const solveZips = vi.fn(async () => solved("a", "400002"));
    const recovery = new ZipRecovery(admin, SHOP_URL, solveZips);
    const orderA = order("a", null);

    await recovery.fillMissingZips([orderA]);
    const decision = await recovery.retryAfterRejection(orderA);

    expect(solveZips).toHaveBeenCalledTimes(1);
    expect(decision.shouldRetry).toBe(false);
  });
});
