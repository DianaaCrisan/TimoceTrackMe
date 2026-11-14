import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "app/shopify.server";
import { RequestError } from "app/backend/core/errors/RequestError";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { getOrdersWithCustomerNotes } from "app/backend/orders/getOrdersWithCustomerNotes.server";
import {
  parseOrderSelection,
  resolveOrderIds,
} from "app/backend/orders/resolveOrderSelection.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator, translateEn } from "app/commons/i18n/translate";
import type { OrderNotesResponse } from "app/commons/orders/CustomerNote";

/**
 * Asked by the dashboard before add tracking: which of the selected orders
 * carry a customer note, so the admin reads them before the orders ship.
 * Takes the same selection form as the bulk jobs.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  let t = translateEn;

  try {
    const formData = await request.formData();
    t = createTranslator(resolveLocale(formData.get(LOCALE_PARAM)));

    const shopUrl = ShopifyUtils.getShopAdminUrl(session.shop);
    const orderIds = await resolveOrderIds(
      admin,
      shopUrl,
      parseOrderSelection(formData, t),
      t,
    );

    return respond(200, {
      ok: true,
      orderIds,
      ordersWithNotes: await getOrdersWithCustomerNotes(
        admin,
        shopUrl,
        orderIds,
      ),
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return respond(error.status, { ok: false, error: error.message });
    }

    console.error("AppError[OrderNotes] could not load customer notes.", error);
    return respond(500, {
      ok: false,
      error: t("notes.couldNotLoad", {
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  }
};

function respond(status: number, body: OrderNotesResponse): Response {
  return Response.json(body, { status });
}
