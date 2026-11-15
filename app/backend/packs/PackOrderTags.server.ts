import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";
import type {
  AddPackTagsMutation,
  RemovePackTagsMutation,
} from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { createPool } from "../graphql/throttle-handling/helpers/createPool";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { createJobAdmin } from "../jobs/createJobAdmin.server";
import type { OrderLeavingPack } from "./planMembershipChange";
import { PackRepository } from "./PackRepository.server";

const INITIAL_EXPECTED_COST = 10;
const ORDERS_TAGGED_AT_ONCE = 4;

/**
 * Waits before the 2nd and 3rd try of an order. The GraphQL limiter only
 * paces calls, it does not retry them, and on the webhook path nobody is
 * watching to press Retry. `tagsAdd` and `tagsRemove` are idempotent, so a
 * retry after a call that did land is harmless.
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

/** What changed in the database, for the tags to follow. */
export type PackTagWork = {
  /** The pack the `joining` and `moving` orders are now in. */
  targetPack?: { id: string; orderTag: string };
  /** Were in no pack. */
  joining?: string[];
  /** Came from another pack. */
  moving?: OrderLeavingPack[];
  /** Left their pack for no pack. */
  leaving?: OrderLeavingPack[];
};

/**
 * Tag work runs one batch at a time, in the order it was asked for. Without
 * this, an order moved A → B and straight on B → C could end up tagged with
 * both B and C, depending on which request's calls landed last.
 */
let tagQueue: Promise<void> = Promise.resolve();

/**
 * Brings the orders' tags in line with the database, in the background: the
 * database is already right, and a few hundred orders take a while to tag.
 *
 * - joining and moving orders get the target pack's tag and `in-pachet`;
 *   moving orders first lose their old pack's tag
 * - leaving orders lose their pack's tag and `in-pachet`
 *
 * Each order the target pack's tags reached is marked tagged. A failure is
 * logged and leaves the order untagged, for the pack's Retry button.
 */
export function startPackTagging(shop: string, shopUrl: string, work: PackTagWork) {
  const run = tagQueue.then(() =>
    applyPackTags(createJobAdmin(shop), shopUrl, work),
  );
  tagQueue = run.then(
    () => undefined,
    (error) => {
      console.error("AppError[PackTags] tagging stopped.", error);
    },
  );
}

export async function applyPackTags(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  { targetPack, joining = [], moving = [], leaving = [] }: PackTagWork,
): Promise<{ taggedOrderIds: string[]; failedOrderIds: string[] }> {
  const pool = createPool(ORDERS_TAGGED_AT_ONCE);
  const taggedOrderIds: string[] = [];
  const failedOrderIds: string[] = [];

  const tagOrder = (orderId: string, step: () => Promise<void>) =>
    pool.schedule(async () => {
      try {
        await withRetries(step);
        taggedOrderIds.push(orderId);
      } catch (error) {
        failedOrderIds.push(orderId);
        console.error(
          `AppError[PackTags] could not update the tags of ${orderId}.`,
          error,
        );
      }
    });

  const joinTags = targetPack ? [targetPack.orderTag, PACKED_ORDER_TAG] : [];

  await Promise.all([
    ...joining.map((orderId) =>
      tagOrder(orderId, () => addTags(admin, shopUrl, orderId, joinTags)),
    ),
    ...moving.map(({ orderId, fromTag }) =>
      tagOrder(orderId, async () => {
        await removeTags(admin, shopUrl, orderId, [fromTag]);
        await addTags(admin, shopUrl, orderId, joinTags);
      }),
    ),
    ...leaving.map(({ orderId, fromTag }) =>
      tagOrder(orderId, () =>
        removeTags(admin, shopUrl, orderId, [fromTag, PACKED_ORDER_TAG]),
      ),
    ),
  ]);

  if (targetPack) {
    const leavingIds = new Set(leaving.map((order) => order.orderId));
    await PackRepository.markTagged(
      targetPack.id,
      taggedOrderIds.filter((orderId) => !leavingIds.has(orderId)),
    );
  }

  return { taggedOrderIds, failedOrderIds };
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

async function addTags(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderId: string,
  tags: string[],
): Promise<void> {
  if (tags.length === 0) return;
  const data = await runGraphQL<AddPackTagsMutation>(
    admin,
    shopUrl,
    "AddPackTags",
    ADD_PACK_TAGS_MUTATION,
    { id: orderId, tags },
    INITIAL_EXPECTED_COST,
  );
  throwOnUserErrors(data.tagsAdd?.userErrors);
}

async function removeTags(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderId: string,
  tags: string[],
): Promise<void> {
  const data = await runGraphQL<RemovePackTagsMutation>(
    admin,
    shopUrl,
    "RemovePackTags",
    REMOVE_PACK_TAGS_MUTATION,
    { id: orderId, tags },
    INITIAL_EXPECTED_COST,
  );
  throwOnUserErrors(data.tagsRemove?.userErrors);
}

function throwOnUserErrors(
  userErrors: { message: string }[] | undefined,
): void {
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}
