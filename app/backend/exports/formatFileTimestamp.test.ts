import { describe, expect, it } from "vitest";
import { formatFileTimestamp } from "./formatFileTimestamp";

describe("formatFileTimestamp", () => {
  const date = new Date("2026-11-09T12:05:00Z");

  it("formats in the given time zone", () => {
    expect(formatFileTimestamp(date, "Europe/Bucharest")).toBe(
      "9-Nov-2026_14-05",
    );
  });

  it("uses 24h hours with leading zeros", () => {
    expect(formatFileTimestamp(new Date("2026-03-01T00:07:00Z"), "UTC")).toBe(
      "1-Mar-2026_00-07",
    );
  });

  it("falls back to UTC for a missing or invalid time zone", () => {
    expect(formatFileTimestamp(date)).toBe("9-Nov-2026_12-05");
    expect(formatFileTimestamp(date, "Not/AZone")).toBe("9-Nov-2026_12-05");
  });

  it("names the month in Romanian, without the abbreviation dot", () => {
    expect(formatFileTimestamp(date, "Europe/Bucharest", "ro")).toBe(
      "9-nov-2026_14-05",
    );
  });

  it("contains no characters that are invalid in file names", () => {
    for (const locale of ["en", "ro"] as const) {
      expect(formatFileTimestamp(date, "Europe/Bucharest", locale)).toMatch(
        /^[A-Za-z0-9_-]+$/,
      );
    }
  });
});
