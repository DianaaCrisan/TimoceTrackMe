import type { ShippedParcelCountsQuery } from "app/types/admin.generated";
import type { OrdersDashboardOrder } from "app/commons/orders/OrdersDashboardOrder";
import {
  isOverWeightLimit,
  type ParcelWeightSettings,
} from "app/commons/settings/ParcelWeightSettings";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { chunk } from "../graphql/utils/batch-utils";

/**
 * Small batches: each order asks for up to 20 fulfillments, and Shopify
 * refuses a single query that may cost more than 1000 points.
 */
const ORDERS_PER_QUERY = 10;
const INITIAL_EXPECTED_COST = 400;

const SHIPPED_PARCEL_COUNTS_QUERY = `#graphql
  query ShippedParcelCounts($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        fulfillments(first: 20) {
          status
          trackingInfo(first: 1) {
            number
          }
        }
      }
    }
  }
`;

/**
 * How many shipping labels each order shipped with, by order ID: its
 * fulfillments that are still active and carry a tracking number. Cancelled
 * fulfillments, and ones made without a label, do not count.
 */
export async function getShippedParcelCounts(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
): Promise<Map<string, number>> {
  const batches = await Promise.all(
    chunk(orderIds, ORDERS_PER_QUERY).map((ids) =>
      runGraphQL<ShippedParcelCountsQuery>(
        admin,
        shopUrl,
        "ShippedParcelCounts",
        SHIPPED_PARCEL_COUNTS_QUERY,
        { ids },
        INITIAL_EXPECTED_COST,
      ),
    ),
  );

  return new Map(
    batches.flatMap((data) =>
      data.nodes.flatMap((node) =>
        node && "fulfillments" in node
          ? [
              [
                node.id,
                node.fulfillments.filter(
                  (fulfillment) =>
                    fulfillment.status === "SUCCESS" &&
                    fulfillment.trackingInfo.length > 0,
                ).length,
              ] as const,
            ]
          : [],
      ),
    ),
  );
}

/**
 * Fills in `shippedParcelCount` for the fulfilled orders over the weight
 * limit, the only ones whose badge shows it. A failed read leaves it unset:
 * the badge then falls back to the weight warning instead of breaking the
 * page.
 */
export async function withShippedParcelCounts(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orders: OrdersDashboardOrder[],
  parcelWeight: ParcelWeightSettings,
): Promise<OrdersDashboardOrder[]> {
  const orderIds = orders
    .filter(
      (order) =>
        order.displayFulfillmentStatus === "FULFILLED" &&
        isOverWeightLimit(order.weightKg, parcelWeight),
    )
    .map((order) => order.id);
  if (orderIds.length === 0) return orders;

  try {
    const counts = await getShippedParcelCounts(admin, shopUrl, orderIds);
    return orders.map((order) => ({
      ...order,
      shippedParcelCount: counts.get(order.id) ?? null,
    }));
  } catch (error) {
    console.error(
      "AppError[OrdersDashboard] could not count the shipped parcels.",
      error,
    );
    return orders;
  }
}
