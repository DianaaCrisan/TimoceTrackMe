import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { authenticate } from "../shopify.server";
import { loadOrdersDashboard } from "app/backend/orders/loadOrdersDashboard.server";
import { ALL_ORDERS_SCOPE } from "app/commons/orders/OrdersScope";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  return loadOrdersDashboard({
    admin,
    shop: session.shop,
    url: new URL(request.url),
    scope: ALL_ORDERS_SCOPE,
  });
};

export default function OrdersDashboardRoute() {
  const data = useLoaderData<typeof loader>();
  const { t } = useI18n();

  return (
    <>
      <TitleBar title={t("nav.orders")} />
      <OrdersDashboardPage
        scope={ALL_ORDERS_SCOPE}
        orders={data.orders}
        pageInfo={data.pageInfo}
        shopAdminUrl={data.shopAdminUrl}
        activeFilter={data.filter}
        ordersCount={data.ordersCount}
        pageNumbers={data.pageNumbers}
        recentJobs={data.recentJobs}
        parcelWeight={data.parcelWeight}
        targetPacks={data.targetPacks}
        jobsOnlyInPacks={data.jobsOnlyInPacks}
      />
    </>
  );
}
