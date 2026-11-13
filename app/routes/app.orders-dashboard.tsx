import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrdersDashboardData } from "../backend/orders/orders-dashboard.server";
import { getOrdersCount } from "../backend/orders/getOrdersCount.server";
import { getRecentJobsSnapshot } from "../backend/jobs/jobsSetup.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { parseOrdersDashboardFilter } from "app/commons/orders/OrdersDashboardFilter";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const filter = parseOrdersDashboardFilter(url.searchParams.get("filter"));

  const [data, ordersCount, recentJobs] = await Promise.all([
    getOrdersDashboardData(admin, {
      after: url.searchParams.get("after"),
      before: url.searchParams.get("before"),
      filter,
    }),
    getOrdersCount(admin, filter),
    getRecentJobsSnapshot(),
  ]);

  return {
    ...data,
    filter,
    ordersCount,
    recentJobs,
    shopAdminUrl: ShopifyUtils.getShopAdminUrl(session.shop),
  };
};

export default function OrdersDashboardRoute() {
  const { orders, pageInfo, shopAdminUrl, filter, ordersCount, recentJobs } =
    useLoaderData<typeof loader>();

  return (
    <>
      <TitleBar title="Orders" />
      <OrdersDashboardPage
        orders={orders}
        pageInfo={pageInfo}
        shopAdminUrl={shopAdminUrl}
        activeFilter={filter}
        ordersCount={ordersCount}
        recentJobs={recentJobs}
      />
    </>
  );
}
