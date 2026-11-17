import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { ShippingLabelSync } from "app/backend/shipping-labels/ShippingLabelSync.server";
import { readFulfillmentWebhookOrderId } from "app/backend/shipping-labels/readFulfillmentWebhook";

/**
 * `fulfillments/create` and `fulfillments/update`: a fulfillment was created,
 * cancelled, or its tracking edited. Reads the order's fulfillments again and
 * reconciles its AWBs for the AWB report. See docs/awb-report-plan.md.
 *
 * - 200: done, or something a retry cannot fix (no session, unreadable
 *   payload). Logged.
 * - 500: reading Shopify or writing the database failed. Shopify retries for
 *   about 48 hours; the report's "Refresh from Shopify" also catches it.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    console.error(
      `AppError[AwbReport] ${topic} for ${shop} has no session; the AWB report was not updated.`,
    );
    return new Response();
  }

  const orderId = readFulfillmentWebhookOrderId(payload);
  if (!orderId) {
    console.error(`AppError[AwbReport] ${topic} payload has no order ID.`);
    return new Response();
  }

  try {
    const changed = await ShippingLabelSync.syncOrder(
      admin,
      ShopifyUtils.getShopAdminUrl(shop),
      orderId,
    );
    if (changed > 0) {
      console.log(
        `[AwbReport] ${topic} ${orderId}: ${changed} AWB(s) updated.`,
      );
    }
    return new Response();
  } catch (error) {
    console.error(
      `AppError[AwbReport] ${topic} could not update the AWBs of ${orderId}; Shopify will retry.`,
      error,
    );
    return new Response(null, { status: 500 });
  }
};
