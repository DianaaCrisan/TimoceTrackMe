import type { ActionFunctionArgs } from "react-router";
import {
  ADD_TRACKING_JOB,
  buildAddTrackingArtifact,
} from "app/backend/jobs/definitions/addTrackingJob.server";
import { handleStartOrdersJob } from "app/backend/jobs/handleStartOrdersJob.server";

export const action = async ({ request }: ActionFunctionArgs) =>
  handleStartOrdersJob(request, {
    ...ADD_TRACKING_JOB,
    buildArtifact: buildAddTrackingArtifact,
  });
