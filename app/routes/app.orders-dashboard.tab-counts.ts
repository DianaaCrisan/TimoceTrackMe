import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getTabCounts } from "app/backend/orders/getTabCounts.server";
import { PackRepository } from "app/backend/packs/PackRepository.server";
import {
  ALL_ORDERS_SCOPE,
  getScopeFilters,
} from "app/commons/orders/OrdersScope";
import type { TabCounts } from "app/commons/orders/TabCounts";

/**
 * Loaded by the dashboard after it renders, so the tabs never hold up the
 * order list. With `?packId=`, counts only that pack's orders.
 */
export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<TabCounts> => {
  const { admin } = await authenticate.admin(request);

  const packId = new URL(request.url).searchParams.get("packId");
  if (!packId) {
    return getTabCounts(admin, { filters: getScopeFilters(ALL_ORDERS_SCOPE) });
  }

  const pack = await PackRepository.get(packId);
  if (!pack) return {};

  return getTabCounts(admin, {
    filters: getScopeFilters({ kind: "pack", packId }),
    packTag: pack.orderTag,
  });
};
