import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addTrackingNumbers } from "app/backend/add-tracking/addTrackingNumbers.server";
import { MAX_SELECTED_ORDERS } from "app/commons/constants";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const selectedOrderIds = formData
    .getAll("selectedOrderIds")
    .map(String)
    .filter(Boolean);

  if (selectedOrderIds.length === 0) {
    return Response.json({
      ok: false,
      successfulOrders: [],
      failedOrders: [
        {
          id: "",
          name: "-",
          errors: ["No orders were selected."],
        },
      ],
    });
  }

  if (selectedOrderIds.length > MAX_SELECTED_ORDERS) {
    return Response.json({
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
    });
  }

  const shop = ShopifyUtils.getShopAdminUrl(session.shop);

  const result = await addTrackingNumbers(admin, shop, {
    orderIds: selectedOrderIds,
  });

  return Response.json(result);
};
