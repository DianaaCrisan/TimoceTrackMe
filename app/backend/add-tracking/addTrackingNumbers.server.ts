import { createPool } from "app/backend/graphql/throttle-handling/helpers/createPool";
import { createProgressLogger } from "app/backend/graphql/throttle-handling/helpers/createProgressLogger";
import { scheduleWithProgress } from "app/backend/graphql/throttle-handling/helpers/scheduleWithProgress";
import {
  getOrdersTrackingInputDataInBatches,
  type TrackingInputFulfillmentOrder,
  type TrackingInputOrder,
} from "./getOrdersTrackingInputData.server";
import { addTrackingNumberToFulfillment } from "./addTrackingNumberToFulfillment.server";
import type {
  AddTrackingNumbersFailedOrder,
  AddTrackingNumbersRequest,
  AddTrackingNumbersResult,
  AddTrackingNumbersSuccessfulOrder,
} from "./addTrackingNumbers.types";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { ADD_TRACKING_GRAPHQL_POOL_WORKERS } from "../graphql/throttle-handling/constants";
import { createOptimusTrackingNumber } from "../optimus/createOptimusTrackingNumber.server";
import { isEligibleForFulfillment } from "../graphql/utils/fulfillment-order-utils";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";

export async function addTrackingNumbers(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  request: AddTrackingNumbersRequest,
): Promise<AddTrackingNumbersResult> {
  const successfulOrders: AddTrackingNumbersSuccessfulOrder[] = [];
  const failedOrders: AddTrackingNumbersFailedOrder[] = [];

  const orders = await getOrdersTrackingInputDataInBatches(
    admin,
    request.orderIds,
  );
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  const pool = createPool(ADD_TRACKING_GRAPHQL_POOL_WORKERS);
  const progress = createProgressLogger(
    "AddTrackingNumbers",
    request.orderIds.length,
  );

  await Promise.all(
    request.orderIds.map((orderId) =>
      scheduleWithProgress(pool, progress, orderId, async () => {
        await processOneOrder({
          admin,
          shopUrl,
          orderId,
          order: ordersById.get(orderId),
          successfulOrders,
          failedOrders,
        });
      }),
    ),
  );

  return {
    ok: failedOrders.length === 0,
    successfulOrders,
    failedOrders,
  };
}

async function processOneOrder({
  admin,
  shopUrl,
  orderId,
  order,
  successfulOrders,
  failedOrders,
}: {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  orderId: string;
  order?: TrackingInputOrder;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
}) {
  try {
    if (!order) {
      failedOrders.push({
        id: orderId,
        name: "-",
        errors: ["Order was not returned by Shopify."],
      });
      return;
    }

    const shippingFulfillmentOrders =
      getEligibleShippingFulfillmentOrders(order);

    if (shippingFulfillmentOrders.length === 0) {
      failedOrders.push({
        id: order.id,
        name: order.name,
        errors: [
          "No shippable fulfillment order with remaining items was found.",
        ],
      });
      return;
    }

    const createdTrackingNumbers: string[] = [];
    const fulfillmentErrors: string[] = [];

    for (const fulfillmentOrder of shippingFulfillmentOrders) {
      try {
        const totalWeight = getTotalWeightForFulfillmentOrder(fulfillmentOrder);

        const awbResponse = await createOptimusTrackingNumber({
          orderName: order.name,
          email: order.email ?? undefined,
          name: order.shippingAddress?.name ?? order.name,
          phoneNumber: order.shippingAddress?.phone ?? order.phone ?? "",
          createdAt: order.createdAt,
          address: buildFullAddress(order),
          province: order.shippingAddress?.province ?? "",
          city: order.shippingAddress?.city ?? "",
          country: order.shippingAddress?.country ?? "",
          zip: order.shippingAddress?.zip ?? "",
          invoiceDetails: `Comanda ${order.name}`,
          weight: totalWeight.toString(),
          formatted: order.shippingAddress?.formatted.join(", ") ?? "",
        });

        await addTrackingNumberToFulfillment(admin, shopUrl, {
          fulfillmentOrderId: fulfillmentOrder.id,
          fulfillmentOrderLineItems: fulfillmentOrder.lineItems
            .filter((lineItem) => lineItem.remainingQuantity > 0)
            .map((lineItem) => ({
              id: lineItem.fulfillmentOrderLineItemId,
              quantity: lineItem.remainingQuantity,
            })),
          trackingNumber: awbResponse.trackingNumber,
        });

        createdTrackingNumbers.push(awbResponse.trackingNumber);
      } catch (fulfillmentError) {
        fulfillmentErrors.push(
          `Fulfillment ${ShopifyUtils.extractShopifyId(fulfillmentOrder.id)}: ${
            fulfillmentError instanceof Error
              ? fulfillmentError.message
              : String(fulfillmentError)
          }`,
        );
      }
    }

    if (createdTrackingNumbers.length > 0 && fulfillmentErrors.length === 0) {
      successfulOrders.push({
        id: order.id,
        name: order.name,
        trackingNumbers: createdTrackingNumbers,
      });
      return;
    }

    if (createdTrackingNumbers.length > 0 && fulfillmentErrors.length > 0) {
      failedOrders.push({
        id: order.id,
        name: order.name,
        errors: [
          "Some fulfillment orders succeeded and some failed.",
          ...fulfillmentErrors,
        ],
      });
      return;
    }

    failedOrders.push({
      id: order.id,
      name: order.name,
      errors:
        fulfillmentErrors.length > 0
          ? fulfillmentErrors
          : ["No tracking numbers were created for this order."],
    });
  } catch (error) {
    failedOrders.push({
      id: orderId,
      name: order?.name ?? "-",
      errors: [error instanceof Error ? error.message : String(error)],
    });
  }
}

function getEligibleShippingFulfillmentOrders(
  order: TrackingInputOrder,
): TrackingInputFulfillmentOrder[] {
  return order.fulfillmentOrders.filter((fulfillmentOrder) => {
    if (fulfillmentOrder.deliveryMethod !== "SHIPPING") {
      return false;
    }

    if (!isEligibleForFulfillment(fulfillmentOrder.status)) {
      return false;
    }

    return fulfillmentOrder.lineItems.some(
      (lineItem) => lineItem.remainingQuantity > 0,
    );
  });
}

function getTotalWeightForFulfillmentOrder(
  fulfillmentOrder: TrackingInputFulfillmentOrder,
): number {
  const totalWeight = fulfillmentOrder.lineItems.reduce((sum, lineItem) => {
    if (lineItem.remainingQuantity <= 0) {
      return sum;
    }

    const weight = Number(lineItem.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Missing or invalid weight for item "${lineItem.name}".`);
    }

    return sum + weight * lineItem.remainingQuantity;
  }, 0);

  if (totalWeight <= 0) {
    throw new Error("Total shipment weight must be greater than 0.");
  }

  return totalWeight;
}

function buildFullAddress(order: TrackingInputOrder): string {
  const addressParts = [
    order.shippingAddress?.address1,
    order.shippingAddress?.address2,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const fullAddress = addressParts.join(", ");

  if (!fullAddress) {
    throw new Error("Missing shipping address.");
  }

  if (!order.shippingAddress?.city) {
    throw new Error("Missing shipping city.");
  }

  if (!order.shippingAddress?.province) {
    throw new Error("Missing shipping province.");
  }

  if (!order.shippingAddress?.country) {
    throw new Error("Missing shipping country.");
  }

  if (!order.shippingAddress?.zip) {
    throw new Error("Missing shipping ZIP/postal code.");
  }

  const phoneNumber = order.shippingAddress.phone ?? order.phone;
  if (!phoneNumber) {
    throw new Error("Missing recipient phone number.");
  }

  return fullAddress;
}
