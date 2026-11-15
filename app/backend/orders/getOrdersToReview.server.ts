import type { OrderToReviewQuery } from "app/types/admin.generated";
import {
  hasCustomerNote,
  toCustomerNote,
} from "app/commons/orders/CustomerNote";
import type { OrderToReview } from "app/commons/orders/TrackingReview";
import {
  isOverWeightLimit,
  type ParcelWeightSettings,
} from "app/commons/settings/ParcelWeightSettings";
import { toKilograms } from "app/commons/shipping/Weight";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { chunk, SHOPIFY_READ_BATCH_SIZE } from "../graphql/utils/batch-utils";

const INITIAL_EXPECTED_COST = 20;

const ORDER_TO_REVIEW_QUERY = `#graphql
  query OrderToReview($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        note
        customAttributes {
          key
          value
        }
        currentTotalWeight
        fulfillmentOrders(first: 1) {
          nodes {
            deliveryMethod {
              methodType
            }
          }
        }
        customer {
          displayName
        }
      }
    }
  }
`;

/**
 * The orders, of those given, that the admin should look at before add
 * tracking, in the order given:
 * - a customer note or checkout field
 * - shipping over the weight limit while auto split is off
 *
 * Reads in batches, so a whole tab (up to the job limit) works.
 */
export async function getOrdersToReview(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
  parcelWeight: ParcelWeightSettings,
): Promise<OrderToReview[]> {
  const batches = await Promise.all(
    chunk(orderIds, SHOPIFY_READ_BATCH_SIZE).map((ids) =>
      runGraphQL<OrderToReviewQuery>(
        admin,
        shopUrl,
        "OrderToReview",
        ORDER_TO_REVIEW_QUERY,
        { ids },
        INITIAL_EXPECTED_COST,
      ),
    ),
  );

  return batches.flatMap((data) =>
    data.nodes.flatMap((node) => {
      if (!node || !("name" in node)) return [];

      const customerNote = toCustomerNote(node.note, node.customAttributes);
      const weightKg = toKilograms(
        Number(node.currentTotalWeight ?? 0),
        "GRAMS",
      );
      const isShipping =
        node.fulfillmentOrders.nodes[0]?.deliveryMethod?.methodType ===
        "SHIPPING";
      const shipsOverWeightLimit =
        isShipping &&
        !parcelWeight.autoSplitHeavyOrders &&
        isOverWeightLimit(weightKg, parcelWeight);

      if (!hasCustomerNote(customerNote) && !shipsOverWeightLimit) return [];

      return [
        {
          id: node.id,
          name: node.name,
          customerName: node.customer?.displayName ?? "",
          ...customerNote,
          weightKg: weightKg > 0 ? weightKg : null,
          shipsOverWeightLimit,
        },
      ];
    }),
  );
}
