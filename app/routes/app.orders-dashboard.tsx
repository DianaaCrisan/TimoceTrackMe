import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrdersDashboardData } from "../backend/orders/orders-dashboard.server";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);

  return getOrdersDashboardData(admin, {
    after: url.searchParams.get("after"),
    before: url.searchParams.get("before"),
  });
};

export default function OrdersDashboardRoute() {
  const { orders, pageInfo } = useLoaderData<typeof loader>();

  return (
    <>
      <TitleBar title="Orders" />
      <OrdersDashboardPage orders={orders} pageInfo={pageInfo} />
    </>
  );
}
