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
import { toKilograms } from "app/commons/shipping/Weight";

const ORDER_PAGE_SIZE = 50;

type OrdersDashboardData = {
  orders: OrdersDashboardOrder[];
  pageInfo: PageInfo;
};

type OrdersDashboardPaginationInput = {
  after: string | null;
  before: string | null;
  filter: OrdersDashboardFilter;
  /** Only this pack's orders. */
  packTag?: string | null;
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
          currentTotalWeight
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
  const searchQuery = buildOrdersSearchQuery(
    pagination.filter,
    pagination.packTag ?? null,
  );

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
    orders: ordersConnection.edges.map((edge) =>
      toOrdersDashboardOrder(edge.node),
    ),
    pageInfo: {
      hasNextPage: ordersConnection.pageInfo.hasNextPage,
      hasPreviousPage: ordersConnection.pageInfo.hasPreviousPage,
      startCursor: ordersConnection.pageInfo.startCursor ?? null,
      endCursor: ordersConnection.pageInfo.endCursor ?? null,
    },
  };
}

export { ORDER_PAGE_SIZE };

type OrdersDashboardNode =
  OrdersDashboardQuery["orders"]["edges"][number]["node"];

/** One table row from an order read with the dashboard's fields. */
export function toOrdersDashboardOrder(
  node: OrdersDashboardNode,
): OrdersDashboardOrder {
  return {
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    displayFinancialStatus: node.displayFinancialStatus,
    displayFulfillmentStatus: node.displayFulfillmentStatus,
    currentSubtotalLineItemsQuantity: node.currentSubtotalLineItemsQuantity,
    cancelledAt: node.cancelledAt,
    weightKg: toOrderWeightKg(node.currentTotalWeight),
    shippedParcelCount: null,
    // cleaned up here, so the table never shows hidden app attributes
    ...toCustomerNote(node.note, node.customAttributes),
    shippingAddress: node.shippingAddress
      ? {
          zip: node.shippingAddress.zip,
          address1: node.shippingAddress.address1,
          address2: node.shippingAddress.address2,
          city: node.shippingAddress.city,
          province: node.shippingAddress.province,
        }
      : null,
    fulfillmentOrders: node.fulfillmentOrders,
    customer: {
      displayName: node.customer?.displayName ?? "",
    },
    netPaymentSet: {
      presentmentMoney: {
        amount: node.netPaymentSet.presentmentMoney.amount,
        currencyCode: node.netPaymentSet.presentmentMoney.currencyCode,
      },
    },
  };
}

/**
 * Shopify gives the order's weight in grams, as a string. Null when no
 * product on the order has a weight, so the table shows "-" instead of 0 kg.
 */
function toOrderWeightKg(grams: string | number | null): number | null {
  const weightKg = toKilograms(Number(grams ?? 0), "GRAMS");
  return Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null;
}
