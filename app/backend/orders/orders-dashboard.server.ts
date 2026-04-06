import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";

const ORDER_PAGE_SIZE = 50;

export type OrdersDashboardOrderRow = {
  id: string;
  name: string;
  createdAt: string;
};

export type OrdersDashboardPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type OrdersDashboardData = {
  orders: OrdersDashboardOrderRow[];
  pageInfo: OrdersDashboardPageInfo;
};

export type OrdersDashboardPaginationInput = {
  after: string | null;
  before: string | null;
};

export const ORDERS_DASHBOARD_QUERY = `#graphql
  query OrdersDashboard($first: Int, $last: Int, $after: String, $before: String) {
    orders(first: $first, last: $last, after: $after, before: $before) {
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

type OrdersDashboardQueryResponse = {
  data: {
    orders: {
      edges: Array<{
        cursor: string;
        node: {
          id: string;
          name: string;
          createdAt: string;
        };
      }>;
      pageInfo: OrdersDashboardPageInfo;
    };
  };
};

export async function getOrdersDashboardData(
  admin: AdminApiContextWithoutRest,
  pagination: OrdersDashboardPaginationInput,
): Promise<OrdersDashboardData> {
  const variables =
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
  const responseJson = (await response.json()) as OrdersDashboardQueryResponse;

  const ordersConnection = responseJson.data.orders;

  return {
    orders: ordersConnection.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      createdAt: edge.node.createdAt,
    })),
    pageInfo: ordersConnection.pageInfo,
  };
}

export { ORDER_PAGE_SIZE };
