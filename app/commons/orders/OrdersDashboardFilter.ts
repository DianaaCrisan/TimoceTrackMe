import { translateEn, type Translate } from "../i18n/translate";
import type { TranslationKey } from "../i18n/translations";

/** The dashboard tabs, in the order they are shown. */
export const ORDERS_DASHBOARD_FILTERS = [
  "all",
  "pending_fulfillment",
  "zip_to_fix",
  "unprinted",
  "not_in_pack",
] as const;

export type OrdersDashboardFilter = (typeof ORDERS_DASHBOARD_FILTERS)[number];

/** The tabs inside a pack: every one but "Not in a pack". */
export const PACK_DASHBOARD_FILTERS = [
  "all",
  "pending_fulfillment",
  "zip_to_fix",
  "unprinted",
] as const satisfies readonly OrdersDashboardFilter[];

/**
 * The Orders page's only tab: orders that still need work and are in no
 * pack. Everything else happens inside a pack, or from TrackMe's actions on
 * the Shopify order page.
 */
export const UNPACKED_DASHBOARD_FILTERS = [
  "not_in_pack",
] as const satisfies readonly OrdersDashboardFilter[];

/** The tab the dashboard opens on: the orders that still need work. */
export const DEFAULT_ORDERS_DASHBOARD_FILTER: OrdersDashboardFilter =
  "pending_fulfillment";

/** Tabs that show how many orders they hold, loaded after the page. */
export const COUNTED_ORDERS_DASHBOARD_FILTERS = [
  "pending_fulfillment",
  "zip_to_fix",
  "unprinted",
  "not_in_pack",
] as const satisfies readonly OrdersDashboardFilter[];

export const ORDERS_DASHBOARD_PATH = "/app/orders-dashboard";

const FILTER_LABELS: Record<OrdersDashboardFilter, TranslationKey> = {
  all: "filter.all",
  pending_fulfillment: "filter.pending_fulfillment",
  zip_to_fix: "filter.zip_to_fix",
  unprinted: "filter.unprinted",
  not_in_pack: "filter.not_in_pack",
};

/** The bulk jobs the dashboard offers on its selection. */
export type OrdersDashboardJob = "add-tracking" | "print-labels";

/**
 * The jobs each tab offers, so the admin only sees the next step:
 * "Pending fulfillment" ships (pickup orders are skipped by add tracking),
 * "Unprinted" prints. "ZIP to fix" has its own panel, which only adds
 * tracking.
 */
const JOBS_BY_FILTER: Record<OrdersDashboardFilter, OrdersDashboardJob[]> = {
  all: ["add-tracking", "print-labels"],
  pending_fulfillment: ["add-tracking"],
  zip_to_fix: ["add-tracking"],
  unprinted: ["print-labels"],
  not_in_pack: ["add-tracking", "print-labels"],
};

export function getFilterJobs(
  filter: OrdersDashboardFilter,
): readonly OrdersDashboardJob[] {
  return JOBS_BY_FILTER[filter];
}

/**
 * Falls back to the default tab for anything not in `allowed`, or to the
 * first allowed tab when the default is not one of them.
 */
export function parseOrdersDashboardFilter(
  value: string | null | undefined,
  allowed: readonly OrdersDashboardFilter[] = ORDERS_DASHBOARD_FILTERS,
): OrdersDashboardFilter {
  return (
    allowed.find((filter) => filter === value) ??
    (allowed.includes(DEFAULT_ORDERS_DASHBOARD_FILTER)
      ? DEFAULT_ORDERS_DASHBOARD_FILTER
      : allowed[0])
  );
}

export function formatOrdersDashboardFilter(
  filter: OrdersDashboardFilter,
  t: Translate = translateEn,
): string {
  return t(FILTER_LABELS[filter]);
}
