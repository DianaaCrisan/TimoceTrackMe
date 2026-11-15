import { buildPackUrl } from "../packs/FulfillmentPack";
import {
  ORDERS_DASHBOARD_FILTERS,
  ORDERS_DASHBOARD_PATH,
  PACK_DASHBOARD_FILTERS,
  type OrdersDashboardFilter,
} from "./OrdersDashboardFilter";

/**
 * Which orders the dashboard works on:
 * - `all`: every order in the shop (the Orders page)
 * - `pack`: one pack's orders. The tabs, counts, "Select all" and jobs all
 *   stay inside the pack.
 */
export type OrdersScope = { kind: "all" } | { kind: "pack"; packId: string };

export const ALL_ORDERS_SCOPE: OrdersScope = { kind: "all" };

export function getScopeFilters(
  scope: OrdersScope,
): readonly OrdersDashboardFilter[] {
  return scope.kind === "pack"
    ? PACK_DASHBOARD_FILTERS
    : ORDERS_DASHBOARD_FILTERS;
}

/** The page the scope's tabs and pagination link to. */
export function getScopeBasePath(scope: OrdersScope): string {
  return scope.kind === "pack"
    ? buildPackUrl(scope.packId)
    : ORDERS_DASHBOARD_PATH;
}

/**
 * The first page of a tab. Always names the filter, because a URL without one
 * opens the default tab, not "All".
 */
export function buildScopeTabUrl(
  scope: OrdersScope,
  filter: OrdersDashboardFilter,
): string {
  return `${getScopeBasePath(scope)}?filter=${filter}`;
}
