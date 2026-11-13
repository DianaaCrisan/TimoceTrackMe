import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";
import { getOrderNames } from "../orders/getOrderNames.server";
import type { OrderResultRow } from "./OrderResultRow";

const UNKNOWN_NAME = "-";

/**
 * One row per requested order, in request order.
 *
 * A job reports the orders it acted on. Every other order is "skipped" with
 * `skippedDetails`, or "failed" if Shopify no longer knows it. Names come from
 * the rows, then from `knownNamesById` (orders the job already loaded), and
 * only the rest are looked up, in one batched query.
 */
export async function completeOrderResultRows(args: {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  orderIds: string[];
  rowsById: Map<string, OrderResultRow>;
  skippedDetails: string;
  knownNamesById?: Map<string, string>;
}): Promise<OrderResultRow[]> {
  const { orderIds, rowsById } = args;
  const namesById = new Map(args.knownNamesById ?? []);

  const idsWithoutName = orderIds.filter((id) => {
    const name = rowsById.get(id)?.orderName;
    return (!name || name === UNKNOWN_NAME) && !namesById.has(id);
  });
  if (idsWithoutName.length > 0) {
    const fetchedNames = await getOrderNames(
      args.admin,
      args.shopUrl,
      idsWithoutName,
    );
    fetchedNames.forEach((name, id) => namesById.set(id, name));
  }

  return orderIds.map((orderId) => {
    const row = rowsById.get(orderId);
    const knownName = row?.orderName && row.orderName !== UNKNOWN_NAME;
    const orderName = knownName
      ? row.orderName
      : (namesById.get(orderId) ??
        `Order ${ShopifyUtils.extractShopifyId(orderId) ?? orderId}`);

    if (row) return { ...row, orderName };

    if (!namesById.has(orderId)) {
      return {
        orderId,
        orderName,
        status: "failed",
        errors: ["Order not found in Shopify."],
      };
    }

    return {
      orderId,
      orderName,
      status: "skipped",
      details: args.skippedDetails,
    };
  });
}
