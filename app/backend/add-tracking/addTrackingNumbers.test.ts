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
  tags: string[] = [],
): TrackingInputOrder {
  return {
    id,
    name: `#${id}`,
    phone: "0700000000",
    createdAt: "2026-11-13T10:00:00Z",
    tags,
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
          weightKg: 1,
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
    saveZip: vi.fn(async () => undefined),
    addZipToFixTag: vi.fn(async () => undefined),
    removeZipToFixTag: vi.fn(async () => undefined),
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
    run: (orderIds: string[], manualZips?: Record<string, string>) =>
      addTrackingNumbers(
        admin,
        SHOP_URL,
        { orderIds, manualZips },
        {
          getOrders: deps.getOrders,
          createAwb: deps.createAwb as never,
          addTrackingToFulfillment: deps.addTrackingToFulfillment,
          createZipRecovery: (a, s) => new ZipRecovery(a, s, deps.solveZips),
          saveZip: deps.saveZip,
          addZipToFixTag: deps.addZipToFixTag,
          removeZipToFixTag: deps.removeZipToFixTag,
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

const TAG = "cod-postal-de-corectat";
const unsolvable = (id: string): SolvedOrdersResponse => ({
  processedOrdersSolvedZip: [],
  processedOrdersUnsolvedZip: [
    { id, name: id, confidenceLevel: "low", error: null },
  ],
  unsupportedOrders: [],
});

describe("addTrackingNumbers: ZIP to fix tab", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("tags an order whose missing ZIP cannot be solved", async () => {
    const { deps, run } = setup([shippingOrder("1", null)], () =>
      unsolvable("1"),
    );

    const result = await run(["1"]);

    expect(result.failedOrders[0].isZipProblem).toBe(true);
    expect(deps.addZipToFixTag).toHaveBeenCalledWith(admin, SHOP_URL, "1");
  });

  it("tags an order whose ZIP Optimus still rejects after solving", async () => {
    const { deps, run } = setup([shippingOrder("1", "400001")], () =>
      solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValue(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"]);

    expect(result.failedOrders[0].isZipProblem).toBe(true);
    expect(deps.addZipToFixTag).toHaveBeenCalledTimes(1);
  });

  it("does not tag an order that already has the tag, or one failing for another reason", async () => {
    const { deps, run } = setup(
      [
        shippingOrder("1", null, undefined, [TAG]),
        shippingOrder("2", "400001"),
      ],
      () => unsolvable("1"),
    );
    deps.createAwb.mockRejectedValue(new Error("Invalid phone number"));

    const result = await run(["1", "2"]);

    expect(deps.addZipToFixTag).not.toHaveBeenCalled();
    expect(
      result.failedOrders.find((order) => order.id === "2")?.isZipProblem,
    ).toBe(false);
  });

  it("untags an order once tracking is added", async () => {
    const { deps, run } = setup(
      [
        shippingOrder("1", "400001", undefined, [TAG]),
        shippingOrder("2", "400002"),
      ],
      () => solved("1", "400001"),
    );

    await run(["1", "2"]);

    expect(deps.removeZipToFixTag).toHaveBeenCalledTimes(1);
    expect(deps.removeZipToFixTag).toHaveBeenCalledWith(admin, SHOP_URL, "1");
  });

  it("reports a tag that could not be added on the failed order", async () => {
    const { deps, run } = setup([shippingOrder("1", null)], () =>
      unsolvable("1"),
    );
    deps.addZipToFixTag.mockRejectedValue(new Error("throttled"));

    const result = await run(["1"]);

    expect(result.failedOrders[0].errors.at(-1)).toContain("throttled");
  });
});

describe("addTrackingNumbers: ZIPs entered by hand", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("saves the typed ZIP and uses it for the AWB, without the solver", async () => {
    const { deps, run } = setup(
      [shippingOrder("1", null, undefined, [TAG])],
      () => solved("1", "999999"),
    );

    const result = await run(["1"], { "1": "400 123" });

    expect(deps.saveZip).toHaveBeenCalledWith(admin, SHOP_URL, "1", "400123");
    expect(deps.solveZips).not.toHaveBeenCalled();
    expect(deps.createAwb.mock.calls[0][0].zip).toBe("400123");
    expect(result.successfulOrders[0].zipChange).toEqual({
      previousZip: null,
      newZip: "400123",
      isEnteredByHand: true,
    });
    expect(deps.removeZipToFixTag).toHaveBeenCalledWith(admin, SHOP_URL, "1");
  });

  it("never re-solves a typed ZIP that Optimus rejects, and keeps the order on the tab", async () => {
    const { deps, run } = setup(
      [shippingOrder("1", "400001", undefined, [TAG])],
      () => solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValue(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"], { "1": "400003" });

    expect(deps.solveZips).not.toHaveBeenCalled();
    expect(deps.createAwb).toHaveBeenCalledTimes(1);
    expect(result.failedOrders[0]).toMatchObject({
      isZipProblem: true,
      zipChange: { previousZip: "400001", newZip: "400003" },
      errors: [
        expect.stringContaining(
          "Optimus rejected ZIP 400003, which was entered by hand",
        ),
      ],
    });
    expect(deps.removeZipToFixTag).not.toHaveBeenCalled();
  });

  it("creates no AWB when the typed ZIP cannot be saved", async () => {
    const { deps, run } = setup([shippingOrder("1", null)], () =>
      solved("1", "400002"),
    );
    deps.saveZip.mockRejectedValue(new Error("orderUpdate failed"));

    const result = await run(["1"], { "1": "400003" });

    expect(deps.createAwb).not.toHaveBeenCalled();
    expect(result.failedOrders).toEqual([
      {
        id: "1",
        name: "#1",
        errors: ["Could not save ZIP 400003 to the order: orderUpdate failed"],
        isZipProblem: true,
      },
    ]);
  });

  it("does not save a typed ZIP equal to the current one, but still skips the solver", async () => {
    const { deps, run } = setup([shippingOrder("1", "400001")], () =>
      solved("1", "400002"),
    );
    deps.createAwb.mockRejectedValueOnce(OPTIMUS_ZIP_ERROR);

    const result = await run(["1"], { "1": "400001" });

    expect(deps.saveZip).not.toHaveBeenCalled();
    expect(deps.solveZips).not.toHaveBeenCalled();
    expect(result.failedOrders[0].isZipProblem).toBe(true);
  });
});

describe("addTrackingNumbers: parcels by weight", () => {
  const FULFILLMENT_ORDER_ID = "gid://shopify/FulfillmentOrder/11";
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  /** An order with one line item: `quantity` units of `unitWeightKg` each. */
  function heavyOrder(quantity: number, unitWeightKg: number) {
    const order = shippingOrder("1", "400001", [FULFILLMENT_ORDER_ID]);
    order.fulfillmentOrders[0].lineItems[0] = {
      ...order.fulfillmentOrders[0].lineItems[0],
      remainingQuantity: quantity,
      weightKg: unitWeightKg,
    };
    return order;
  }

  function runWithLimit(
    order: TrackingInputOrder,
    autoSplitHeavyOrders: boolean,
    deps: ReturnType<typeof setup>["deps"],
  ) {
    return addTrackingNumbers(
      admin,
      SHOP_URL,
      {
        orderIds: [order.id],
        parcelWeight: { parcelWeightLimitKg: 25, autoSplitHeavyOrders },
      },
      {
        getOrders: deps.getOrders,
        createAwb: deps.createAwb as never,
        addTrackingToFulfillment: deps.addTrackingToFulfillment,
        createZipRecovery: (a, s) => new ZipRecovery(a, s, deps.solveZips),
        saveZip: deps.saveZip,
        addZipToFixTag: deps.addZipToFixTag,
        removeZipToFixTag: deps.removeZipToFixTag,
      },
    );
  }

  type AwbCall = { weightKg: number; parcelPosition?: string };
  const awbCalls = (deps: ReturnType<typeof setup>["deps"]) =>
    deps.createAwb.mock.calls.map(([request]) => {
      const { weightKg, parcelPosition, invoiceDetails } =
        request as unknown as AwbCall & { invoiceDetails: string };
      return { weightKg, parcelPosition, invoiceDetails };
    });

  it("splits a fulfillment over the limit into parcels, one AWB and fulfillment each", async () => {
    const order = heavyOrder(3, 10);
    const { deps } = setup([order], () => solved("1", "400001"));

    const result = await runWithLimit(order, true, deps);

    expect(awbCalls(deps)).toEqual([
      {
        weightKg: 20,
        parcelPosition: "1/2",
        invoiceDetails: "Comanda #1 (colet 1/2)",
      },
      {
        weightKg: 10,
        parcelPosition: "2/2",
        invoiceDetails: "Comanda #1 (colet 2/2)",
      },
    ]);
    expect(
      deps.addTrackingToFulfillment.mock.calls.map(
        (call) => (call as unknown[])[2],
      ),
    ).toEqual([
      {
        fulfillmentOrderId: FULFILLMENT_ORDER_ID,
        fulfillmentOrderLineItems: [
          { id: `${FULFILLMENT_ORDER_ID}-li`, quantity: 2 },
        ],
        trackingNumber: "AWB1",
      },
      {
        fulfillmentOrderId: FULFILLMENT_ORDER_ID,
        fulfillmentOrderLineItems: [
          { id: `${FULFILLMENT_ORDER_ID}-li`, quantity: 1 },
        ],
        trackingNumber: "AWB2",
      },
    ]);
    expect(result.successfulOrders[0].trackingNumbers).toEqual([
      "AWB1",
      "AWB2",
    ]);
    expect(result.successfulOrders[0].weightWarnings).toBeUndefined();
  });

  it("ships one parcel with a warning when auto split is off", async () => {
    const order = heavyOrder(3, 10);
    const { deps } = setup([order], () => solved("1", "400001"));

    const result = await runWithLimit(order, false, deps);

    expect(awbCalls(deps)).toEqual([
      { weightKg: 30, parcelPosition: undefined, invoiceDetails: "Comanda #1" },
    ]);
    expect(result.successfulOrders[0].weightWarnings).toEqual([
      "Fulfillment 11 weighs 30 kg, over the 25 kg limit. Auto split is off, so it ships as one parcel.",
    ]);
  });

  it("warns about a single item heavier than the limit", async () => {
    const order = heavyOrder(1, 30);
    const { deps } = setup([order], () => solved("1", "400001"));

    const result = await runWithLimit(order, true, deps);

    expect(deps.createAwb).toHaveBeenCalledTimes(1);
    expect(result.successfulOrders[0].weightWarnings).toEqual([
      'Fulfillment 11: "Mușchi vită" alone weighs 30 kg, over the 25 kg limit, so it ships in a parcel of its own.',
    ]);
  });

  it("numbers parcels across the order's fulfillment orders", async () => {
    const order = shippingOrder("1", "400001", ["1-fo1", "1-fo2"]);
    const { deps } = setup([order], () => solved("1", "400001"));

    await runWithLimit(order, true, deps);

    expect(awbCalls(deps).map((call) => call.parcelPosition)).toEqual([
      "1/2",
      "2/2",
    ]);
  });

  it("stops at the first parcel that fails, keeping the ones already shipped", async () => {
    const order = heavyOrder(3, 20);
    const { deps } = setup([order], () => solved("1", "400001"));
    deps.createAwb
      .mockResolvedValueOnce({ trackingNumber: "AWB1" })
      .mockRejectedValueOnce(new Error("Optimus is down"));

    const result = await runWithLimit(order, true, deps);

    expect(deps.createAwb).toHaveBeenCalledTimes(2);
    expect(deps.addTrackingToFulfillment).toHaveBeenCalledTimes(1);
    expect(result.failedOrders[0].errors).toEqual([
      "1 of 3 parcels were shipped (AWB1). Add tracking again to ship the rest.",
      "Parcel 2/3 (fulfillment 11): Optimus is down",
    ]);
  });

  it("creates no AWB when an item has no weight", async () => {
    const order = heavyOrder(1, 0);
    const { deps } = setup([order], () => solved("1", "400001"));

    const result = await runWithLimit(order, true, deps);

    expect(deps.createAwb).not.toHaveBeenCalled();
    expect(result.failedOrders[0].errors).toEqual([
      'Fulfillment 11: missing or invalid weight for item "Mușchi vită".',
    ]);
  });
});
