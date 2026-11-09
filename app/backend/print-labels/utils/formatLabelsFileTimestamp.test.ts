import { describe, expect, it } from "vitest";
import { formatLabelsFileTimestamp } from "./formatLabelsFileTimestamp";

describe("formatLabelsFileTimestamp", () => {
  const date = new Date("2026-11-09T12:05:00Z");

  it("formats in the given time zone", () => {
    expect(formatLabelsFileTimestamp(date, "Europe/Bucharest")).toBe(
      "9-Nov-2026_14-05",
    );
  });

  it("uses 24h hours with leading zeros", () => {
    expect(
      formatLabelsFileTimestamp(new Date("2026-03-01T00:07:00Z"), "UTC"),
    ).toBe("1-Mar-2026_00-07");
  });

  it("falls back to UTC for a missing or invalid time zone", () => {
    expect(formatLabelsFileTimestamp(date)).toBe("9-Nov-2026_12-05");
    expect(formatLabelsFileTimestamp(date, "Not/AZone")).toBe(
      "9-Nov-2026_12-05",
    );
  });

  it("contains no characters that are invalid in file names", () => {
    expect(formatLabelsFileTimestamp(date, "Europe/Bucharest")).not.toMatch(
      /[:/\\\s]/,
    );
  });
});
