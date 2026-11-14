import { translateEn, type Translate } from "../i18n/translate";
import type { TranslationKey } from "../i18n/translations";

/** The dashboard tabs, in the order they are shown. */
export const ORDERS_DASHBOARD_FILTERS = [
  "all",
  "pending_fulfillment",
  "unprinted",
] as const;

export type OrdersDashboardFilter = (typeof ORDERS_DASHBOARD_FILTERS)[number];

/** The tab the dashboard opens on: the orders that still need work. */
export const DEFAULT_ORDERS_DASHBOARD_FILTER: OrdersDashboardFilter =
  "pending_fulfillment";

/** Tabs that show how many orders they hold, loaded after the page. */
export const COUNTED_ORDERS_DASHBOARD_FILTERS = [
  "pending_fulfillment",
  "unprinted",
] as const satisfies readonly OrdersDashboardFilter[];

export const ORDERS_DASHBOARD_PATH = "/app/orders-dashboard";

const FILTER_LABELS: Record<OrdersDashboardFilter, TranslationKey> = {
  all: "filter.all",
  pending_fulfillment: "filter.pending_fulfillment",
  unprinted: "filter.unprinted",
};

export function parseOrdersDashboardFilter(
  value: string | null | undefined,
): OrdersDashboardFilter {
  return (
    ORDERS_DASHBOARD_FILTERS.find((filter) => filter === value) ??
    DEFAULT_ORDERS_DASHBOARD_FILTER
  );
}

export function formatOrdersDashboardFilter(
  filter: OrdersDashboardFilter,
  t: Translate = translateEn,
): string {
  return t(FILTER_LABELS[filter]);
}

/**
 * The first page of a tab. Always names the filter, because a URL without one
 * opens the default tab, not "All".
 */
export function buildOrdersDashboardUrl(filter: OrdersDashboardFilter): string {
  return `${ORDERS_DASHBOARD_PATH}?filter=${filter}`;
}
