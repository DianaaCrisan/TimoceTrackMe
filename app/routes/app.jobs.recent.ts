import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getRecentJobsSnapshot } from "app/backend/jobs/jobsSetup.server";

/** Polled by the Recent jobs list while a job is running. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return await getRecentJobsSnapshot();
};
