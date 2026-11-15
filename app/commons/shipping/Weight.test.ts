import { describe, expect, it } from "vitest";
import { formatKilogramsForAwb, toKilograms } from "./Weight";

describe("toKilograms", () => {
  it("converts every Shopify weight unit to kg", () => {
    expect(toKilograms(1500, "GRAMS")).toBe(1.5);
    expect(toKilograms(2, "KILOGRAMS")).toBe(2);
    expect(toKilograms(1, "POUNDS")).toBeCloseTo(0.4536, 4);
    expect(toKilograms(16, "OUNCES")).toBeCloseTo(0.4536, 4);
  });
});

describe("formatKilogramsForAwb", () => {
  it("rounds to the gram, without float noise", () => {
    expect(formatKilogramsForAwb(0.1 + 0.2)).toBe("0.3");
    expect(formatKilogramsForAwb(12.34567)).toBe("12.346");
    expect(formatKilogramsForAwb(20)).toBe("20");
  });
});
