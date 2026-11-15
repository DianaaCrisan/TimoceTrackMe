import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/translate";
import {
  buildPackTag,
  countLeftInPack,
  formatPackName,
  formatPackTime,
  toShopDay,
} from "./FulfillmentPack";

describe("buildPackTag", () => {
  it("uses only characters Shopify search takes unquoted, year first", () => {
    expect(buildPackTag("2026-11-14", 2)).toBe("pachet-2026-11-14-2");
  });
});

describe("formatPackName", () => {
  it("names the pack by its day and its place in that day", () => {
    const pack = { day: "2026-11-14", daySequence: 2 };
    expect(formatPackName(pack, createTranslator("ro"))).toBe(
      "Pachet 14.11.2026/2",
    );
    expect(formatPackName(pack, createTranslator("en"))).toBe(
      "Pack 14.11.2026/2",
    );
  });
});

describe("toShopDay", () => {
  it("uses the Bucharest calendar day, not UTC's", () => {
    // 23:30 UTC on the 14th is 01:30 on the 15th in Bucharest (UTC+2)
    expect(toShopDay(new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
    expect(toShopDay(new Date("2026-11-14T21:59:00Z"))).toBe("2026-11-14");
  });

  it("follows summer time (UTC+3)", () => {
    expect(toShopDay(new Date("2026-07-14T21:30:00Z"))).toBe("2026-07-15");
    expect(toShopDay(new Date("2026-07-14T20:59:00Z"))).toBe("2026-07-14");
  });
});

describe("formatPackTime", () => {
  it("shows day, month and 24-hour time in Bucharest", () => {
    expect(formatPackTime("2026-11-14T12:32:00Z", "ro")).toBe("14.11 14:32");
    expect(formatPackTime("2026-11-14T12:32:00Z", "en")).toBe("14.11 14:32");
  });
});

describe("countLeftInPack", () => {
  it("is total minus done, or null when a count is missing", () => {
    const count = (n: number) => ({ count: n, isAtLeast: false });
    expect(countLeftInPack({ total: count(60), done: count(45) })).toBe(15);
    expect(countLeftInPack({ total: count(60), done: null })).toBeNull();
  });
});
