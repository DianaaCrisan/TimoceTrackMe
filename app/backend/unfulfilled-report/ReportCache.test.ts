import { describe, expect, it } from "vitest";
import type { UnfulfilledReport } from "app/commons/unfulfilled-report/UnfulfilledReport";
import { ReportCache } from "./ReportCache";

const emptySection = {
  orderNames: [],
  orderRanges: [],
  rows: [],
  totalQuantity: 0,
};
const report: UnfulfilledReport = {
  interval: { from: null, to: null },
  generatedAt: "2026-11-14T10:00:00.000Z",
  delivery: emptySection,
  pickup: emptySection,
};

describe("ReportCache", () => {
  it("hands the report back to the shop that stored them", () => {
    const cache = new ReportCache(() => 0);
    const id = cache.store("timoce.myshopify.com", report);

    expect(cache.get("timoce.myshopify.com", id)).toBe(report);
    expect(cache.get("other.myshopify.com", id)).toBeNull();
    expect(cache.get("timoce.myshopify.com", "unknown")).toBeNull();
  });

  it("forgets them after 30 minutes", () => {
    let now = 0;
    const cache = new ReportCache(() => now);
    const id = cache.store("timoce.myshopify.com", report);

    now = 30 * 60 * 1000 + 1;
    expect(cache.get("timoce.myshopify.com", id)).toBeNull();
  });

  it("keeps only the most recent entries", () => {
    const cache = new ReportCache(() => 0);
    const first = cache.store("shop", report);
    for (let i = 0; i < 50; i++) cache.store("shop", report);

    expect(cache.get("shop", first)).toBeNull();
  });
});
