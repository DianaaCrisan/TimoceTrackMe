import type {
  AddZipToFixTagMutation,
  RemoveZipToFixTagMutation,
} from "app/types/admin.generated";
import { ZIP_TO_FIX_ORDER_TAG } from "app/commons/constants";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";

const INITIAL_EXPECTED_COST = 10;

const ADD_ZIP_TO_FIX_TAG_MUTATION = `#graphql
  mutation AddZipToFixTag($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        field
        message
      }
    }
  }
`;

const REMOVE_ZIP_TO_FIX_TAG_MUTATION = `#graphql
  mutation RemoveZipToFixTag($id: ID!, $tags: [String!]!) {
    tagsRemove(id: $id, tags: $tags) {
      userErrors {
        field
        message
      }
    }
  }
`;

/** Puts the order on the "ZIP to fix" tab. */
export async function addZipToFixTag(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderId: string,
): Promise<void> {
  const data = await runGraphQL<AddZipToFixTagMutation>(
    admin,
    shopUrl,
    "AddZipToFixTag",
    ADD_ZIP_TO_FIX_TAG_MUTATION,
    { id: orderId, tags: [ZIP_TO_FIX_ORDER_TAG] },
    INITIAL_EXPECTED_COST,
  );
  throwOnUserErrors(data.tagsAdd?.userErrors);
}

/** Takes the order off the "ZIP to fix" tab. */
export async function removeZipToFixTag(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderId: string,
): Promise<void> {
  const data = await runGraphQL<RemoveZipToFixTagMutation>(
    admin,
    shopUrl,
    "RemoveZipToFixTag",
    REMOVE_ZIP_TO_FIX_TAG_MUTATION,
    { id: orderId, tags: [ZIP_TO_FIX_ORDER_TAG] },
    INITIAL_EXPECTED_COST,
  );
  throwOnUserErrors(data.tagsRemove?.userErrors);
}

function throwOnUserErrors(
  userErrors: { message: string }[] | null | undefined,
): void {
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}
