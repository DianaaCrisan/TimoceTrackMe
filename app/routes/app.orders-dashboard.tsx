import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getOrdersDashboardData,
  ORDER_PAGE_SIZE,
} from "../backend/orders/orders-dashboard.server";
import { DateUtils } from "app/frontend/core/utils/DateUtils";

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
            <s-paragraph>{`Showing ${ORDER_PAGE_SIZE} orders per page.`}</s-paragraph>

            <s-box borderWidth="base" borderRadius="base" overflow="hidden">
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  background: "var(--p-color-bg-surface, white)",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom: "1px solid #e1e3e5",
                      }}
                    >
                      Order
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        borderBottom: "1px solid #e1e3e5",
                      }}
                    >
                      Created at
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ padding: "12px" }}>
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e1e3e5",
                          }}
                        >
                          {order.name}
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e1e3e5",
                          }}
                        >
                          {DateUtils.formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </s-box>

            <s-stack direction="inline" gap="base">
              <div>
                {pageInfo.hasPreviousPage && pageInfo.startCursor ? (
                  <Link
                    to={`/app/orders-dashboard?before=${encodeURIComponent(pageInfo.startCursor)}`}
                  >
                    <s-button>Previous</s-button>
                  </Link>
                ) : (
                  <s-button disabled>Previous</s-button>
                )}
              </div>

              <div>
                {pageInfo.hasNextPage && pageInfo.endCursor ? (
                  <Link
                    to={`/app/orders-dashboard?after=${encodeURIComponent(pageInfo.endCursor)}`}
                  >
                    <s-button>Next</s-button>
                  </Link>
                ) : (
                  <s-button disabled>Next</s-button>
                )}
              </div>
            </s-stack>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
