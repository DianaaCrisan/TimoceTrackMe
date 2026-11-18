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
import { orderJobLocks } from "../jobs/OrderJobLocks";
import { PackTagSyncRepository } from "../packs/PackTagSyncRepository.server";
import { buildRowActivities } from "./buildRowActivities";
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
  const visibleOrderIds = data.orders.map((order) => order.id);
  const rowActivity = buildRowActivities({
    jobOwners: orderJobLocks.findOwners(visibleOrderIds),
    pendingTags: await PackTagSyncRepository.findPendingOrders(
      visibleOrderIds,
    ).catch((error) => {
      // the list still shows; only the greyed-out rows are missing
      console.error(
        "AppError[OrdersDashboard] could not read the pending pack tags.",
        error,
      );
      return new Map();
    }),
    staleOrderIds: data.staleOrderIds,
  });
  const shopAdminUrl = ShopifyUtils.getShopAdminUrl(shop);
  const parcelWeight = {
    parcelWeightLimitKg: settings.parcelWeightLimitKg,
    autoSplitHeavyOrders: settings.autoSplitHeavyOrders,
  };

  return {
    orders: await withShippedParcelCounts(
      admin,
      shopAdminUrl,
      data.orders,
      parcelWeight,
    ),
    pageInfo: data.pageInfo,
    rowActivity,
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
  };
}
