import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrdersDashboardData } from "../backend/orders/orders-dashboard.server";
import { CursorPagination } from "app/frontend/core/components/CursorPagination";
import { OrdersDashboardTable } from "app/frontend/orders-dashboard/components/OrdersDashboardTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);

  return getOrdersDashboardData(admin, {
    after: url.searchParams.get("after"),
    before: url.searchParams.get("before"),
  });
};

export default function OrdersDashboardPage() {
  const { orders, pageInfo } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Orders">
      <s-stack direction="block" gap="large">
        <s-section heading="All orders">
          <s-stack direction="block" gap="base">
            <OrdersDashboardTable orders={orders} />

            <CursorPagination
              basePath="/app/orders-dashboard"
              pageInfo={pageInfo}
            />
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
