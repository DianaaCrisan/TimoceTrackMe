import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
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

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const selectedOrderIds = formData.getAll("selectedOrderIds").map(String);

  return {
    ok: true,
    data: {
      processedCount: selectedOrderIds.length,
      successfulOrders: selectedOrderIds.map((id) => ({
        id,
        name: `Mock order ${id}`,
        trackingNumbers: ["MOCK-TRACKING-123"],
      })),
      failedOrders: [],
    },
  };
};

export default function OrdersDashboardRoute() {
  const { orders, pageInfo } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  return (
    <>
      <TitleBar title="Orders" />
      <OrdersDashboardPage
        orders={orders}
        pageInfo={pageInfo}
        fetcher={fetcher}
      />
    </>
  );
}
