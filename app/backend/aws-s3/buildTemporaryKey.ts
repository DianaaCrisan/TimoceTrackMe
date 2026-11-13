export type TemporaryFileJob =
  | "solve-zip"
  | "add-tracking"
  | "print-labels"
  | "test";

const SHOP_TIME_ZONE = "Europe/Bucharest";

/**
 * `<APP_NAME>/temporary-files/<job>/<YYYY/MM/DD>/<id>-<fileName>`
 *
 * - `APP_NAME` keeps dev and prod apart when they share a bucket.
 * - Everything sits under `temporary-files/`, so one S3 lifecycle rule can
 *   expire it all.
 * - The date is the shop's day, not UTC, so a job started at 01:00 in Romania
 *   is filed under that day.
 */
export function buildTemporaryKey(args: {
  job: TemporaryFileJob;
  createdAt: Date;
  id: string;
  fileName: string;
  appName?: string;
}): string {
  const { job, createdAt, id, fileName } = args;
  const appName = args.appName ?? process.env.APP_NAME ?? "";

  const key = `temporary-files/${job}/${shopDayPath(createdAt)}/${id}-${safeObjectName(fileName)}`;
  const prefix = appName.trim().replace(/\/+$/, "");

  return prefix ? `${prefix}/${key}` : key;
}

function shopDayPath(date: Date): string {
  // en-CA formats as YYYY-MM-DD
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  return day.replaceAll("-", "/");
}

/** Keeps letters, digits, dots, dashes and underscores; everything else becomes "_". */
export function safeObjectName(fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe.replace(/^\.+/, "") || "file";
}
