import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getOrdersDashboardData,
  OrdersDashboardFilter,
} from "../backend/orders/orders-dashboard.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const rawFilter = url.searchParams.get("filter");

  const filter: OrdersDashboardFilter =
    rawFilter === "pending_fulfillment" ? "pending_fulfillment" : "all";

  const data = await getOrdersDashboardData(admin, {
    after: url.searchParams.get("after"),
    before: url.searchParams.get("before"),
    filter,
  });

  return {
    ...data,
    filter,
    shopAdminUrl: ShopifyUtils.getShopAdminUrl(session.shop),
  };
};

export default function OrdersDashboardRoute() {
  const { orders, pageInfo, shopAdminUrl, filter } =
    useLoaderData<typeof loader>();

  return (
    <>
      <TitleBar title="Orders" />
      <OrdersDashboardPage
        orders={orders}
        pageInfo={pageInfo}
        shopAdminUrl={shopAdminUrl}
        activeFilter={filter}
      />
    </>
  );
}
