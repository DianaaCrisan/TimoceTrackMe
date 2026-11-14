import type { OrdersDashboardOrder } from "app/commons/orders/OrdersDashboardOrder";
import { PageInfo } from "app/types/admin.types";
import type {
  OrdersDashboardQuery,
  OrdersDashboardQueryVariables,
} from "../../types/admin.generated";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { FetchResponseBody } from "@shopify/admin-api-client";
import type { OrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import { buildOrdersSearchQuery } from "./buildOrdersSearchQuery";
import { toCustomerNote } from "app/commons/orders/CustomerNote";

const ORDER_PAGE_SIZE = 50;

type OrdersDashboardData = {
  orders: OrdersDashboardOrder[];
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
          note
          customAttributes {
            key
            value
          }

          shippingAddress {
            zip
            address1
            address2
            city
            province
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
  const searchQuery = buildOrdersSearchQuery(pagination.filter);

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
      // cleaned up here, so the table never shows hidden app attributes
      ...toCustomerNote(edge.node.note, edge.node.customAttributes),
      shippingAddress: edge.node.shippingAddress
        ? {
            zip: edge.node.shippingAddress.zip,
            address1: edge.node.shippingAddress.address1,
            address2: edge.node.shippingAddress.address2,
            city: edge.node.shippingAddress.city,
            province: edge.node.shippingAddress.province,
          }
        : null,
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
