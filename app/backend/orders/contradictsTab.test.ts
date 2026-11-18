import { describe, expect, it } from "vitest";
import { PRINTED_ORDER_TAG, ZIP_TO_FIX_ORDER_TAG } from "app/commons/constants";
import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";
import { contradictsTab, type OrderFacts } from "./contradictsTab";

const order = (overrides: Partial<OrderFacts> = {}): OrderFacts => ({
  tags: [],
  displayFulfillmentStatus: "UNFULFILLED",
  cancelledAt: null,
  ...overrides,
});

describe("contradictsTab", () => {
  it("flags an order on 'Not in a pack' that has been packed", () => {
    expect(
      contradictsTab(order({ tags: [PACKED_ORDER_TAG] }), "not_in_pack", null),
    ).toBe(true);
    expect(contradictsTab(order(), "not_in_pack", null)).toBe(false);
  });

  it("flags a shipped and printed order on 'Not in a pack'", () => {
    expect(
      contradictsTab(
        order({
          displayFulfillmentStatus: "FULFILLED",
          tags: [PRINTED_ORDER_TAG],
        }),
        "not_in_pack",
        null,
      ),
    ).toBe(true);
    // shipped but not printed: still has work left
    expect(
      contradictsTab(
        order({ displayFulfillmentStatus: "FULFILLED" }),
        "not_in_pack",
        null,
      ),
    ).toBe(false);
  });

  it("flags an order in a pack's list that has lost the pack's tag", () => {
    expect(contradictsTab(order(), "all", "pachet-a")).toBe(true);
    expect(
      contradictsTab(order({ tags: ["pachet-a"] }), "all", "pachet-a"),
    ).toBe(false);
  });

  it("flags a shipped order on 'Unfulfilled'", () => {
    const inPack = { tags: ["pachet-a"] };
    expect(
      contradictsTab(
        order({ ...inPack, displayFulfillmentStatus: "FULFILLED" }),
        "pending_fulfillment",
        "pachet-a",
      ),
    ).toBe(true);
    expect(
      contradictsTab(
        order({ ...inPack, displayFulfillmentStatus: "PARTIALLY_FULFILLED" }),
        "pending_fulfillment",
        "pachet-a",
      ),
    ).toBe(true);
    // a status the search may still count as unfulfilled is left alone
    expect(
      contradictsTab(
        order({ ...inPack, displayFulfillmentStatus: "ON_HOLD" }),
        "pending_fulfillment",
        "pachet-a",
      ),
    ).toBe(false);
  });

  it("flags a printed or cancelled order on 'Unprinted'", () => {
    expect(
      contradictsTab(order({ tags: [PRINTED_ORDER_TAG] }), "unprinted", null),
    ).toBe(true);
    expect(
      contradictsTab(
        order({ cancelledAt: "2026-11-18T10:00:00Z" }),
        "unprinted",
        null,
      ),
    ).toBe(true);
    expect(
      contradictsTab(
        order({ displayFulfillmentStatus: "FULFILLED" }),
        "unprinted",
        null,
      ),
    ).toBe(false);
  });

  it("flags an order on 'ZIP to fix' once its ZIP tag is gone or it shipped", () => {
    expect(contradictsTab(order(), "zip_to_fix", null)).toBe(true);
    expect(
      contradictsTab(
        order({
          tags: [ZIP_TO_FIX_ORDER_TAG],
          displayFulfillmentStatus: "FULFILLED",
        }),
        "zip_to_fix",
        null,
      ),
    ).toBe(true);
    expect(
      contradictsTab(
        order({ tags: [ZIP_TO_FIX_ORDER_TAG] }),
        "zip_to_fix",
        null,
      ),
    ).toBe(false);
  });

  it("flags an order on 'On hold' once the hold is released", () => {
    const inPack = { tags: ["pachet-a"] };
    expect(
      contradictsTab(
        order({ ...inPack, displayFulfillmentStatus: "ON_HOLD" }),
        "on_hold",
        "pachet-a",
      ),
    ).toBe(false);
    expect(
      contradictsTab(
        order({ ...inPack, displayFulfillmentStatus: "UNFULFILLED" }),
        "on_hold",
        "pachet-a",
      ),
    ).toBe(true);
  });

  it("never flags an order on 'All' that is in the pack", () => {
    expect(
      contradictsTab(
        order({
          tags: ["pachet-a", PRINTED_ORDER_TAG],
          displayFulfillmentStatus: "FULFILLED",
          cancelledAt: "2026-11-18T10:00:00Z",
        }),
        "all",
        "pachet-a",
      ),
    ).toBe(false);
  });
});
