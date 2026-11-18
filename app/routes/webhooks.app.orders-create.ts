import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { PackService } from "app/backend/packs/PackService.server";
import { readNewOrderWebhook } from "app/backend/packs/readNewOrderWebhook";

/**
 * Every new order goes into the filling pack. See
 * docs/fulfillment-packs-plan.md, phase 2.
 *
 * The status tells Shopify whether to send the webhook again (it retries any
 * non-2xx for about 48 hours):
 * - 200: assigned, already in a pack, skipped, or something a retry cannot
 *   fix (no session, unreadable payload). Logged, and the order shows up
 *   under Orders → Not in a pack.
 * - 500: the database write failed. A retry can fix that.
 *
 * The tag work is queued with the database write and runs after the answer;
 * a tag failure leaves the order in its pack, marked failed, for the pack's
 * Retry button.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, payload } = await authenticate.webhook(request);

  if (!session) {
    console.error(
      `AppError[PackAssignment] orders/create for ${shop} has no session; the order was not put in a pack.`,
    );
    return new Response();
  }

  const decision = readNewOrderWebhook(payload);
  if (decision.kind === "unreadable") {
    console.error(
      "AppError[PackAssignment] orders/create payload has no readable order ID.",
    );
    return new Response();
  }
  if (decision.kind === "skip") {
    console.log(
      `[PackAssignment] ${decision.orderId} not packed: ${decision.reason}.`,
    );
    return new Response();
  }

  try {
    const result = await PackService.assignNewOrder(
      { shop, shopUrl: ShopifyUtils.getShopAdminUrl(shop) },
      decision.orderId,
    );
    if (result.kind === "assigned") {
      console.log(
        `[PackAssignment] ${decision.orderName ?? decision.orderId} → ${result.pack.day}/${result.pack.daySequence}${
          result.isNewPack ? " (new pack)" : ""
        }.`,
      );
    }
    return new Response();
  } catch (error) {
    console.error(
      `AppError[PackAssignment] could not put ${decision.orderId} in a pack; Shopify will retry.`,
      error,
    );
    return new Response(null, { status: 500 });
  }
};
