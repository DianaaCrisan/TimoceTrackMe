import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { OrderActions } from "app/backend/order-actions/OrderActions.server";
import { readOrderActionParams } from "app/backend/order-actions/readOrderActionParams";
import { createTranslator } from "app/commons/i18n/translate";
import type { OrderAddTrackingResponse } from "app/commons/order-actions/OrderActions";

/**
 * The browser's CORS preflight for the POST below. The extension runs on
 * another origin and sends an Authorization header, so the browser asks
 * with an OPTIONS request first, and React Router routes OPTIONS to the
 * loader, not the action. `authenticate.admin` answers it (204 with the CORS
 * headers). Without this loader the preflight got React Router's 400, with
 * no CORS headers, and the browser blocked the POST. In development Vite's
 * own CORS middleware hid that.
 *
 * Anything else that reaches here (a plain GET) is not a way to add tracking.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { cors } = await authenticate.admin(request);
  return cors(new Response(null, { status: 405, headers: { Allow: "POST" } }));
};

/**
 * The order page's "Add tracking" button: adds tracking to that one order
 * now and answers with its AWBs, or the error. Called by the extension with
 * an ID token.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, cors } = await authenticate.admin(request);
  const formData = await request.formData();
  const { orderId, locale } = readOrderActionParams((name) =>
    formData.get(name),
  );
  const t = createTranslator(locale);
  const respond = (status: number, body: OrderAddTrackingResponse) =>
    cors(Response.json(body, { status }));

  if (!orderId) {
    return respond(400, { ok: false, error: t("orderAction.invalidOrder") });
  }

  try {
    const result = await OrderActions.addTracking(
      admin,
      ShopifyUtils.getShopAdminUrl(session.shop),
      orderId,
      locale,
    );
    return respond(result.ok ? 200 : 422, result);
  } catch (error) {
    console.error(
      `AppError[OrderActions] add tracking for ${orderId} failed.`,
      error,
    );
    return respond(500, {
      ok: false,
      error: t("orderAction.failed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  }
};
