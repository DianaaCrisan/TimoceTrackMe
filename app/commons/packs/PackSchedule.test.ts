import { describe, expect, it } from "vitest";
import {
  addDays,
  hasScheduledCutSince,
  isoWeekday,
  parsePackStartWeekdays,
} from "./PackSchedule";

const MONDAY = 1;
const WEDNESDAY = 3;
const SUNDAY = 7;

describe("hasScheduledCutSince", () => {
  // Tue 17.11.2026 10:00 Bucharest (UTC+2)
  const tuesdayMorning = new Date("2026-11-17T08:00:00Z");

  it("never cuts without chosen days", () => {
    expect(
      hasScheduledCutSince(tuesdayMorning, new Date("2026-12-30T10:00:00Z"), []),
    ).toBe(false);
  });

  it("cuts once a chosen day has started, at Bucharest midnight", () => {
    // Tue 23:59 Bucharest: still Tuesday
    expect(
      hasScheduledCutSince(
        tuesdayMorning,
        new Date("2026-11-17T21:59:00Z"),
        [WEDNESDAY],
      ),
    ).toBe(false);
    // Wed 00:01 Bucharest, still Tuesday in UTC
    expect(
      hasScheduledCutSince(
        tuesdayMorning,
        new Date("2026-11-17T22:01:00Z"),
        [WEDNESDAY],
      ),
    ).toBe(true);
  });

  it("does not cut on the day the pack started, even if it is a chosen day", () => {
    expect(
      hasScheduledCutSince(
        tuesdayMorning,
        new Date("2026-11-17T20:00:00Z"),
        [2],
      ),
    ).toBe(false);
  });

  it("ignores days that are not chosen", () => {
    // Tue → Sat: Wed–Sat passed, only Monday chosen
    expect(
      hasScheduledCutSince(
        tuesdayMorning,
        new Date("2026-11-21T10:00:00Z"),
        [MONDAY],
      ),
    ).toBe(false);
  });

  it("cuts after a week whatever the day, since every weekday has come round", () => {
    expect(
      hasScheduledCutSince(
        tuesdayMorning,
        new Date("2026-12-30T10:00:00Z"),
        [MONDAY],
      ),
    ).toBe(true);
  });

  it("keeps midnight right across the change to summer time", () => {
    // Sat 27.03.2027 23:30 Bucharest (UTC+2); clocks go forward that night,
    // so Sunday 28.03 is 23 hours long. Sunday chosen.
    const saturdayNight = new Date("2027-03-27T21:30:00Z");
    expect(
      hasScheduledCutSince(
        saturdayNight,
        new Date("2027-03-27T21:59:00Z"),
        [SUNDAY],
      ),
    ).toBe(false);
    expect(
      hasScheduledCutSince(
        saturdayNight,
        new Date("2027-03-27T22:00:00Z"),
        [SUNDAY],
      ),
    ).toBe(true);
  });

  it("keeps midnight right across the change to winter time", () => {
    // Sat 24.10.2026 22:00 Bucharest (UTC+3); clocks go back that night, so
    // Sunday 25.10 is 25 hours long. Its midnight is still UTC+3: 21:00 UTC.
    const saturdayNight = new Date("2026-10-24T19:00:00Z");
    expect(
      hasScheduledCutSince(
        saturdayNight,
        new Date("2026-10-24T20:59:00Z"),
        [SUNDAY],
      ),
    ).toBe(false);
    expect(
      hasScheduledCutSince(
        saturdayNight,
        new Date("2026-10-24T21:00:00Z"),
        [SUNDAY],
      ),
    ).toBe(true);
    // and the Monday after the 25-hour Sunday starts at 22:00 UTC
    expect(
      hasScheduledCutSince(
        new Date("2026-10-25T12:00:00Z"),
        new Date("2026-10-25T21:59:00Z"),
        [MONDAY],
      ),
    ).toBe(false);
    expect(
      hasScheduledCutSince(
        new Date("2026-10-25T12:00:00Z"),
        new Date("2026-10-25T22:00:00Z"),
        [MONDAY],
      ),
    ).toBe(true);
  });
});

describe("day helpers", () => {
  it("adds calendar days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29");
  });

  it("numbers weekdays the ISO way", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
  });
});

describe("parsePackStartWeekdays", () => {
  it("keeps valid weekdays, once each, sorted", () => {
    expect(parsePackStartWeekdays(["5", "1", "1", "0", "8", "x"])).toEqual([
      1, 5,
    ]);
  });
});
