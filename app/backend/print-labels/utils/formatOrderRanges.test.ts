import { describe, expect, it } from "vitest";
import { formatOrderRanges } from "./formatOrderRanges";

describe("formatOrderRanges", () => {
  it("collapses one consecutive run", () => {
    expect(formatOrderRanges(["5", "6", "7", "8", "9", "10"])).toEqual([
      "5-10",
    ]);
  });

  it("splits runs at every gap and keeps single orders", () => {
    expect(
      formatOrderRanges(["5", "6", "7", "9", "10", "11", "12", "16"]),
    ).toEqual(["5-7", "9-12", "16"]);
  });

  it("keeps Shopify's # prefix, once per range", () => {
    expect(
      formatOrderRanges(["#1201", "#1202", "#1203", "#1209", "#1210"]),
    ).toEqual(["#1201-1203", "#1209-1210"]);
  });

  it("sorts numerically, whatever the input order, and drops duplicates", () => {
    expect(
      formatOrderRanges(["#1010", "#999", "#1000", "#1001", "#999"]),
    ).toEqual(["#999-1001", "#1010"]);
  });

  it("only joins names with the same prefix and suffix", () => {
    expect(formatOrderRanges(["#5", "#6", "B7", "#7", "#8-A", "#9-A"])).toEqual(
      ["#5-7", "#8-9-A", "B7"],
    );
  });

  it("keeps names without a number at the end", () => {
    expect(formatOrderRanges(["#5", "draft", "", "#6"])).toEqual([
      "#5-6",
      "draft",
    ]);
  });

  it("returns nothing for no orders", () => {
    expect(formatOrderRanges([])).toEqual([]);
  });
});
