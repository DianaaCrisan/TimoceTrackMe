import { INTL_LOCALE, type Locale } from "../i18n/Locale";
import type { Translate } from "../i18n/translate";
import type { OrdersCount } from "../orders/OrdersCount";

export type FulfillmentPackStatus = "OPEN" | "LOCKED" | "CLOSED";

/** A pack as the pages show it. Dates are ISO strings. */
export type FulfillmentPackView = {
  id: string;
  /** The day the pack was created, `YYYY-MM-DD`, in the shop's time zone. */
  day: string;
  /** Its place among that day's packs, from 1. */
  daySequence: number;
  status: FulfillmentPackStatus;
  /**
   * Open, but a scheduled day has started since its first order: it takes
   * no new orders and waits for someone to start working on it.
   */
  isWaiting: boolean;
  startedAt: string | null;
  lockedAt: string | null;
  closedAt: string | null;
  /** Orders in the pack, from the database. */
  orderCount: number;
  /**
   * Orders joining or leaving the pack whose Shopify tags are still being
   * updated: the pack's tabs do not show them right yet.
   */
  taggingCount: number;
  /** Orders whose tags could not be updated; the Retry button queues them. */
  tagFailedCount: number;
};

/**
 * How far along a pack is, counted by Shopify search on the pack's tag.
 * Null when the count could not be loaded.
 */
export type PackProgress = {
  total: OrdersCount | null;
  done: OrdersCount | null;
};

/**
 * On every order that is in a pack, next to the pack's own tag. The "Not in a
 * pack" tab filters on it: Shopify search has no reliable "no tag starting
 * with pachet-".
 */
export const PACKED_ORDER_TAG = "in-pachet";

/**
 * `pachet-2026-11-14-2`. Hyphens only: `.` and `/` would need quoting in
 * Shopify search. Year first, so the tags sort by date in the Shopify admin.
 *
 * Only called when a pack is created; afterwards read `orderTag` back.
 */
export function buildPackTag(day: string, daySequence: number): string {
  return `pachet-${day}-${daySequence}`;
}

/** Packs are named and cut by the shop's clock, wherever the admin is. */
export const SHOP_TIME_ZONE = "Europe/Bucharest";

/** The calendar day of `date` in the shop's time zone, `YYYY-MM-DD`. */
export function toShopDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const PACKS_PATH = "/app/packs";
export const PACKS_MANAGE_PATH = `${PACKS_PATH}/manage`;

export function buildPackUrl(packId: string, filter?: string): string {
  const path = `${PACKS_PATH}/${encodeURIComponent(packId)}`;
  return filter ? `${path}?filter=${filter}` : path;
}

/** "Pachet 14.11.2026/2". */
export function formatPackName(
  pack: Pick<FulfillmentPackView, "day" | "daySequence">,
  t: Translate,
): string {
  const [year, month, day] = pack.day.split("-");
  return t("pack.name", {
    date: `${day}.${month}.${year}`,
    sequence: pack.daySequence,
  });
}

/** "15.11 14:32" in the shop's time zone. */
export function formatPackTime(iso: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: SHOP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${part("day")}.${part("month")} ${part("hour")}:${part("minute")}`;
}

/** Orders still needing work; null when either count is missing. */
export function countLeftInPack(progress: PackProgress): number | null {
  if (!progress.total || !progress.done) return null;
  return Math.max(0, progress.total.count - progress.done.count);
}

/** Packs an order can be added or moved into: not closed. */
export function isPackTarget(pack: FulfillmentPackView): boolean {
  return pack.status !== "CLOSED";
}

/** The pack new orders go into. */
export function isFillingPack(
  pack: Pick<FulfillmentPackView, "status" | "isWaiting">,
): boolean {
  return pack.status === "OPEN" && !pack.isWaiting;
}
