import type { Translate } from "../i18n/translate";
import type { TranslationKey } from "../i18n/translations";

/**
 * Which orders the report cover, by order number, both ends included.
 * `null` leaves that end open; both `null` means every unfulfilled order.
 */
export type OrderInterval = { from: number | null; to: number | null };

export const ALL_ORDERS_INTERVAL: OrderInterval = { from: null, to: null };

/** The URL / form fields that carry the interval. */
export const ORDER_INTERVAL_PARAMS = { from: "from", to: "to" } as const;

export type OrderIntervalParseResult =
  | { ok: true; interval: OrderInterval }
  | { ok: false; error: TranslationKey };

/**
 * Reads "1250" or "#1250" for each end; an empty value leaves that end open.
 * Refuses anything that is not a whole number, and a start past the end.
 */
export function parseOrderInterval(
  from: string | null | undefined,
  to: string | null | undefined,
): OrderIntervalParseResult {
  const parsedFrom = parseOrderNumberInput(from);
  const parsedTo = parseOrderNumberInput(to);

  if (parsedFrom === undefined || parsedTo === undefined) {
    return { ok: false, error: "report.invalidNumber" };
  }
  if (parsedFrom !== null && parsedTo !== null && parsedFrom > parsedTo) {
    return { ok: false, error: "report.invalidInterval" };
  }

  return { ok: true, interval: { from: parsedFrom, to: parsedTo } };
}

/** `null` for an empty value, `undefined` for an invalid one. */
function parseOrderNumberInput(
  value: string | null | undefined,
): number | null | undefined {
  const trimmed = (value ?? "").trim().replace(/^#/, "");
  if (!trimmed) return null;
  if (!/^\d{1,12}$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

const ORDER_NAME_NUMBER = /^\D*(\d+)\D*$/;

/** "#1250" → 1250. `null` for a name without exactly one number in it. */
export function getOrderNumber(orderName: string): number | null {
  const match = ORDER_NAME_NUMBER.exec(orderName.trim());
  return match ? Number(match[1]) : null;
}

/** Every order is in an open interval; otherwise only numbered orders within it. */
export function isOrderInInterval(
  orderName: string,
  interval: OrderInterval,
): boolean {
  if (interval.from === null && interval.to === null) return true;

  const orderNumber = getOrderNumber(orderName);
  if (orderNumber === null) return false;

  return (
    (interval.from === null || orderNumber >= interval.from) &&
    (interval.to === null || orderNumber <= interval.to)
  );
}

/** "All unfulfilled orders", "Orders #1200 – #1250", "Orders from #1200"... */
export function formatOrderIntervalScope(
  interval: OrderInterval,
  t: Translate,
): string {
  const { from, to } = interval;

  if (from !== null && to !== null) {
    return t("report.scopeBetween", { from, to });
  }
  if (from !== null) return t("report.scopeFrom", { from });
  if (to !== null) return t("report.scopeTo", { to });
  return t("report.scopeAll");
}

/** For the URL: only the ends that are set. */
export function orderIntervalToSearchParams(
  interval: OrderInterval,
): URLSearchParams {
  const params = new URLSearchParams();
  if (interval.from !== null) {
    params.set(ORDER_INTERVAL_PARAMS.from, String(interval.from));
  }
  if (interval.to !== null) {
    params.set(ORDER_INTERVAL_PARAMS.to, String(interval.to));
  }
  return params;
}
