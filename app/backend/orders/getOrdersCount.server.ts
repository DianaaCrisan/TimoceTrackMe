import type { FetchResponseBody } from "@shopify/admin-api-client";
import type { OrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import type {
  OrdersCountForFilterQuery,
  OrdersCountForFilterQueryVariables,
} from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { buildOrdersSearchQuery } from "./buildOrdersSearchQuery";

const ORDERS_COUNT_FOR_FILTER_QUERY = `#graphql
  query OrdersCountForFilter($query: String) {
    ordersCount(query: $query) {
      count
      precision
    }
  }
`;

export type OrdersCount = {
  count: number;
  /** Shopify stops counting at 10,000 and then reports a lower bound. */
  isAtLeast: boolean;
};

export async function getOrdersCount(
  admin: AdminApiContextWithoutRest,
  filter: OrdersDashboardFilter,
): Promise<OrdersCount | null> {
  const variables: OrdersCountForFilterQueryVariables = {
    query: buildOrdersSearchQuery(filter),
  };

  const response = await admin.graphql(ORDERS_COUNT_FOR_FILTER_QUERY, {
    variables,
  });
  const responseJson: FetchResponseBody<OrdersCountForFilterQuery> =
    await response.json();

  const ordersCount = responseJson.data?.ordersCount;
  if (!ordersCount) return null;

  return {
    count: ordersCount.count,
    isAtLeast: ordersCount.precision === "AT_LEAST",
  };
}
