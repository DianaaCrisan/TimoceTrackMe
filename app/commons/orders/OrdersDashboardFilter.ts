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

/** Falls back to the default tab for anything not in `allowed`. */
export function parseOrdersDashboardFilter(
  value: string | null | undefined,
  allowed: readonly OrdersDashboardFilter[] = ORDERS_DASHBOARD_FILTERS,
): OrdersDashboardFilter {
  return (
    allowed.find((filter) => filter === value) ??
    DEFAULT_ORDERS_DASHBOARD_FILTER
  );
}

export function formatOrdersDashboardFilter(
  filter: OrdersDashboardFilter,
  t: Translate = translateEn,
): string {
  return t(FILTER_LABELS[filter]);
}
