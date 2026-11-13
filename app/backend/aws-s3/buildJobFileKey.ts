export type JobKind = "solve-zip" | "add-tracking" | "print-labels" | "test";

const SHOP_TIME_ZONE = "Europe/Bucharest";

/**
 * `<APP_NAME>/<job>/<YYYY-MM-DD>/<HH-mm-ss>_<shortId>_<fileName>`
 *
 * Laid out for browsing in the S3 console, where these files are downloaded:
 * - `APP_NAME` keeps dev and prod apart in the shared bucket.
 * - One folder per job and per day, in the shop's time zone.
 * - Names start with the time, so the console lists them in run order.
 * - The short id keeps two runs in the same second apart.
 */
export function buildJobFileKey(args: {
  job: JobKind;
  startedAt: Date;
  id: string;
  fileName: string;
  appName?: string;
}): string {
  const { job, startedAt, id, fileName } = args;
  const shortId = id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);

  return `${buildJobFolderKey(job, startedAt, args.appName)}${shopTime(startedAt)}_${shortId}_${safeObjectName(fileName)}`;
}

/** The day's folder for a job, with a trailing slash. */
export function buildJobFolderKey(
  job: JobKind,
  date: Date,
  appName?: string,
): string {
  return `${buildAppFolderKey(appName)}${job}/${shopDay(date)}/`;
}

/** The folder holding every job of this app: "<APP_NAME>/", or "" without one. */
export function buildAppFolderKey(
  appName: string = process.env.APP_NAME ?? "",
): string {
  const prefix = appName.trim().replace(/\/+$/, "");
  return prefix ? `${prefix}/` : "";
}

function shopDay(date: Date): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shopTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replaceAll(":", "-");
}

/** Keeps letters, digits, dots, dashes and underscores; everything else becomes "_". */
export function safeObjectName(fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return safe.replace(/^\.+/, "") || "file";
}
