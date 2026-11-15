import { describe, expect, it } from "vitest";
import {
  getSplitLimitKg,
  isOverWeightLimit,
  parseWeightLimitKg,
} from "./ParcelWeightSettings";

describe("parseWeightLimitKg", () => {
  it("turns the check off when empty", () => {
    expect(parseWeightLimitKg("")).toBeNull();
    expect(parseWeightLimitKg("  ")).toBeNull();
    expect(parseWeightLimitKg(null)).toBeNull();
  });

  it("reads comma and dot decimals", () => {
    expect(parseWeightLimitKg("22,5")).toBe(22.5);
    expect(parseWeightLimitKg("22.5")).toBe(22.5);
  });

  it("rejects values that are not a positive number", () => {
    expect(parseWeightLimitKg("0")).toBeUndefined();
    expect(parseWeightLimitKg("-3")).toBeUndefined();
    expect(parseWeightLimitKg("abc")).toBeUndefined();
  });
});

describe("weight limit checks", () => {
  const settings = { parcelWeightLimitKg: 25, autoSplitHeavyOrders: false };

  it("splits only with auto split on", () => {
    expect(getSplitLimitKg(settings)).toBeNull();
    expect(getSplitLimitKg({ ...settings, autoSplitHeavyOrders: true })).toBe(
      25,
    );
  });

  it("flags weights over the limit, and nothing without a limit", () => {
    expect(isOverWeightLimit(25.1, settings)).toBe(true);
    expect(isOverWeightLimit(25, settings)).toBe(false);
    expect(isOverWeightLimit(null, settings)).toBe(false);
    expect(
      isOverWeightLimit(100, { ...settings, parcelWeightLimitKg: null }),
    ).toBe(false);
  });
});
