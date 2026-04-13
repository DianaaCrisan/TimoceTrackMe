import type {
  FulfillmentCreateWithTrackingMutation,
  FulfillmentCreateWithTrackingMutationVariables,
} from "app/types/admin.generated";
import { FULFILLMENT_CREATE_WITH_TRACKING_MUTATION } from "./addTrackingNumbers.operations.server";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";

const INITIAL_EXPECTED_COST = 80;

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
  shopUrl: string,
  input: AddTrackingNumberToFulfillmentInput,
): Promise<void> {
  const isGLS = input.trackingNumber.startsWith("6");
  const url = isGLS
    ? process.env.GLS_TRACKING_URL + input.trackingNumber
    : process.env.OPTIMUS_TRACKING_URL + input.trackingNumber;

  const variables: FulfillmentCreateWithTrackingMutationVariables = {
    fulfillment: {
      notifyCustomer: true,
      trackingInfo: {
        company: "Optimus",
        number: input.trackingNumber,
        url,
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

  const data = await runGraphQL<FulfillmentCreateWithTrackingMutation>(
    admin,
    shopUrl,
    "FulfillmentCreateWithTracking",
    FULFILLMENT_CREATE_WITH_TRACKING_MUTATION,
    variables,
    INITIAL_EXPECTED_COST,
  );

  const payload = data.fulfillmentCreate;

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
