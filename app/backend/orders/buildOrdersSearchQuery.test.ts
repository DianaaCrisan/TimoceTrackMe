import { describe, expect, it } from "vitest";
import { parseOrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import { buildOrdersSearchQuery } from "./buildOrdersSearchQuery";

describe("buildOrdersSearchQuery", () => {
  it("finds orders ready to print and not printed yet", () => {
    expect(buildOrdersSearchQuery("unprinted")).toBe(
      "tag_not:eticheta-printata AND NOT status:cancelled AND " +
        "(fulfillment_status:fulfilled OR fulfillment_status:partial)",
    );
  });

  it("keeps the other tabs as they were", () => {
    expect(buildOrdersSearchQuery("all")).toBeNull();
    expect(buildOrdersSearchQuery("pending_fulfillment")).toBe(
      "fulfillment_status:unfulfilled",
    );
  });
});

describe("parseOrdersDashboardFilter", () => {
  it("accepts every tab and falls back to Pending fulfillment", () => {
    expect(parseOrdersDashboardFilter("unprinted")).toBe("unprinted");
    expect(parseOrdersDashboardFilter("pending_fulfillment")).toBe(
      "pending_fulfillment",
    );
    expect(parseOrdersDashboardFilter("all")).toBe("all");
    expect(parseOrdersDashboardFilter("nonsense")).toBe("pending_fulfillment");
    expect(parseOrdersDashboardFilter(null)).toBe("pending_fulfillment");
  });
});
