import type { OrdersDashboardQuery } from "app/types/admin.generated";
import type { CustomerNote } from "./CustomerNote";

type OrdersDashboardNode =
  OrdersDashboardQuery["orders"]["edges"][number]["node"];

/**
 * One row of the dashboard, with the customer's note cleaned up and the
 * weight in kg.
 */
export type OrdersDashboardOrder = Omit<
  OrdersDashboardNode,
  "note" | "customAttributes" | "currentTotalWeight"
> &
  CustomerNote & {
    /**
     * Every item on the order, as weighed when it was placed; null when no
     * product has a weight.
     */
    weightKg: number | null;
    /**
     * How many shipping labels the order shipped with. Only loaded for
     * fulfilled orders over the weight limit; null otherwise.
     */
    shippedParcelCount: number | null;
  };
