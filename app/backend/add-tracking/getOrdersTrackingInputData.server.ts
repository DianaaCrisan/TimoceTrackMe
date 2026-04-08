import type { FetchResponseBody } from "@shopify/admin-api-client";
import type {
  GetOrdersTrackingInputDataQuery,
  GetOrdersTrackingInputDataQueryVariables,
} from "app/types/admin.generated";
import { GET_ORDERS_TRACKING_INPUT_DATA_QUERY } from "./addTrackingNumbers.operations.server";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";

export type TrackingInputShippingAddress = {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  formatted: string[];
  name?: string | null;
  phone?: string | null;
};

export type TrackingInputLineItem = {
  fulfillmentOrderLineItemId: string;
  orderLineItemId: string;
  name: string;
  remainingQuantity: number;
  variantId?: string | null;
  weight?: number | null;
};

export type TrackingInputFulfillmentOrder = {
  id: string;
  status: string;
  deliveryMethod?: string | null;
  lineItems: TrackingInputLineItem[];
};

export type TrackingInputOrder = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  createdAt: string;
  shippingAddress?: TrackingInputShippingAddress | null;
  fulfillmentOrders: TrackingInputFulfillmentOrder[];
};

export async function getOrdersTrackingInputData(
  admin: AdminApiContextWithoutRest,
  orderIds: string[],
): Promise<TrackingInputOrder[]> {
  // TODO: allow maximum number of ids per batch
  const variables: GetOrdersTrackingInputDataQueryVariables = {
    ids: orderIds,
  };

  const response = await admin.graphql(GET_ORDERS_TRACKING_INPUT_DATA_QUERY, {
    variables,
  });

  const responseJson: FetchResponseBody<GetOrdersTrackingInputDataQuery> =
    await response.json();

  const nodes = responseJson.data?.nodes ?? [];

  return nodes.flatMap((node) => {
    if (!node || !("name" in node) || !("fulfillmentOrders" in node)) {
      return [];
    }

    return [
      {
        id: node.id,
        name: node.name,
        email: node.email ?? null,
        phone: node.phone ?? null,
        createdAt: node.createdAt,
        shippingAddress: node.shippingAddress
          ? {
              address1: node.shippingAddress.address1 ?? null,
              address2: node.shippingAddress.address2 ?? null,
              city: node.shippingAddress.city ?? null,
              province: node.shippingAddress.province ?? null,
              country: node.shippingAddress.country ?? null,
              zip: node.shippingAddress.zip ?? null,
              formatted: node.shippingAddress.formatted ?? [],
              name: node.shippingAddress.name ?? null,
              phone: node.shippingAddress.phone ?? null,
            }
          : null,
        fulfillmentOrders: node.fulfillmentOrders.edges.map((edge) => ({
          id: edge.node.id,
          status: edge.node.status,
          deliveryMethod: edge.node.deliveryMethod?.methodType ?? null,
          lineItems: edge.node.lineItems.edges.map((lineItemEdge) => ({
            fulfillmentOrderLineItemId: lineItemEdge.node.id,
            orderLineItemId: lineItemEdge.node.lineItem.id,
            name: lineItemEdge.node.lineItem.name,
            remainingQuantity: lineItemEdge.node.remainingQuantity,
            variantId: lineItemEdge.node.lineItem.variant?.id ?? null,
            weight:
              lineItemEdge.node.lineItem.variant?.inventoryItem?.measurement
                ?.weight?.value ?? null,
          })),
        })),
      },
    ];
  });
}
