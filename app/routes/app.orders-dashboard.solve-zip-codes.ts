import type { ActionFunctionArgs } from "react-router";
import {
  SOLVE_ZIP_JOB,
  buildSolveZipArtifact,
} from "app/backend/jobs/definitions/solveZipJob.server";
import { handleStartOrdersJob } from "app/backend/jobs/handleStartOrdersJob.server";

export const action = async ({ request }: ActionFunctionArgs) =>
  handleStartOrdersJob(request, {
    ...SOLVE_ZIP_JOB,
    buildArtifact: buildSolveZipArtifact,
  });
