import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type { SolvedOrdersResponse } from "../zip-solver/models/SolvedOrdersResponse";
import { addTrackingNumbers } from "./addTrackingNumbers.server";
import type { TrackingInputOrder } from "./getOrdersTrackingInputData.server";
import { ZipRecovery } from "./ZipRecovery.server";

const admin = {} as AdminApiContextWithoutRest;
const SHOP_URL = "https://admin.shopify.com/store/timoce";
const OPTIMUS_ZIP_ERROR = new Error(
  "Failed to generate tracking number via Optimus for order #1001: Invalid delivery zip code",
);

function shippingOrder(
  id: string,
  zip: string | null,
  fulfillmentOrderIds: string[] = [`${id}-fo1`],
): TrackingInputOrder {
  return {
    id,
    name: `#${id}`,
    phone: "0700000000",
    createdAt: "2026-11-13T10:00:00Z",
    shippingAddress: {
      address1: "Strada Lunga 1",
      city: "Cluj-Napoca",
      province: "Cluj",
      country: "Romania",
      zip,
      formatted: [],
      name: "Ion Pop",
      phone: "0700000000",
    },
    fulfillmentOrders: fulfillmentOrderIds.map((foId) => ({
      id: foId,
      status: "OPEN",
      deliveryMethod: "SHIPPING",
      lineItems: [
        {
          fulfillmentOrderLineItemId: `${foId}-li`,
          orderLineItemId: "li",
          name: "Mușchi vită",
          remainingQuantity: 1,
          weight: 1,
        },
      ],
    })),
  };
}

function solved(id: string, zipCode: string): SolvedOrdersResponse {
  return {
    processedOrdersSolvedZip: [
      { id, name: id, zipCode, confidenceLevel: "high", error: null },
    ],
    processedOrdersUnsolvedZip: [],
    unsupportedOrders: [],
  };
}

function setup(
  orders: TrackingInputOrder[],
  solveZips: (orderIds: string[], solveAll: boolean) => SolvedOrdersResponse,
) {
  let awbCounter = 0;
  const deps = {
    getOrders: vi.fn(async () => orders),
    createAwb: vi.fn(async (_request: { zip: string }) => ({
      trackingNumber: `AWB${++awbCounter}`,
    })),
    addTrackingToFulfillment: vi.fn(async () => undefined),
    solveZips: vi.fn(
      async (
        _admin: AdminApiContextWithoutRest,
        _shopUrl: string,
        orderIds: string[],
        solveAll: boolean,
      ) => solveZips(orderIds, solveAll),
    ),
  };

  return {
    deps,
    run: (orderIds: string[]) =>
      addTrackingNumbers(
        admin,
        SHOP_URL,
        { orderIds },
        {
          getOrders: deps.getOrders,
          createAwb: deps.createAwb as never,
          addTrackingToFulfillment: deps.addTrackingToFulfillment,
          createZipRecovery: (a, s) => new ZipRecovery(a, s, deps.solveZips),
        },
      ),
  };
}

describe("addTrackingNumbers: automatic ZIP solving", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("solves a missing ZIP before creating the AWB", async () => {
    const { deps, run } = setup([shippingOrder("1", null)], () =>
      solved("1", "400001"),
    );

    const result = await run(["1"]);

    expect(deps.solveZips).toHaveBeenCalledWith(admin, SHOP_URL, ["1"], false);
    expect(deps.createAwb.mock.calls[0][0].zip).toBe("400001");
    expect(result.successfulOrders).toEqual([
      {
        id: "1",
        name: "#1",
        trackingNumbers: ["AWB1"],
        zipChange: { previousZip: null, newZip: "400001", confidence: "high" },
      },
    ]);
  });

  it("fails an order whose missing ZIP cannot be solved, without calling Optimus", async () => {
    const { deps, run } = setup([shippingOrder("1", null)], () => ({
      processedOrdersSolvedZip: [],
      processedOrdersUnsolvedZip: [
        { id: "1", name: "#1", confidenceLevel: "low", error: null },
      ],
      unsupportedOrders: [],
    }));

    const result = await run(["1"]);

    expect(deps.createAwb).not.toHaveBeenCalled();
    expect(result.failedOrders[0].errors).toEqual([
      "Missing shipping ZIP code, and it could not be solved automatically: no confident suggestion (confidence: low).",
    ]);
  });

  it("re-solves and retries once when Optimus rejects the ZIP", async () => {
    const { deps, run } = setup([shippingOrder("1", "400001")], () =>
      solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValueOnce(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"]);

    expect(deps.solveZips).toHaveBeenCalledWith(admin, SHOP_URL, ["1"], true);
    expect(deps.createAwb.mock.calls.map((call) => call[0].zip)).toEqual([
      "400001",
      "400002",
    ]);
    expect(result.successfulOrders[0]).toMatchObject({
      trackingNumbers: ["AWB1"],
      zipChange: { previousZip: "400001", newZip: "400002" },
    });
  });

  it("uses the solved ZIP for the order's later fulfillment orders without solving again", async () => {
    const { deps, run } = setup(
      [shippingOrder("1", "400001", ["fo1", "fo2"])],
      () => solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValueOnce(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"]);

    expect(deps.solveZips).toHaveBeenCalledTimes(1);
    expect(deps.createAwb.mock.calls.map((call) => call[0].zip)).toEqual([
      "400001",
      "400002",
      "400002",
    ]);
    expect(result.successfulOrders[0].trackingNumbers).toHaveLength(2);
  });

  it("does not retry a second time when Optimus rejects the solved ZIP too", async () => {
    const { deps, run } = setup([shippingOrder("1", "400001")], () =>
      solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValue(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"]);

    expect(deps.createAwb).toHaveBeenCalledTimes(2);
    expect(deps.solveZips).toHaveBeenCalledTimes(1);
    expect(result.failedOrders[0]).toMatchObject({
      zipChange: { newZip: "400002" },
      errors: [expect.stringContaining("Invalid delivery zip code")],
    });
  });

  it("does not retry when the solver suggests the same ZIP", async () => {
    const { deps, run } = setup([shippingOrder("1", "400001")], () =>
      solved("1", "400001"),
    );
    deps.createAwb.mockRejectedValueOnce(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"]);

    expect(deps.createAwb).toHaveBeenCalledTimes(1);
    expect(result.failedOrders[0].errors[0]).toContain(
      "Optimus rejected ZIP 400001, and it could not be solved automatically: the ZIP solver suggests the same ZIP (400001).",
    );
  });

  it("does not touch ZIPs for other Optimus errors", async () => {
    const { deps, run } = setup([shippingOrder("1", "400001")], () =>
      solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValueOnce(new Error("Invalid phone number"));

    const result = await run(["1"]);

    expect(deps.solveZips).not.toHaveBeenCalled();
    expect(result.failedOrders[0].errors[0]).toContain("Invalid phone number");
  });
});
