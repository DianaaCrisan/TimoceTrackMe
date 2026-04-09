import type {
  AddZipCodeToOrderMutation,
  AddZipCodeToOrderMutationVariables,
} from "app/types/admin.generated";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";

const INITIAL_EXPECTED_COST = 80;

const ADD_ZIP_CODE_TO_ORDER_MUTATION = `#graphql
  mutation AddZipCodeToOrder($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
        shippingAddress {
          address1
          city
          provinceCode
          zip
          countryCodeV2
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function addZipCodeToOrderMutation(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  input: AddZipCodeToOrderMutationVariables["input"],
): Promise<{ zip: string }> {
  const data = await runGraphQL<AddZipCodeToOrderMutation>(
    admin,
    shopUrl,
    "AddZipCodeToOrder",
    ADD_ZIP_CODE_TO_ORDER_MUTATION,
    { input },
    INITIAL_EXPECTED_COST,
  );

  const orderUpdateResponse = data.orderUpdate;
  const userErrors = orderUpdateResponse?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      `Add zip code mutation returned errors: ${JSON.stringify(userErrors)}`,
    );
  }

  const zipCode = orderUpdateResponse?.order?.shippingAddress?.zip;

  if (!zipCode) {
    throw new Error(
      `Order update mutation returned without zip code: ${orderUpdateResponse}`,
    );
  }

  return {
    zip: zipCode,
  };
}
