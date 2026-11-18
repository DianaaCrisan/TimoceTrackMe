import type {
  AddPackTagsMutation,
  RemovePackTagsMutation,
} from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import type { TagSyncPlan } from "./planTagSync";

/** A mutation costs 10 points. */
const MUTATION_COST = 10;

/**
 * Waits before the 2nd and 3rd try. The GraphQL limiter only paces calls, it
 * does not retry them. `tagsAdd` and `tagsRemove` are idempotent, so a retry
 * after a call that did land is harmless.
 */
const RETRY_DELAYS_MS = [500, 1000];

const ADD_PACK_TAGS_MUTATION = `#graphql
  mutation AddPackTags($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        message
      }
    }
  }
`;

const REMOVE_PACK_TAGS_MUTATION = `#graphql
  mutation RemovePackTags($id: ID!, $tags: [String!]!) {
    tagsRemove(id: $id, tags: $tags) {
      userErrors {
        message
      }
    }
  }
`;

/**
 * Both in one request: same cost, one round trip. Top-level mutation fields
 * run one after the other, so the removal lands first.
 */
const SWAP_PACK_TAGS_MUTATION = `#graphql
  mutation SwapPackTags($id: ID!, $remove: [String!]!, $add: [String!]!) {
    tagsRemove(id: $id, tags: $remove) {
      userErrors {
        message
      }
    }
    tagsAdd(id: $id, tags: $add) {
      userErrors {
        message
      }
    }
  }
`;

type SwapPackTagsResult = RemovePackTagsMutation & AddPackTagsMutation;

/** Sends one order's tag calls, with retries. Throws if they fail. */
export async function applyTagSync(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderId: string,
  { remove, add }: TagSyncPlan,
): Promise<void> {
  if (remove.length === 0 && add.length === 0) return;

  await withRetries(async () => {
    if (remove.length > 0 && add.length > 0) {
      const data = await runGraphQL<SwapPackTagsResult>(
        admin,
        shopUrl,
        "SwapPackTags",
        SWAP_PACK_TAGS_MUTATION,
        { id: orderId, remove, add },
        2 * MUTATION_COST,
      );
      throwOnUserErrors([
        ...(data.tagsRemove?.userErrors ?? []),
        ...(data.tagsAdd?.userErrors ?? []),
      ]);
    } else if (add.length > 0) {
      const data = await runGraphQL<AddPackTagsMutation>(
        admin,
        shopUrl,
        "AddPackTags",
        ADD_PACK_TAGS_MUTATION,
        { id: orderId, tags: add },
        MUTATION_COST,
      );
      throwOnUserErrors(data.tagsAdd?.userErrors);
    } else {
      const data = await runGraphQL<RemovePackTagsMutation>(
        admin,
        shopUrl,
        "RemovePackTags",
        REMOVE_PACK_TAGS_MUTATION,
        { id: orderId, tags: remove },
        MUTATION_COST,
      );
      throwOnUserErrors(data.tagsRemove?.userErrors);
    }
  });
}

async function withRetries(step: () => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await step();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function throwOnUserErrors(
  userErrors: { message: string }[] | undefined,
): void {
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}
