import { describe, expect, it } from "vitest";
import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";
import { planTagSync } from "./planTagSync";

describe("planTagSync", () => {
  it("tags an order that joined a pack", () => {
    expect(planTagSync("pachet-b", [])).toEqual({
      remove: [],
      add: ["pachet-b", PACKED_ORDER_TAG],
    });
  });

  it("swaps the old pack's tag for the new one on a move", () => {
    expect(planTagSync("pachet-b", ["pachet-a"])).toEqual({
      remove: ["pachet-a"],
      add: ["pachet-b", PACKED_ORDER_TAG],
    });
  });

  it("takes both tags off an order that left its pack", () => {
    expect(planTagSync(null, ["pachet-a"])).toEqual({
      remove: ["pachet-a", PACKED_ORDER_TAG],
      add: [],
    });
  });

  it("goes straight to the last pack after A → B → C", () => {
    expect(planTagSync("pachet-c", ["pachet-a", "pachet-b"])).toEqual({
      remove: ["pachet-a", "pachet-b"],
      add: ["pachet-c", PACKED_ORDER_TAG],
    });
  });

  it("never removes the tag of the pack the order came back to", () => {
    // A → B → A before the worker ran: A's tag is stale and wanted at once
    expect(planTagSync("pachet-a", ["pachet-a", "pachet-b"])).toEqual({
      remove: ["pachet-b"],
      add: ["pachet-a", PACKED_ORDER_TAG],
    });
  });

  it("removes a stale tag once even if it was recorded twice", () => {
    expect(planTagSync(null, ["pachet-a", "pachet-a"]).remove).toEqual([
      "pachet-a",
      PACKED_ORDER_TAG,
    ]);
  });
});
