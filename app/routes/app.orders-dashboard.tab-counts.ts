import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getTabCounts } from "app/backend/orders/getTabCounts.server";

/** Loaded by the dashboard after it renders, so the tabs never hold up the order list. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  return getTabCounts(admin);
};
