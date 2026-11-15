import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { UnfulfilledReportPage } from "app/frontend/unfulfilled-report/components/UnfulfilledReportPage";

/**
 * The sold products report of one pack (`?packId=`). The unfulfilled
 * report's page, data and PDF, with the sold quantities instead.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // the report loads after the page renders
  return null;
};

export default function SoldReportRoute() {
  return <UnfulfilledReportPage kind="sold" />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
