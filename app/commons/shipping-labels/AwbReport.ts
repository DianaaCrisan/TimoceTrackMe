import type { Courier } from "../couriers/Courier";
import { INTL_LOCALE, type Locale } from "../i18n/Locale";
import { SHOP_TIME_ZONE, toShopDay } from "../packs/FulfillmentPack";

export const AWB_REPORT_PATH = "/app/awb-report";
export const AWB_REPORT_XLSX_PATH = `${AWB_REPORT_PATH}/xlsx`;

/** The report's month, in the URL and in the download form. */
export const REPORT_MONTH_PARAM = "month";

/** How many months the picker offers, the current one included. */
export const PICKABLE_MONTH_COUNT = 12;

/** A calendar month in the shop's time zone, `YYYY-MM`. */
export type ReportMonth = string;

/** The page's actions, sent as `intent`. */
export const AWB_REPORT_INTENT = {
  refresh: "refresh",
  addByHand: "add-by-hand",
  delete: "delete",
} as const;
export type AwbReportIntent =
  (typeof AWB_REPORT_INTENT)[keyof typeof AWB_REPORT_INTENT];

/** Form fields of the page's actions; the month is `REPORT_MONTH_PARAM`. */
export const AWB_REPORT_FIELDS = {
  intent: "intent",
  status: "status",
  day: "day",
  awbs: "awbs",
  note: "note",
  trackingNumber: "trackingNumber",
} as const;

export type AwbReportActionResponse =
  | { ok: true; intent: AwbReportIntent; message: string; notice?: string }
  | {
      ok: false;
      intent: AwbReportIntent | null;
      error: string;
      /** Add by hand: the lines to fix, nothing was saved. */
      lineErrors?: string[];
    };

/** Where the app learned about the AWB. Mirrors the Prisma enum. */
export type AwbSource = "TRACKME" | "SHOPIFY" | "IMPORT";
export type AwbStatus = "USED" | "CANCELLED";
export type AwbCancelReason =
  | "FULFILLMENT_CANCELLED"
  | "TRACKING_REMOVED"
  | "NEVER_ON_SHOPIFY"
  | "SET_BY_HAND";

/** One AWB in the report. Dates are ISO strings. */
export type AwbReportRow = {
  trackingNumber: string;
  source: AwbSource;
  courier: Courier;
  /** The courier as typed on the Shopify fulfillment. */
  trackingCompany: string | null;
  /** Null only for AWBs added by hand without an order. */
  orderId: string | null;
  orderName: string | null;
  orderCreatedAt: string | null;
  /** "2/3" when the order ships as several parcels. TrackMe only. */
  parcelPosition: string | null;
  weightKg: number | null;
  /** Decides the month. */
  issuedAt: string;
  status: AwbStatus;
  cancelReason: AwbCancelReason | null;
  cancelledAt: string | null;
  note: string | null;
  /** Null when never printed. */
  firstPrintedAt: string | null;
  printCount: number;
};

/** The report's three tables. */
export type AwbReportTables = {
  used: AwbReportRow[];
  cancelled: AwbReportRow[];
  /** Any status: the courier typed in Shopify is not one we recognise. */
  unknownCourier: AwbReportRow[];
};

/** Sorts the rows and splits them into the report's tables. */
export function splitAwbReport(rows: AwbReportRow[]): AwbReportTables {
  const sorted = sortAwbReportRows(rows);
  const known = sorted.filter((row) => row.courier !== "UNKNOWN");

  return {
    used: known.filter((row) => row.status === "USED"),
    cancelled: known.filter((row) => row.status === "CANCELLED"),
    unknownCourier: sorted.filter((row) => row.courier === "UNKNOWN"),
  };
}

/** The month `date` falls in, by the shop's clock. */
export function toShopMonth(date: Date): ReportMonth {
  return toShopDay(date).slice(0, 7);
}

/** `YYYY-MM` with a real month, else null. */
export function parseReportMonth(
  value: string | null | undefined,
): ReportMonth | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

/** The current month first, then the ones before it. */
export function listRecentMonths(
  now: Date,
  count = PICKABLE_MONTH_COUNT,
): ReportMonth[] {
  const [year, month] = splitMonth(toShopMonth(now));
  const months: ReportMonth[] = [];

  for (let back = 0; back < count; back++) {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  return months;
}

/** "November 2026", "Noiembrie 2026". */
export function formatReportMonth(month: ReportMonth, locale: Locale): string {
  const [year, monthNumber] = splitMonth(month);
  const text = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The month as instants: from its first midnight (inclusive) to the next
 * month's (exclusive), by the shop's clock.
 */
export function shopMonthRange(month: ReportMonth): { start: Date; end: Date } {
  const [year, monthNumber] = splitMonth(month);

  return {
    start: shopMidnightToUtc(year, monthNumber, 1),
    // Date.UTC rolls month 13 over to January of the next year
    end: shopMidnightToUtc(year, monthNumber + 1, 1),
  };
}

/** Oldest first; AWBs issued at the same moment by order number. */
export function sortAwbReportRows(rows: AwbReportRow[]): AwbReportRow[] {
  return [...rows].sort(
    (a, b) =>
      a.issuedAt.localeCompare(b.issuedAt) ||
      (a.orderName ?? "").localeCompare(b.orderName ?? "", undefined, {
        numeric: true,
      }) ||
      a.trackingNumber.localeCompare(b.trackingNumber),
  );
}

/**
 * Midnight starting `YYYY-MM-DD` in the shop's time zone, as an instant;
 * null for anything else.
 */
export function shopDayStart(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [year, month, date] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, date));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== date
  ) {
    return null;
  }
  return shopMidnightToUtc(year, month, date);
}

/**
 * The same wall-clock time as in the shop's time zone, but in UTC: what
 * Excel needs, since its dates have no time zone.
 */
export function toShopWallClock(date: Date): Date {
  return new Date(date.getTime() + shopOffsetMs(date));
}

function splitMonth(month: ReportMonth): [number, number] {
  const [year, monthNumber] = month.split("-").map(Number);
  return [year, monthNumber];
}

/**
 * Midnight of that day in the shop's time zone, as an instant. Correct across
 * daylight saving changes, which Romania makes at 03:00/04:00, never at
 * midnight.
 */
function shopMidnightToUtc(year: number, month: number, day: number): Date {
  const asUtc = Date.UTC(year, month - 1, day);
  const guess = asUtc - shopOffsetMs(new Date(asUtc));
  return new Date(asUtc - shopOffsetMs(new Date(guess)));
}

/** How far the shop's clock is ahead of UTC at `date`, in ms. */
function shopOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const wallClockAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;

  return wallClockAsUtc - wholeSeconds;
}
