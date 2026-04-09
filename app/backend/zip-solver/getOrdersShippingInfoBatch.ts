import type { FetchResponseBody } from "@shopify/admin-api-client";
import type {
  GetOrdersShippingInfoBatchQuery,
  GetOrdersShippingInfoBatchQueryVariables,
} from "app/types/admin.generated";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { chunk, SHOPIFY_READ_BATCH_SIZE } from "../graphql/utils/batch-utils";

const GET_ORDERS_SHIPPING_INFO_BATCH_QUERY = `#graphql
  query GetOrdersShippingInfoBatch($orderIds: [ID!]!) {
    nodes(ids: $orderIds) {
      __typename
      ... on Order {
        id
        name
        shippingAddress {
          zip
          address1
          city
          provinceCode
        }
        shippingLines(first: 2) {
          edges {
            node {
              title
              taxLines {
                title
                ratePercentage
              }
            }
          }
        }
      }
    }
  }
`;

export type ShopifyOrderShippingInfo = Extract<
  NonNullable<GetOrdersShippingInfoBatchQuery["nodes"]>[number],
  { __typename: "Order" }
>;

export async function getOrdersShippingInfoBatch(
  admin: AdminApiContextWithoutRest,
  orderIds: string[],
): Promise<ShopifyOrderShippingInfo[]> {
  if (orderIds.length === 0) {
    return [];
  }

  const variables: GetOrdersShippingInfoBatchQueryVariables = {
    orderIds,
  };

  const response = await admin.graphql(GET_ORDERS_SHIPPING_INFO_BATCH_QUERY, {
    variables,
  });

  const responseJson: FetchResponseBody<GetOrdersShippingInfoBatchQuery> =
    await response.json();

  const nodes = responseJson.data?.nodes ?? [];

  return nodes.filter(
    (node): node is ShopifyOrderShippingInfo => node?.__typename === "Order",
  );
}

export async function getOrdersShippingInfoInBatches(
  admin: AdminApiContextWithoutRest,
  orderIds: string[],
): Promise<ShopifyOrderShippingInfo[]> {
  const batches = chunk(orderIds, SHOPIFY_READ_BATCH_SIZE);

  const results = await Promise.all(
    batches.map((batch) => getOrdersShippingInfoBatch(admin, batch)),
  );

  return results.flat();
}
