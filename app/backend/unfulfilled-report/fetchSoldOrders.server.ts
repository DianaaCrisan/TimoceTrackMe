import type { SoldOrdersQuery } from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { chunk } from "../graphql/utils/batch-utils";
import type { ReportItem } from "./buildUnfulfilledReport";

/** What one order sold, as the sold products report needs it. */
export type SoldOrder = {
  orderName: string;
  /** Shopify's delivery method: "PICK_UP", "SHIPPING"... */
  methodType: string | null;
  isCancelled: boolean;
  items: ReportItem[];
  /** The order has more line items than one read takes. */
  hasMoreItems: boolean;
};

/**
 * Up to 250 line items per order, so only a few orders per query keep its
 * requested cost under Shopify's 1,000 points. The real cost is far lower
 * and refunded, so this paces reads rather than slowing them much.
 */
const ORDERS_PER_QUERY = 3;
const INITIAL_EXPECTED_COST = 300;

const SOLD_ORDERS_QUERY = `#graphql
  query SoldOrders($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        cancelledAt
        fulfillmentOrders(first: 1) {
          nodes {
            deliveryMethod {
              methodType
            }
          }
        }
        lineItems(first: 250) {
          nodes {
            name
            currentQuantity
            variant {
              id
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    }
  }
`;

/** The orders by ID, as the database holds them for a pack. */
export async function fetchSoldOrders(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
): Promise<SoldOrder[]> {
  const batches = await Promise.all(
    chunk(orderIds, ORDERS_PER_QUERY).map((ids) =>
      runGraphQL<SoldOrdersQuery>(
        admin,
        shopUrl,
        "SoldOrders",
        SOLD_ORDERS_QUERY,
        { ids },
        INITIAL_EXPECTED_COST,
      ),
    ),
  );

  return batches.flatMap((data) => parseSoldOrders(data.nodes));
}

/** Orders deleted in Shopify come back as null and are left out. */
export function parseSoldOrders(nodes: SoldOrdersQuery["nodes"]): SoldOrder[] {
  return nodes.flatMap((node) => {
    if (!node || !("lineItems" in node)) return [];

    return [
      {
        orderName: node.name,
        methodType:
          node.fulfillmentOrders.nodes[0]?.deliveryMethod?.methodType ?? null,
        isCancelled: Boolean(node.cancelledAt),
        // removed or refunded items keep their line with quantity 0
        items: node.lineItems.nodes
          .filter((item) => item.currentQuantity > 0)
          .map((item) => ({
            variantId: item.variant?.id ?? null,
            name: item.name,
            quantity: item.currentQuantity,
          })),
        hasMoreItems: node.lineItems.pageInfo.hasNextPage,
      },
    ];
  });
}
