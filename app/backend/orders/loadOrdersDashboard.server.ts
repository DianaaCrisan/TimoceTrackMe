import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { parseOrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import {
  getScopeFilters,
  type OrdersScope,
} from "app/commons/orders/OrdersScope";
import {
  buildPageNumbers,
  PAGE_PARAM,
} from "app/commons/pagination/PageNumbers";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getRecentJobsSnapshot } from "../jobs/jobsSetup.server";
import { PackRepository, toPackView } from "../packs/PackRepository.server";
import { SettingsRepository } from "../settings/SettingsRepository.server";
import { getOrdersCount } from "./getOrdersCount.server";
import { withShippedParcelCounts } from "./getShippedParcelCounts.server";
import {
  getOrdersDashboardData,
  ORDER_PAGE_SIZE,
} from "./orders-dashboard.server";

type LoadOrdersDashboardInput = {
  admin: AdminApiContextWithoutRest;
  shop: string;
  url: URL;
  scope: OrdersScope;
  /** The pack's tag, when the scope is a pack. */
  packTag?: string | null;
};

/** Everything the dashboard page needs, for all orders or for one pack. */
export async function loadOrdersDashboard({
  admin,
  shop,
  url,
  scope,
  packTag = null,
}: LoadOrdersDashboardInput) {
  const filter = parseOrdersDashboardFilter(
    url.searchParams.get("filter"),
    getScopeFilters(scope),
  );

  const [data, ordersCount, recentJobs, settings, { workingPacks }] =
    await Promise.all([
      getOrdersDashboardData(admin, {
        after: url.searchParams.get("after"),
        before: url.searchParams.get("before"),
        filter,
        packTag,
      }),
      getOrdersCount(admin, filter, packTag),
      getRecentJobsSnapshot(),
      SettingsRepository.get(),
      PackRepository.list(),
    ]);
  const shopAdminUrl = ShopifyUtils.getShopAdminUrl(shop);
  const parcelWeight = {
    parcelWeightLimitKg: settings.parcelWeightLimitKg,
    autoSplitHeavyOrders: settings.autoSplitHeavyOrders,
  };

  return {
    ...data,
    orders: await withShippedParcelCounts(
      admin,
      shopAdminUrl,
      data.orders,
      parcelWeight,
    ),
    filter,
    ordersCount,
    pageNumbers: buildPageNumbers({
      pageParam: url.searchParams.get(PAGE_PARAM),
      pageSize: ORDER_PAGE_SIZE,
      count: ordersCount,
    }),
    recentJobs,
    shopAdminUrl,
    parcelWeight,
    /** Packs that can take orders: for "Add to pack" and "Move to pack". */
    targetPacks: workingPacks.map(toPackView),
    jobsOnlyInPacks: settings.jobsOnlyInPacks,
  };
}
