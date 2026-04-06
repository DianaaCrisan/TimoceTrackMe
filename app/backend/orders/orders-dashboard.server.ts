import { PageInfo } from "app/types/admin.types";
import type {
  OrdersDashboardQuery,
  OrdersDashboardQueryVariables,
} from "../../types/admin.generated";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { FetchResponseBody } from "@shopify/admin-api-client";

const ORDER_PAGE_SIZE = 50;

type OrdersDashboardOrderRow = {
  id: string;
  name: string;
  createdAt: string;
};

type OrdersDashboardData = {
  orders: OrdersDashboardOrderRow[];
  pageInfo: PageInfo;
};

type OrdersDashboardPaginationInput = {
  after: string | null;
  before: string | null;
};

const ORDERS_DASHBOARD_QUERY = `#graphql
  query OrdersDashboard($first: Int, $last: Int, $after: String, $before: String) {
    orders(
      first: $first
      last: $last
      after: $after
      before: $before
      sortKey: CREATED_AT
      reverse: true
    ) {
        edges {
          cursor
          node {
            id
            name
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
`;

export async function getOrdersDashboardData(
  admin: AdminApiContextWithoutRest,
  pagination: OrdersDashboardPaginationInput,
): Promise<OrdersDashboardData> {
  const variables: OrdersDashboardQueryVariables =
    pagination.before != null
      ? {
          last: ORDER_PAGE_SIZE,
          before: pagination.before,
          first: null,
          after: null,
        }
      : {
          first: ORDER_PAGE_SIZE,
          after: pagination.after,
          last: null,
          before: null,
        };

  const response = await admin.graphql(ORDERS_DASHBOARD_QUERY, { variables });

  const responseJson: FetchResponseBody<OrdersDashboardQuery> =
    await response.json();

  const ordersConnection = responseJson.data?.orders;

  if (!ordersConnection) {
    return {
      orders: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    };
  }

  return {
    orders: ordersConnection.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      createdAt: edge.node.createdAt,
    })),
    pageInfo: {
      hasNextPage: ordersConnection.pageInfo.hasNextPage,
      hasPreviousPage: ordersConnection.pageInfo.hasPreviousPage,
      startCursor: ordersConnection.pageInfo.startCursor ?? null,
      endCursor: ordersConnection.pageInfo.endCursor ?? null,
    },
  };
}

export { ORDER_PAGE_SIZE };
