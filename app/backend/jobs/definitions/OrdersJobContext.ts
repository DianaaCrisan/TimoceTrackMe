import type { Locale } from "app/commons/i18n/Locale";
import type { AdminApiContextWithoutRest } from "../../core/types/AdminApiContextWithoutRest";

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
};
