import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { OrderActions } from "app/backend/order-actions/OrderActions.server";
import { readOrderActionParams } from "app/backend/order-actions/readOrderActionParams";
import { createTranslator } from "app/commons/i18n/translate";
import type { OrderAddTrackingResponse } from "app/commons/order-actions/OrderActions";

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
