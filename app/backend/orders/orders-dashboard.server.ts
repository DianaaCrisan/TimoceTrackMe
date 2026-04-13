import { PageInfo } from "app/types/admin.types";
import type {
  OrdersDashboardQuery,
  OrdersDashboardQueryVariables,
} from "../../types/admin.generated";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { FetchResponseBody } from "@shopify/admin-api-client";

const ORDER_PAGE_SIZE = 50;

export type OrdersDashboardFilter = "all" | "pending_fulfillment";

type OrdersDashboardData = {
  orders: OrdersDashboardQuery["orders"]["edges"][number]["node"][];
  pageInfo: PageInfo;
};

type OrdersDashboardPaginationInput = {
  after: string | null;
  before: string | null;
  filter: OrdersDashboardFilter;
};

const ORDERS_DASHBOARD_QUERY = `#graphql
  query OrdersDashboard(
    $first: Int
    $last: Int
    $after: String
    $before: String
    $query: String
  ) {
    orders(
      first: $first
      last: $last
      after: $after
      before: $before
      query: $query
      sortKey: CREATED_AT
      reverse: true
    ) {
      edges {
        cursor
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentSubtotalLineItemsQuantity
          cancelledAt

          shippingAddress {
            zip
          }
          
          fulfillmentOrders(first: 1) {
            edges {
              node {
                deliveryMethod {
                  methodType
                }
              }
            }
          }
          
          customer {
            displayName
          }
          
          netPaymentSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
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
  const searchQuery =
    pagination.filter === "pending_fulfillment"
      ? "fulfillment_status:unfulfilled"
      : null;

  const variables: OrdersDashboardQueryVariables =
    pagination.before != null
      ? {
          last: ORDER_PAGE_SIZE,
          before: pagination.before,
          first: null,
          after: null,
          query: searchQuery,
        }
      : {
          first: ORDER_PAGE_SIZE,
          after: pagination.after,
          last: null,
          before: null,
          query: searchQuery,
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
      displayFinancialStatus: edge.node.displayFinancialStatus,
      displayFulfillmentStatus: edge.node.displayFulfillmentStatus,
      currentSubtotalLineItemsQuantity:
        edge.node.currentSubtotalLineItemsQuantity,
      cancelledAt: edge.node.cancelledAt,
      shippingAddress: {
        zip: edge.node.shippingAddress?.zip,
      },
      fulfillmentOrders: edge.node.fulfillmentOrders,
      customer: {
        displayName: edge.node.customer?.displayName ?? "",
      },
      netPaymentSet: {
        presentmentMoney: {
          amount: edge.node.netPaymentSet.presentmentMoney.amount,
          currencyCode: edge.node.netPaymentSet.presentmentMoney.currencyCode,
        },
      },
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
