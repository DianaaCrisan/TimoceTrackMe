const FALLBACK_TIME_ZONE = "UTC";

function resolveTimeZone(timeZone: string | null | undefined): string {
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
 * Human-readable, filename-safe timestamp, e.g. "9-Nov-2026_14-35".
 * Avoids ":" and "/" since they are invalid in file names on Windows/macOS.
 */
export function formatLabelsFileTimestamp(
  date: Date,
  timeZone?: string | null,
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
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

  return `${get("day")}-${get("month")}-${get("year")}_${get("hour")}-${get("minute")}`;
}
