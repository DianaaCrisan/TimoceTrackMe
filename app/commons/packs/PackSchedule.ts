import { toShopDay } from "./FulfillmentPack";

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PACK_START_WEEKDAYS_FIELD = "packStartWeekdays";

const DAYS_IN_WEEK = 7;

/**
 * Whether a scheduled cut has happened since a pack's first order: the
 * start (midnight, shop time) of one of `startWeekdays`, after the day the
 * pack started and up to today. If so, the pack stops filling and the next
 * order starts a new pack.
 *
 * Compared as calendar days in the shop's time zone, never as instants, so
 * the 23- and 25-hour days of a daylight-saving change cannot shift a cut.
 */
export function hasScheduledCutSince(
  startedAt: Date,
  now: Date,
  startWeekdays: readonly number[],
): boolean {
  if (startWeekdays.length === 0) return false;

  const startDay = toShopDay(startedAt);
  const today = toShopDay(now);

  // every weekday comes round within a week
  for (
    let day = addDays(startDay, 1), checked = 0;
    day <= today && checked < DAYS_IN_WEEK;
    day = addDays(day, 1), checked++
  ) {
    if (startWeekdays.includes(isoWeekday(day))) return true;
  }
  return false;
}

/**
 * How many orders a filling pack takes before it waits. Matches the column's
 * default; read-only for now. 200 keeps actions on a whole pack (move it,
 * add tracking) to about a minute on a Standard Shopify plan, well under the
 * 1000-order job limit. See docs/background-work-visibility-plan.md.
 */
export const DEFAULT_PACK_MAX_ORDERS = 200;

/** Why an open pack takes no new orders. */
export type PackWaitingReason = "full" | "schedule";

/**
 * Why an open pack waits instead of taking new orders, or null when it
 * takes them:
 * - `full`: it holds `packMaxOrders` orders or more
 * - `schedule`: a scheduled cut has happened since its first order
 *
 * Only the choice of the filling pack follows this. The admin can still add
 * orders to any pack by hand, past the limit too.
 */
export function getWaitingReason(
  pack: { status: string; startedAt: Date | null },
  orderCount: number,
  rules: { startWeekdays: readonly number[]; packMaxOrders: number | null },
  now: Date,
): PackWaitingReason | null {
  if (pack.status !== "OPEN") return null;
  if (rules.packMaxOrders !== null && orderCount >= rules.packMaxOrders) {
    return "full";
  }
  if (
    pack.startedAt !== null &&
    hasScheduledCutSince(pack.startedAt, now, rules.startWeekdays)
  ) {
    return "schedule";
  }
  return null;
}

/** `YYYY-MM-DD` plus `days`. Calendar arithmetic, in UTC to dodge DST. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The ISO weekday of a `YYYY-MM-DD` day. */
export function isoWeekday(day: string): number {
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** The ticked weekdays from the settings form, sorted, without junk. */
export function parsePackStartWeekdays(values: unknown[]): number[] {
  const weekdays = new Set<number>();
  for (const value of values) {
    const weekday = Number(value);
    if ((ISO_WEEKDAYS as readonly number[]).includes(weekday)) {
      weekdays.add(weekday);
    }
  }
  return [...weekdays].sort((a, b) => a - b);
}
