import type {
  ShippingLabelOrderQuery,
  ShippingLabelOrdersQuery,
  ShippingLabelOrderByNameQuery,
} from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import type { OrderSnapshot } from "./reconcileOrderLabels";

/**
 * Shopify refuses a query whose estimated cost is over 1000. Each order
 * costs about 1 + 10 fulfillments × (1 + 3 tracking entries) = 41, so 20
 * orders stay near 820.
 */
const ORDERS_PAGE_SIZE = 20;

const ORDER_FIELDS = `#graphql
  fragment ShippingLabelOrderFields on Order {
    id
    name
    createdAt
    cancelledAt
    fulfillments(first: 10) {
      id
      status
      createdAt
      updatedAt
      trackingInfo(first: 3) {
        number
        company
      }
    }
  }
`;

const SHIPPING_LABEL_ORDER_QUERY = `#graphql
  ${ORDER_FIELDS}
  query ShippingLabelOrder($id: ID!) {
    order(id: $id) {
      ...ShippingLabelOrderFields
    }
  }
`;

const SHIPPING_LABEL_ORDERS_QUERY = `#graphql
  ${ORDER_FIELDS}
  query ShippingLabelOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) {
      nodes {
        ...ShippingLabelOrderFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const SHIPPING_LABEL_ORDER_BY_NAME_QUERY = `#graphql
  query ShippingLabelOrderByName($query: String!) {
    orders(first: 5, query: $query) {
      nodes {
        id
        name
        createdAt
      }
    }
  }
`;

type OrderNode = NonNullable<ShippingLabelOrderQuery["order"]>;

/** One order and its fulfillments; null when Shopify has no such order. */
export async function fetchOrderFulfillments(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderId: string,
): Promise<OrderSnapshot | null> {
  const data = await runGraphQL<ShippingLabelOrderQuery>(
    admin,
    shopUrl,
    "ShippingLabelOrder",
    SHIPPING_LABEL_ORDER_QUERY,
    { id: orderId },
  );
  return data.order ? toOrderSnapshot(data.order) : null;
}

/**
 * Every order changed since `updatedFrom` and created before `createdBefore`,
 * with its fulfillments, a page at a time. An AWB issued in a month sits on
 * an order created before the month ended and changed since it started.
 */
export async function* fetchOrdersFulfillments(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  range: { updatedFrom: Date; createdBefore: Date },
): AsyncGenerator<OrderSnapshot[]> {
  const query =
    `updated_at:>='${range.updatedFrom.toISOString()}' AND ` +
    `created_at:<'${range.createdBefore.toISOString()}'`;
  let after: string | null = null;

  do {
    const data: ShippingLabelOrdersQuery =
      await runGraphQL<ShippingLabelOrdersQuery>(
        admin,
        shopUrl,
        "ShippingLabelOrders",
        SHIPPING_LABEL_ORDERS_QUERY,
        { first: ORDERS_PAGE_SIZE, after, query },
      );
    yield data.orders.nodes.map(toOrderSnapshot);
    after = data.orders.pageInfo.hasNextPage
      ? (data.orders.pageInfo.endCursor ?? null)
      : null;
  } while (after);
}

/** The order named exactly `#1022`, or null. */
export async function findOrderByName(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderName: string,
): Promise<{ id: string; name: string; createdAt: Date } | null> {
  const data = await runGraphQL<ShippingLabelOrderByNameQuery>(
    admin,
    shopUrl,
    "ShippingLabelOrderByName",
    SHIPPING_LABEL_ORDER_BY_NAME_QUERY,
    { query: `name:${orderName}` },
  );
  // the search is loose; keep only the exact name
  const match = data.orders.nodes.find((node) => node.name === orderName);
  return match
    ? { id: match.id, name: match.name, createdAt: new Date(match.createdAt) }
    : null;
}

function toOrderSnapshot(order: OrderNode): OrderSnapshot {
  return {
    id: order.id,
    name: order.name,
    createdAt: new Date(order.createdAt),
    isCancelled: Boolean(order.cancelledAt),
    fulfillments: order.fulfillments.map((fulfillment) => ({
      id: fulfillment.id,
      status: fulfillment.status,
      createdAt: new Date(fulfillment.createdAt),
      updatedAt: new Date(fulfillment.updatedAt),
      tracking: fulfillment.trackingInfo.flatMap((info) =>
        info.number
          ? [{ number: info.number, company: info.company ?? null }]
          : [],
      ),
    })),
  };
}
