import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  type Locale,
} from "app/commons/i18n/Locale";

const FALLBACK_TIME_ZONE = "UTC";

export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return FALLBACK_TIME_ZONE;

  try {
    // throws RangeError for unknown IANA zones (the value comes from the client)
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/**
 * Human-readable, filename-safe timestamp in the user's language, e.g.
 * "9-Nov-2026_14-35" or "9-nov-2026_14-35".
 * Avoids ":" and "/" since they are invalid in file names on Windows/macOS,
 * and the dot Romanian puts after short months ("nov.").
 */
export function formatFileTimestamp(
  date: Date,
  timeZone?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const parts = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: resolveTimeZone(timeZone),
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const month = get("month").replace(/[^\p{L}]/gu, "");

  return `${get("day")}-${month}-${get("year")}_${get("hour")}-${get("minute")}`;
}
