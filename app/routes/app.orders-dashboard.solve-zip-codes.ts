import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { SolveZipService } from "app/backend/zip-solver/SolveZipService";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { getOrdersDashboardData } from "app/backend/orders/orders-dashboard.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);

  return getOrdersDashboardData(admin, {
    after: url.searchParams.get("after"),
    before: url.searchParams.get("before"),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const selectedOrderIds = formData
    .getAll("selectedOrderIds")
    .map(String)
    .filter(Boolean);

  const result = await SolveZipService.solveMissingZipCodesWithOrderIds(
    admin,
    ShopifyUtils.getShopAdminUrl(session.shop),
    selectedOrderIds,
  );

  return Response.json({
    ok: true,
    successfulOrders: result.processedOrdersSolvedZip.map((order) => ({
      id: order.id,
      name: order.name,
    })),
    failedOrders: [
      ...result.processedOrdersUnsolvedZip.map((order) => ({
        id: order.id,
        name: order.name,
        errors: [
          order.error ??
            `ZIP could not be solved (confidence: ${order.confidenceLevel ?? "unknown"}).`,
        ],
      })),
      ...result.unsupportedOrders.map((order) => ({
        id: order.id,
        name: order.name ?? "-",
        errors: order.errorStack,
      })),
    ],
  });
};
