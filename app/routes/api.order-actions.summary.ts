import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { OrderActions } from "app/backend/order-actions/OrderActions.server";
import { readOrderActionParams } from "app/backend/order-actions/readOrderActionParams";
import { createTranslator } from "app/commons/i18n/translate";
import type { OrderSummaryResponse } from "app/commons/order-actions/OrderActions";

/**
 * For the order page's "TrackMe: add tracking" window: what add tracking
 * would do for the order. Called by the extension with an ID token.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, cors } = await authenticate.admin(request);
  const url = new URL(request.url);
  const { orderId, locale } = readOrderActionParams((name) =>
    url.searchParams.get(name),
  );
  const t = createTranslator(locale);
  const respond = (status: number, body: OrderSummaryResponse) =>
    cors(Response.json(body, { status }));

  if (!orderId) {
    return respond(400, { ok: false, error: t("orderAction.invalidOrder") });
  }

  try {
    const summary = await OrderActions.getSummary(
      admin,
      ShopifyUtils.getShopAdminUrl(session.shop),
      orderId,
    );
    return summary
      ? respond(200, { ok: true, summary })
      : respond(404, { ok: false, error: t("orderAction.notFound") });
  } catch (error) {
    console.error(
      `AppError[OrderActions] summary of ${orderId} failed.`,
      error,
    );
    return respond(500, {
      ok: false,
      error: t("orderAction.failed", { error: message(error) }),
    });
  }
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
