import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { GET_ORDERS_PRINT_LABELS_INPUT_QUERY } from "./printLabels.operations.server";
import type { GetOrdersPrintLabelsInputQuery } from "app/types/admin.generated";

const INITIAL_EXPECTED_COST = 80;

export type PrintLabelsOrder = {
  id: string;
  name: string;
  createdAt: string;
  isPickup: boolean;
  pickupData?: {
    email?: string | null;
    phone?: string | null;
    confirmationNumber?: string | null;
    billingFirstName?: string | null;
    billingLastName?: string | null;
  };
  pickupFulfillmentOrders: {
    fulfillmentOrderId: string;
    lineItems: {
      name: string;
      quantity: number;
      sku?: string | null;
      variantId?: string | null;
    }[];
  }[];
  deliveryFulfillments: {
    fulfillmentId: string;
    fulfillmentName: string;
    trackingNumber: string;
    lineItems: {
      name: string;
      quantity: number;
      sku?: string | null;
      variantId?: string | null;
    }[];
  }[];
};

export async function getOrdersPrintLabelsInputData(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
): Promise<PrintLabelsOrder[]> {
  const data = await runGraphQL<GetOrdersPrintLabelsInputQuery>(
    admin,
    shopUrl,
    "GetOrdersPrintLabelsInput",
    GET_ORDERS_PRINT_LABELS_INPUT_QUERY,
    { ids: orderIds },
    INITIAL_EXPECTED_COST,
  );

  const nodes = data.nodes ?? [];

  return nodes
    .filter((node): node is NonNullable<typeof node> => !!node)
    .map((order) => {
      // PICKUP DETECTION
      const shippingEdges = order.shippingLines?.edges ?? [];
      const firstShipping = shippingEdges[0]?.node;
      const isPickup = !firstShipping?.taxLines?.length;

      // PICKUP FULFILLMENTS
      const pickupFulfillmentOrders =
        order.fulfillmentOrders?.edges
          .map((edge) => edge.node)
          .filter(
            (fulfillmentOrder) =>
              fulfillmentOrder.deliveryMethod?.methodType === "PICK_UP" &&
              fulfillmentOrder.lineItems.edges.some(
                (lineItemEdge) => lineItemEdge.node.remainingQuantity > 0,
              ),
          )
          .map((fulfillmentOrder) => ({
            fulfillmentOrderId: fulfillmentOrder.id,
            lineItems: fulfillmentOrder.lineItems.edges
              .filter((lineItemEdge) => lineItemEdge.node.remainingQuantity > 0)
              .map((lineItemEdge) => ({
                name: lineItemEdge.node.lineItem.name,
                quantity: lineItemEdge.node.remainingQuantity,
                sku: lineItemEdge.node.lineItem.sku,
                variantId: lineItemEdge.node.lineItem.variant?.id,
              })),
          })) ?? [];

      // DELIVERY FULFILLMENTS
      const deliveryFulfillments =
        order.fulfillments?.flatMap((fulfillment) => {
          if (!fulfillment) return [];
          if (fulfillment.displayStatus === "CANCELED") return [];
          if (
            !fulfillment.trackingInfo ||
            fulfillment.trackingInfo.length !== 1
          ) {
            return [];
          }
          const trackingNumber = fulfillment.trackingInfo[0]?.number;
          if (!trackingNumber) {
            return [];
          }

          const lineItems =
            fulfillment.fulfillmentLineItems?.edges.flatMap((edge) => {
              const quantity = edge.node.quantity;
              if (quantity == null) return [];

              return [
                {
                  name: edge.node.lineItem.name,
                  quantity,
                  sku: edge.node.lineItem.sku,
                  variantId: edge.node.lineItem.variant?.id ?? null,
                },
              ];
            }) ?? [];

          return [
            {
              fulfillmentId: fulfillment.id,
              fulfillmentName: fulfillment.name,
              trackingNumber,
              lineItems,
            },
          ];
        }) ?? [];

      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        isPickup,
        pickupData: isPickup
          ? {
              email: order.email,
              phone: order.phone,
              confirmationNumber: order.confirmationNumber,
              billingFirstName: order.billingAddress?.firstName,
              billingLastName: order.billingAddress?.lastName,
            }
          : undefined,
        pickupFulfillmentOrders,
        deliveryFulfillments,
      };
    });
}
