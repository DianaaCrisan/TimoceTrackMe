import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runBulkQuery } from "../graphql/bulk/runBulkQuery.server";

/** What is left to fulfil from one fulfillment order. */
export type OpenFulfillmentOrder = {
  id: string;
  orderId: string;
  orderName: string;
  /** Shopify's delivery method: "PICK_UP", "SHIPPING"... */
  methodType: string | null;
  lineItems: {
    variantId: string | null;
    name: string;
    remainingQuantity: number;
  }[];
};

/**
 * Every fulfillment order that is not closed, across all orders: open, in
 * progress, on hold or scheduled. Fulfilled and cancelled orders only have
 * closed ones, so this is exactly "what is still to be fulfilled", partially
 * fulfilled orders included, and unpaid orders too.
 *
 * A top-level connection keeps the nesting to one level, within the bulk
 * query limits; `order` is a plain object on each fulfillment order.
 *
 * Not tagged `#graphql`: it is a bulk query string, not an operation codegen
 * can type (no `first`).
 */
export const OPEN_FULFILLMENT_ORDERS_BULK_QUERY = `
{
  fulfillmentOrders(includeClosed: false) {
    edges {
      node {
        id
        status
        deliveryMethod {
          methodType
        }
        order {
          id
          name
        }
        lineItems {
          edges {
            node {
              id
              remainingQuantity
              lineItem {
                name
                variant {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

const CLOSED_STATUSES = new Set(["CLOSED", "CANCELLED"]);

export async function fetchOpenFulfillmentOrders(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
): Promise<OpenFulfillmentOrder[]> {
  const lines = await runBulkQuery(
    admin,
    shopUrl,
    OPEN_FULFILLMENT_ORDERS_BULK_QUERY,
  );
  return parseOpenFulfillmentOrders(lines);
}

type FulfillmentOrderLine = {
  id: string;
  status?: string | null;
  deliveryMethod?: { methodType?: string | null } | null;
  order?: { id: string; name: string } | null;
};

type LineItemLine = {
  __parentId: string;
  remainingQuantity?: number | null;
  lineItem?: { name?: string | null; variant?: { id: string } | null } | null;
};

/**
 * Rebuilds fulfillment orders from the bulk JSONL, where each line item is its
 * own line pointing at its fulfillment order with `__parentId`. Parents come
 * before their children, but not always right before, hence the map.
 */
export function parseOpenFulfillmentOrders(
  lines: unknown[],
): OpenFulfillmentOrder[] {
  const byId = new Map<string, OpenFulfillmentOrder>();
  const lineItemLines: LineItemLine[] = [];

  for (const line of lines) {
    if (!line || typeof line !== "object") continue;

    if ("__parentId" in line) {
      lineItemLines.push(line as LineItemLine);
      continue;
    }

    const fulfillmentOrder = line as FulfillmentOrderLine;
    if (
      !fulfillmentOrder.order ||
      CLOSED_STATUSES.has(fulfillmentOrder.status ?? "")
    ) {
      continue;
    }

    byId.set(fulfillmentOrder.id, {
      id: fulfillmentOrder.id,
      orderId: fulfillmentOrder.order.id,
      orderName: fulfillmentOrder.order.name,
      methodType: fulfillmentOrder.deliveryMethod?.methodType ?? null,
      lineItems: [],
    });
  }

  for (const line of lineItemLines) {
    const parent = byId.get(line.__parentId);
    const quantity = line.remainingQuantity ?? 0;
    if (!parent || quantity <= 0) continue;

    parent.lineItems.push({
      variantId: line.lineItem?.variant?.id ?? null,
      name: line.lineItem?.name ?? "",
      remainingQuantity: quantity,
    });
  }

  return [...byId.values()];
}
