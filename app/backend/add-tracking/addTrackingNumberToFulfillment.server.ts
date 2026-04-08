import type { FetchResponseBody } from "@shopify/admin-api-client";
import type {
  FulfillmentCreateWithTrackingMutation,
  FulfillmentCreateWithTrackingMutationVariables,
} from "app/types/admin.generated";
import { FULFILLMENT_CREATE_WITH_TRACKING_MUTATION } from "./addTrackingNumbers.operations.server";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";

type AddTrackingNumberToFulfillmentInput = {
  fulfillmentOrderId: string;
  fulfillmentOrderLineItems: {
    id: string;
    quantity: number;
  }[];
  trackingNumber: string;
};

export async function addTrackingNumberToFulfillment(
  admin: AdminApiContextWithoutRest,
  input: AddTrackingNumberToFulfillmentInput,
): Promise<void> {
  const variables: FulfillmentCreateWithTrackingMutationVariables = {
    fulfillment: {
      notifyCustomer: true,
      trackingInfo: {
        company: "Optimus",
        number: input.trackingNumber,
        url: process.env.OPTIMUS_TRACKING_URL + input.trackingNumber, // TODO: distinguish between optimus and gls
      },
      lineItemsByFulfillmentOrder: [
        {
          fulfillmentOrderId: input.fulfillmentOrderId,
          fulfillmentOrderLineItems: input.fulfillmentOrderLineItems.map(
            (lineItem) => ({
              id: lineItem.id,
              quantity: lineItem.quantity,
            }),
          ),
        },
      ],
    },
  };

  const response = await admin.graphql(
    FULFILLMENT_CREATE_WITH_TRACKING_MUTATION,
    { variables },
  );

  const responseJson: FetchResponseBody<FulfillmentCreateWithTrackingMutation> =
    await response.json();

  const payload = responseJson.data?.fulfillmentCreate;

  if (!payload) {
    throw new Error("Shopify fulfillmentCreate returned no payload.");
  }

  if (payload.userErrors.length > 0) {
    throw new Error(
      payload.userErrors.map((error) => error.message).join("; "),
    );
  }

  if (!payload.fulfillment?.id) {
    throw new Error(
      "Shopify fulfillmentCreate did not return a fulfillment ID.",
    );
  }
}
