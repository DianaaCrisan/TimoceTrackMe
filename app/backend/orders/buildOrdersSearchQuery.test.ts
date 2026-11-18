import { describe, expect, it } from "vitest";
import {
  getFilterJobs,
  PACK_DASHBOARD_FILTERS,
  parseOrdersDashboardFilter,
} from "app/commons/orders/OrdersDashboardFilter";
import {
  buildOrdersSearchQuery,
  buildPackDoneQuery,
} from "./buildOrdersSearchQuery";

describe("buildOrdersSearchQuery", () => {
  it("finds orders ready to print and not printed yet, pickup orders from the start", () => {
    expect(buildOrdersSearchQuery("unprinted")).toBe(
      "tag_not:eticheta-printata AND NOT status:cancelled AND " +
        "(fulfillment_status:fulfilled OR fulfillment_status:partial OR " +
        "delivery_method:pick-up)",
    );
  });

  it("finds orders whose ZIP stopped add tracking and that still need shipping", () => {
    expect(buildOrdersSearchQuery("zip_to_fix")).toBe(
      "tag:cod-postal-de-corectat AND NOT status:cancelled AND " +
        "(fulfillment_status:unfulfilled OR fulfillment_status:partial)",
    );
  });

  it("finds orders on hold, inside the pack", () => {
    expect(buildOrdersSearchQuery("on_hold", "pachet-2026-11-14-1")).toBe(
      "tag:pachet-2026-11-14-1 AND " +
        "(fulfillment_status:on_hold AND NOT status:cancelled)",
    );
  });

  it("keeps the other tabs as they were", () => {
    expect(buildOrdersSearchQuery("all")).toBeNull();
    expect(buildOrdersSearchQuery("pending_fulfillment")).toBe(
      "fulfillment_status:unfulfilled",
    );
  });
});

describe("buildOrdersSearchQuery: Not in a pack", () => {
  it("finds unpacked orders that still need shipping or a printed label", () => {
    expect(buildOrdersSearchQuery("not_in_pack")).toBe(
      "tag_not:in-pachet AND NOT status:cancelled AND " +
        "(fulfillment_status:unfulfilled OR fulfillment_status:partial OR " +
        "tag_not:eticheta-printata)",
    );
  });
});

describe("buildOrdersSearchQuery: inside a pack", () => {
  const PACK_TAG = "pachet-2026-11-14-2";

  it("limits a tab to the pack's orders", () => {
    expect(buildOrdersSearchQuery("pending_fulfillment", PACK_TAG)).toBe(
      "tag:pachet-2026-11-14-2 AND (fulfillment_status:unfulfilled)",
    );
  });

  it("makes All the pack's orders", () => {
    expect(buildOrdersSearchQuery("all", PACK_TAG)).toBe(
      "tag:pachet-2026-11-14-2",
    );
  });
});

describe("buildPackDoneQuery", () => {
  it("counts cancelled orders, and fulfilled ones printed or picked up", () => {
    expect(buildPackDoneQuery("pachet-2026-11-14-2")).toBe(
      "tag:pachet-2026-11-14-2 AND (status:cancelled OR " +
        "(fulfillment_status:fulfilled AND " +
        "(tag:eticheta-printata OR delivery_method:pick-up)))",
    );
  });
});

describe("parseOrdersDashboardFilter", () => {
  it("falls back to the default for a tab the scope does not show", () => {
    expect(
      parseOrdersDashboardFilter("not_in_pack", PACK_DASHBOARD_FILTERS),
    ).toBe("pending_fulfillment");
    expect(parseOrdersDashboardFilter("not_in_pack")).toBe("not_in_pack");
  });

  it("accepts every tab and falls back to Pending fulfillment", () => {
    expect(parseOrdersDashboardFilter("unprinted")).toBe("unprinted");
    expect(parseOrdersDashboardFilter("zip_to_fix")).toBe("zip_to_fix");
    expect(parseOrdersDashboardFilter("pending_fulfillment")).toBe(
      "pending_fulfillment",
    );
    expect(parseOrdersDashboardFilter("all")).toBe("all");
    expect(parseOrdersDashboardFilter("nonsense")).toBe("pending_fulfillment");
    expect(parseOrdersDashboardFilter(null)).toBe("pending_fulfillment");
  });
});

describe("getFilterJobs", () => {
  it("offers only the next step in the working tabs", () => {
    expect(getFilterJobs("pending_fulfillment")).toEqual(["add-tracking"]);
    expect(getFilterJobs("zip_to_fix")).toEqual(["add-tracking"]);
    expect(getFilterJobs("unprinted")).toEqual(["print-labels"]);
    expect(getFilterJobs("all")).toEqual(["add-tracking", "print-labels"]);
    // add tracking skips an order on hold: nothing to offer until released
    expect(getFilterJobs("on_hold")).toEqual([]);
  });
});
