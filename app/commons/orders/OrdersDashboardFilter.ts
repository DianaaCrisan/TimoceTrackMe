export type OrdersDashboardFilter = "all" | "pending_fulfillment";

export function parseOrdersDashboardFilter(
  value: string | null | undefined,
): OrdersDashboardFilter {
  return value === "pending_fulfillment" ? "pending_fulfillment" : "all";
}

export function formatOrdersDashboardFilter(
  filter: OrdersDashboardFilter,
): string {
  return filter === "pending_fulfillment" ? "Pending fulfillment" : "All";
}
