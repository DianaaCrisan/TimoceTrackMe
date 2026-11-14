import type { OrderCustomerNotesQuery } from "app/types/admin.generated";
import {
  hasCustomerNote,
  toCustomerNote,
  type OrderWithCustomerNote,
} from "app/commons/orders/CustomerNote";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { chunk, SHOPIFY_READ_BATCH_SIZE } from "../graphql/utils/batch-utils";

const INITIAL_EXPECTED_COST = 20;

const ORDER_CUSTOMER_NOTES_QUERY = `#graphql
  query OrderCustomerNotes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        note
        customAttributes {
          key
          value
        }
        customer {
          displayName
        }
      }
    }
  }
`;

/**
 * The orders, of those given, that the customer wrote something on, in the
 * order given. Reads in batches, so a whole tab (up to the job limit) works.
 */
export async function getOrdersWithCustomerNotes(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
): Promise<OrderWithCustomerNote[]> {
  const batches = await Promise.all(
    chunk(orderIds, SHOPIFY_READ_BATCH_SIZE).map((ids) =>
      runGraphQL<OrderCustomerNotesQuery>(
        admin,
        shopUrl,
        "OrderCustomerNotes",
        ORDER_CUSTOMER_NOTES_QUERY,
        { ids },
        INITIAL_EXPECTED_COST,
      ),
    ),
  );

  return batches.flatMap((data) =>
    data.nodes.flatMap((node) => {
      if (!node || !("name" in node)) return [];

      const customerNote = toCustomerNote(node.note, node.customAttributes);
      if (!hasCustomerNote(customerNote)) return [];

      return [
        {
          id: node.id,
          name: node.name,
          customerName: node.customer?.displayName ?? "",
          ...customerNote,
        },
      ];
    }),
  );
}
