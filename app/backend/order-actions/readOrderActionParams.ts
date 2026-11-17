import { resolveLocale, type Locale } from "app/commons/i18n/Locale";
import { ORDER_ACTIONS_PARAMS } from "app/commons/order-actions/OrderActions";

const ORDER_GID_PATTERN = /^gid:\/\/shopify\/Order\/\d+$/;

/**
 * The order and language an extension asks about, from the query string or
 * the form. The order ID must be an order GID; anything else is null.
 */
export function readOrderActionParams(
  get: (name: string) => FormDataEntryValue | null,
): { orderId: string | null; locale: Locale } {
  const orderId = get(ORDER_ACTIONS_PARAMS.orderId);
  return {
    orderId:
      typeof orderId === "string" && ORDER_GID_PATTERN.test(orderId)
        ? orderId
        : null,
    locale: resolveLocale(get(ORDER_ACTIONS_PARAMS.locale)),
  };
}
