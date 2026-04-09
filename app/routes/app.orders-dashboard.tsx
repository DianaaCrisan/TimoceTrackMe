import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrdersDashboardData } from "../backend/orders/orders-dashboard.server";
import { OrdersDashboardPage } from "app/frontend/orders-dashboard/components/OrdersDashboardPage";
import { addTrackingNumbers } from "app/backend/add-tracking/addTrackingNumbers.server";
import { MAX_SELECTED_ORDERS } from "app/commons/constants";
import { AddTrackingNumbersResult } from "app/backend/add-tracking/addTrackingNumbers.types";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";

type OrdersDashboardActionData = {
  ok: boolean;
  data: AddTrackingNumbersResult;
};

const buildAddTrackingErrorResult = (
  errors: string[],
): OrdersDashboardActionData => ({
  ok: false,
  data: {
    ok: false,
    successfulOrders: [],
    failedOrders: [
      {
        id: "",
        name: "-",
        errors,
      },
    ],
  },
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);

  return getOrdersDashboardData(admin, {
    after: url.searchParams.get("after"),
    before: url.searchParams.get("before"),
  });
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<OrdersDashboardActionData> => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const selectedOrderIds = formData
    .getAll("selectedOrderIds")
    .map(String)
    .filter(Boolean);

  if (selectedOrderIds.length === 0) {
    return buildAddTrackingErrorResult(["No orders were selected."]);
  }

  if (selectedOrderIds.length > MAX_SELECTED_ORDERS) {
    return buildAddTrackingErrorResult([
      `You can select at most ${MAX_SELECTED_ORDERS} orders at once.`,
    ]);
  }

  if (intent === "add-tracking") {
    const shop = ShopifyUtils.getShopAdminUrl(session.shop);
    const result = await addTrackingNumbers(admin, shop, {
      orderIds: selectedOrderIds,
    });

    return {
      ok: result.ok,
      data: result,
    };
  }

  return buildAddTrackingErrorResult(["Unknown action intent."]);
};

export default function OrdersDashboardRoute() {
  const { orders, pageInfo } = useLoaderData<typeof loader>();

  const addTrackingFetcher = useFetcher<typeof action>();

  return (
    <>
      <TitleBar title="Orders" />
      <OrdersDashboardPage
        orders={orders}
        pageInfo={pageInfo}
        addTrackingFetcher={addTrackingFetcher}
      />
    </>
  );
}
