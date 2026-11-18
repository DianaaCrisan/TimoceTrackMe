import { MAX_ORDERS_PER_JOB } from "../constants";
import type { OrderSelection } from "./OrderSelection";
import type { OrdersDashboardFilter } from "./OrdersDashboardFilter";

/**
 * The dashboard's selection, as the admin builds it:
 * - `none`
 * - `ids`: orders ticked one by one, on any page of the tab
 * - `all`: every order in the tab, on every page, except `excluded` (the
 *   ones unticked afterwards). The header checkbox gives this, never "just
 *   this page", so a selection never stops short at the page's edge.
 */
export type DashboardSelection =
  | { kind: "none" }
  | { kind: "ids"; ids: string[] }
  | { kind: "all"; excluded: string[] };

export const NO_SELECTION: DashboardSelection = { kind: "none" };

export type HeaderCheckboxState = "checked" | "indeterminate" | "unchecked";

export function isOrderSelected(
  selection: DashboardSelection,
  orderId: string,
): boolean {
  switch (selection.kind) {
    case "none":
      return false;
    case "ids":
      return selection.ids.includes(orderId);
    case "all":
      return !selection.excluded.includes(orderId);
  }
}

/** How many orders the selection holds, given the tab's count. */
export function countSelected(
  selection: DashboardSelection,
  tabCount: number,
): number {
  switch (selection.kind) {
    case "none":
      return 0;
    case "ids":
      return selection.ids.length;
    case "all":
      return Math.max(0, tabCount - selection.excluded.length);
  }
}

/** Ticks or unticks one order. Ticking by hand stops at `maxIds`. */
export function toggleOrder(
  selection: DashboardSelection,
  orderId: string,
  { tabCount, maxIds = MAX_ORDERS_PER_JOB }: { tabCount: number; maxIds?: number },
): DashboardSelection {
  switch (selection.kind) {
    case "none":
      return { kind: "ids", ids: [orderId] };
    case "ids": {
      if (selection.ids.includes(orderId)) {
        const ids = selection.ids.filter((id) => id !== orderId);
        return ids.length > 0 ? { kind: "ids", ids } : NO_SELECTION;
      }
      if (selection.ids.length >= maxIds) return selection;
      return { kind: "ids", ids: [...selection.ids, orderId] };
    }
    case "all": {
      if (selection.excluded.includes(orderId)) {
        return {
          kind: "all",
          excluded: selection.excluded.filter((id) => id !== orderId),
        };
      }
      const excluded = [...selection.excluded, orderId];
      return excluded.length >= tabCount
        ? NO_SELECTION
        : { kind: "all", excluded };
    }
  }
}

/**
 * The header checkbox: selects every order in the tab, or clears the
 * selection when that is exactly what is selected.
 */
export function toggleAll(selection: DashboardSelection): DashboardSelection {
  return headerCheckboxState(selection) === "checked"
    ? NO_SELECTION
    : { kind: "all", excluded: [] };
}

export function headerCheckboxState(
  selection: DashboardSelection,
): HeaderCheckboxState {
  if (selection.kind === "none") return "unchecked";
  if (selection.kind === "all" && selection.excluded.length === 0) {
    return "checked";
  }
  return "indeterminate";
}

/**
 * Why "select all" is not offered, or null when it is: the tab must have a
 * known count that one action can take.
 */
export function getSelectAllBlocker(
  ordersCount: { count: number; isAtLeast: boolean } | null,
  max = MAX_ORDERS_PER_JOB,
): "unknown" | "tooMany" | "empty" | null {
  if (!ordersCount) return "unknown";
  if (ordersCount.isAtLeast || ordersCount.count > max) return "tooMany";
  if (ordersCount.count === 0) return "empty";
  return null;
}

/** What the server is sent; null for an empty selection. */
export function toOrderSelection(
  selection: DashboardSelection,
  filter: OrdersDashboardFilter,
  packId: string | null,
): OrderSelection | null {
  const inPack = packId ? { packId } : {};

  switch (selection.kind) {
    case "none":
      return null;
    case "ids":
      return { mode: "ids", orderIds: selection.ids, ...inPack };
    case "all":
      return {
        mode: "filter",
        filter,
        ...(selection.excluded.length > 0
          ? { excludedOrderIds: selection.excluded }
          : {}),
        ...inPack,
      };
  }
}
