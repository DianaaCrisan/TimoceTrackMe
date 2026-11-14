import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { UnfulfilledReportPage } from "app/frontend/unfulfilled-report/components/UnfulfilledReportPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // the report load after the page renders, from ./data
  return null;
};

export default function UnfulfilledReportRoute() {
  return <UnfulfilledReportPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
