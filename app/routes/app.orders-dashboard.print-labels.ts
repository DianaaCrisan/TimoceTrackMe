import type { ActionFunctionArgs } from "react-router";
import {
  PRINT_LABELS_JOB,
  buildPrintLabelsArtifact,
} from "app/backend/jobs/definitions/printLabelsJob.server";
import { handleStartOrdersJob } from "app/backend/jobs/handleStartOrdersJob.server";

export const action = async ({ request }: ActionFunctionArgs) =>
  handleStartOrdersJob(request, {
    ...PRINT_LABELS_JOB,
    buildArtifact: buildPrintLabelsArtifact,
  });
