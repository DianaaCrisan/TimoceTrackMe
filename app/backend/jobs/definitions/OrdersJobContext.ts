import type { Locale } from "app/commons/i18n/Locale";
import type { ManualZips } from "app/commons/orders/ManualZips";
import type { AdminApiContextWithoutRest } from "../../core/types/AdminApiContextWithoutRest";
import type { JobProgress } from "../startBackgroundJob.server";

/** What every bulk orders job gets when it starts building its result. */
export type OrdersJobContext = {
  /** Stays valid for the whole job (see `createJobAdmin`). */
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  orderIds: string[];
  startedAt: Date;
  /** The user's IANA time zone, for timestamps in file names. */
  timeZone: string | null;
  /** The language of whoever started the job, for its summary. English if unset. */
  locale?: Locale;
  /** ZIPs the admin typed on the "ZIP to fix" tab (add tracking only). */
  manualZips?: ManualZips;
  /** How far the job is, for the dashboard. Optional for tests. */
  progress?: JobProgress;
};
