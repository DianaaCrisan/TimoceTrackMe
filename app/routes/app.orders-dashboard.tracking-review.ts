import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "app/shopify.server";
import { RequestError } from "app/backend/core/errors/RequestError";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { getOrdersToReview } from "app/backend/orders/getOrdersToReview.server";
import {
  parseOrderSelection,
  resolveOrderIds,
} from "app/backend/orders/resolveOrderSelection.server";
import { SettingsRepository } from "app/backend/settings/SettingsRepository.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator, translateEn } from "app/commons/i18n/translate";
import type { TrackingReviewResponse } from "app/commons/orders/TrackingReview";

/**
 * Asked by the dashboard before add tracking: which of the selected orders
 * the admin should look at first (customer notes, heavy parcels). Takes the
 * same selection form as the bulk jobs.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  let t = translateEn;

  try {
    const formData = await request.formData();
    t = createTranslator(resolveLocale(formData.get(LOCALE_PARAM)));

    const shopUrl = ShopifyUtils.getShopAdminUrl(session.shop);
    const [orderIds, parcelWeight] = await Promise.all([
      resolveOrderIds(admin, shopUrl, parseOrderSelection(formData, t), t),
      SettingsRepository.getParcelWeight(),
    ]);

    return respond(200, {
      ok: true,
      orderIds,
      ordersToReview: await getOrdersToReview(
        admin,
        shopUrl,
        orderIds,
        parcelWeight,
      ),
      parcelWeightLimitKg: parcelWeight.parcelWeightLimitKg,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return respond(error.status, { ok: false, error: error.message });
    }

    console.error(
      "AppError[TrackingReview] could not load the orders to review.",
      error,
    );
    return respond(500, {
      ok: false,
      error: t("trackingReview.couldNotLoad", {
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  }
};

function respond(status: number, body: TrackingReviewResponse): Response {
  return Response.json(body, { status });
}
