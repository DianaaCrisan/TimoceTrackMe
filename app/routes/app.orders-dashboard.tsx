import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrdersDashboardData } from "../backend/orders/orders-dashboard.server";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";
import { addTrackingNumbers } from "app/backend/add-tracking/addTrackingNumbers.server";

const MAX_SELECTED_ORDERS = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);

  return getOrdersDashboardData(admin, {
    after: url.searchParams.get("after"),
    before: url.searchParams.get("before"),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const selectedOrderIds = formData
    .getAll("selectedOrderIds")
    .map(String)
    .filter(Boolean);

  if (selectedOrderIds.length === 0) {
    return {
      ok: false,
      data: {
        ok: false,
        successfulOrders: [],
        failedOrders: [
          {
            id: "",
            name: "-",
            errors: ["No orders were selected."],
          },
        ],
      },
    };
  }

  if (selectedOrderIds.length > MAX_SELECTED_ORDERS) {
    return {
      ok: false,
      data: {
        ok: false,
        successfulOrders: [],
        failedOrders: [
          {
            id: "",
            name: "-",
            errors: [
              `You can select at most ${MAX_SELECTED_ORDERS} orders at once.`,
            ],
          },
        ],
      },
    };
  }

  const result = await addTrackingNumbers(admin, {
    orderIds: selectedOrderIds,
  });

  return {
    ok: result.ok,
    data: result,
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
