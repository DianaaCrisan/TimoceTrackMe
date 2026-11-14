import type { OrdersDashboardQuery } from "app/types/admin.generated";
import type { CustomerNote } from "./CustomerNote";

type OrdersDashboardNode =
  OrdersDashboardQuery["orders"]["edges"][number]["node"];

/** One row of the dashboard, with the customer's note cleaned up. */
export type OrdersDashboardOrder = Omit<
  OrdersDashboardNode,
  "note" | "customAttributes"
> &
  CustomerNote;
