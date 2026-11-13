import type { GetOrderNamesQuery } from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { chunk } from "../graphql/utils/batch-utils";

/** `nodes(ids:)` takes at most 250 IDs. */
const NODES_BATCH_SIZE = 250;
const INITIAL_EXPECTED_COST = 10;

const GET_ORDER_NAMES_QUERY = `#graphql
  query GetOrderNames($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
      }
    }
  }
`;

/**
 * Order names ("#1234") by ID, for reports that list orders the job itself
 * never loaded, such as skipped ones. An ID Shopify does not return is absent.
 */
export async function getOrderNames(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
): Promise<Map<string, string>> {
  const namesById = new Map<string, string>();

  for (const batch of chunk(orderIds, NODES_BATCH_SIZE)) {
    const data = await runGraphQL<GetOrderNamesQuery>(
      admin,
      shopUrl,
      "GetOrderNames",
      GET_ORDER_NAMES_QUERY,
      { ids: batch },
      INITIAL_EXPECTED_COST,
    );

    for (const node of data.nodes) {
      if (node && "name" in node) namesById.set(node.id, node.name);
    }
  }

  return namesById;
}
