import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type { PrintedLabelUnit } from "./GroupedPdfComposer";
import { markLabelsPrinted } from "./markLabelsPrinted.server";
import { LabelUnitKind } from "./models/LabelUnitKind";

const admin = {} as AdminApiContextWithoutRest;
const SHOP_URL = "https://admin.shopify.com/store/timoce";
const NOW = new Date("2026-11-13T12:00:00Z");

const delivery = (
  orderId: string,
  fulfillmentId: string,
): PrintedLabelUnit => ({
  orderId,
  unitId: fulfillmentId,
  displayName: `${orderId}-${fulfillmentId}`,
  kind: LabelUnitKind.DELIVERY,
});

const pickup = (orderId: string): PrintedLabelUnit => ({
  orderId,
  unitId: `gid://shopify/FulfillmentOrder/${orderId}`,
  displayName: "Pickup",
  kind: LabelUnitKind.PICKUP,
});

function fakeDeps() {
  return {
    addLabelPrintedEvent: vi.fn(
      async (_fulfillmentId: string, _happenedAt: Date): Promise<void> =>
        undefined,
    ),
    addPrintedTag: vi.fn(async (_orderId: string): Promise<void> => undefined),
    now: () => NOW,
  };
}

describe("markLabelsPrinted", () => {
  it("adds an event per delivery fulfillment and one tag per order", async () => {
    const deps = fakeDeps();

    const { failuresByOrderId } = await markLabelsPrinted(
      admin,
      SHOP_URL,
      [delivery("o1", "f1"), delivery("o1", "f2"), pickup("o2")],
      deps,
    );

    expect(failuresByOrderId.size).toBe(0);
    expect(deps.addLabelPrintedEvent.mock.calls).toEqual([
      ["f1", NOW],
      ["f2", NOW],
    ]);
    expect(deps.addPrintedTag.mock.calls.map((call) => call[0])).toEqual([
      "o1",
      "o2",
    ]);
  });

  it("gives pickup orders only the tag, since they have no fulfillment yet", async () => {
    const deps = fakeDeps();

    await markLabelsPrinted(admin, SHOP_URL, [pickup("o2")], deps);

    expect(deps.addLabelPrintedEvent).not.toHaveBeenCalled();
    expect(deps.addPrintedTag).toHaveBeenCalledWith("o2");
  });

  it("returns failures per order instead of throwing, and keeps marking the rest", async () => {
    const deps = fakeDeps();
    deps.addLabelPrintedEvent.mockImplementation(async (fulfillmentId) => {
      if (fulfillmentId === "f1") throw new Error("Fulfillment not found");
    });
    deps.addPrintedTag.mockImplementation(async (orderId) => {
      if (orderId === "o1") throw new Error("throttled");
    });

    const { failuresByOrderId } = await markLabelsPrinted(
      admin,
      SHOP_URL,
      [delivery("o1", "f1"), delivery("o3", "f3")],
      deps,
    );

    expect(Object.fromEntries(failuresByOrderId)).toEqual({
      o1: [
        "Could not mark o1-f1 as printed: Fulfillment not found",
        'Could not add the "eticheta-printata" tag: throttled',
      ],
    });
    expect(deps.addLabelPrintedEvent).toHaveBeenCalledWith("f3", NOW);
    expect(deps.addPrintedTag).toHaveBeenCalledWith("o3");
  });
});
