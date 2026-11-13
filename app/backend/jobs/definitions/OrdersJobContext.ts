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
};
