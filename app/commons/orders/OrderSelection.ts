import type { OrdersDashboardFilter } from "./OrdersDashboardFilter";

/**
 * What the user picked on the dashboard:
 * - `ids`: orders ticked by hand
 * - `filter`: "Select all N orders in this filter". The server finds the IDs
 *   itself, so the browser never has to load every page.
 */
export type OrderSelection =
  | { mode: "ids"; orderIds: string[] }
  | { mode: "filter"; filter: OrdersDashboardFilter };

export const ORDER_SELECTION_FIELDS = {
  mode: "selectionMode",
  orderIds: "selectedOrderIds",
  filter: "filter",
} as const;

export function appendOrderSelection(
  formData: FormData,
  selection: OrderSelection,
): void {
  formData.append(ORDER_SELECTION_FIELDS.mode, selection.mode);

  if (selection.mode === "filter") {
    formData.append(ORDER_SELECTION_FIELDS.filter, selection.filter);
    return;
  }

  selection.orderIds.forEach((orderId) =>
    formData.append(ORDER_SELECTION_FIELDS.orderIds, orderId),
  );
}
