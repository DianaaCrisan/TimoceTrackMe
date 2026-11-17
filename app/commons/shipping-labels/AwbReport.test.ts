import { describe, expect, it } from "vitest";
import {
  formatReportMonth,
  listRecentMonths,
  parseReportMonth,
  shopDayStart,
  shopMonthRange,
  sortAwbReportRows,
  splitAwbReport,
  toShopMonth,
  toShopWallClock,
} from "./AwbReport";
import { awbReportRow } from "./awbReportRow.fixture";

describe("toShopMonth", () => {
  it("uses the shop's clock: 23:30 UTC on Oct 31 is already November in Bucharest", () => {
    expect(toShopMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
});

describe("parseReportMonth", () => {
  it("accepts YYYY-MM with a real month", () => {
    expect(parseReportMonth("2026-11")).toBe("2026-11");
  });

  it.each([null, "", "2026-13", "2026-00", "2026-1", "11-2026", "x"])(
    "rejects %s",
    (value) => {
      expect(parseReportMonth(value)).toBeNull();
    },
  );
});

describe("listRecentMonths", () => {
  it("starts with the current month and crosses the year", () => {
    expect(listRecentMonths(new Date("2026-02-10T12:00:00Z"), 4)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ]);
  });
});

describe("shopMonthRange", () => {
  it("cuts winter months at Bucharest midnight (UTC+2)", () => {
    const { start, end } = shopMonthRange("2026-11");
    expect(start.toISOString()).toBe("2026-10-31T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T22:00:00.000Z");
  });

  it("follows daylight saving time (UTC+3 in summer)", () => {
    // starts in winter time, ends in summer time
    const { start, end } = shopMonthRange("2026-03");
    expect(start.toISOString()).toBe("2026-02-28T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-31T21:00:00.000Z");
  });

  it("rolls December over into the next year", () => {
    expect(shopMonthRange("2026-12").end.toISOString()).toBe(
      "2026-12-31T22:00:00.000Z",
    );
  });
});

describe("toShopWallClock", () => {
  it("moves the instant by the shop's offset", () => {
    expect(
      toShopWallClock(new Date("2026-11-16T10:41:00Z")).toISOString(),
    ).toBe("2026-11-16T12:41:00.000Z");
    expect(
      toShopWallClock(new Date("2026-07-01T10:41:00Z")).toISOString(),
    ).toBe("2026-07-01T13:41:00.000Z");
  });
});

describe("formatReportMonth", () => {
  it("names the month in the user's language, capitalised", () => {
    expect(formatReportMonth("2026-11", "en")).toBe("November 2026");
    expect(formatReportMonth("2026-11", "ro")).toBe("Noiembrie 2026");
  });
});

describe("sortAwbReportRows", () => {
  const row = (
    trackingNumber: string,
    orderName: string | null,
    issuedAt: string,
  ) => awbReportRow({ trackingNumber, orderName, issuedAt });

  it("puts the oldest AWB first, then orders by number", () => {
    const sorted = sortAwbReportRows([
      row("C", "#1010", "2026-11-02T10:00:00.000Z"),
      row("B", "#1009", "2026-11-02T10:00:00.000Z"),
      row("D", null, "2026-11-02T10:00:00.000Z"),
      row("A", "#1200", "2026-11-01T10:00:00.000Z"),
    ]);

    expect(sorted.map((r) => r.trackingNumber)).toEqual(["A", "D", "B", "C"]);
  });
});

describe("splitAwbReport", () => {
  it("splits Optimus AWBs by status and keeps unknown couriers apart, whatever their status", () => {
    const tables = splitAwbReport([
      awbReportRow({ trackingNumber: "used" }),
      awbReportRow({ trackingNumber: "cancelled", status: "CANCELLED" }),
      awbReportRow({ trackingNumber: "unknown-used", courier: "UNKNOWN" }),
      awbReportRow({
        trackingNumber: "unknown-cancelled",
        courier: "UNKNOWN",
        status: "CANCELLED",
      }),
    ]);

    expect({
      used: tables.used.map((r) => r.trackingNumber),
      cancelled: tables.cancelled.map((r) => r.trackingNumber),
      unknownCourier: tables.unknownCourier.map((r) => r.trackingNumber),
    }).toEqual({
      used: ["used"],
      cancelled: ["cancelled"],
      // same moment: by AWB
      unknownCourier: ["unknown-cancelled", "unknown-used"],
    });
  });
});

describe("shopDayStart", () => {
  it("is Bucharest midnight", () => {
    expect(shopDayStart("2026-11-01")?.toISOString()).toBe(
      "2026-10-31T22:00:00.000Z",
    );
    expect(shopDayStart("2026-07-01")?.toISOString()).toBe(
      "2026-06-30T21:00:00.000Z",
    );
  });

  it.each(["", "2026-02-30", "2026-13-01", "1.11.2026"])(
    "rejects %s",
    (day) => {
      expect(shopDayStart(day)).toBeNull();
    },
  );
});
