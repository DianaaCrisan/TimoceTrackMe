import { authenticate } from "app/shopify.server";
import type { StartJobResponse } from "app/commons/jobs/StartJobResponse";
import type { JobKind } from "../aws-s3/buildJobFileKey";
import { RequestError } from "../core/errors/RequestError";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";
import {
  parseOrderSelection,
  resolveOrderIds,
} from "../orders/resolveOrderSelection.server";
import { createJobAdmin } from "./createJobAdmin.server";
import type { OrdersJobContext } from "./definitions/OrdersJobContext";
import {
  startBackgroundJob,
  type JobArtifact,
} from "./startBackgroundJob.server";

type OrdersJobDefinition = {
  job: JobKind;
  title: string;
  buildArtifact: (ctx: OrdersJobContext) => Promise<JobArtifact>;
};

/**
 * The action behind every bulk button on the dashboard:
 * 1. turn the selection into order IDs (resolving "all in this filter" here,
 *    so the orders can be locked before the job starts)
 * 2. start the job in the background
 * 3. answer 202 straight away; the result shows up under Recent jobs
 */
export async function handleStartOrdersJob(
  request: Request,
  definition: OrdersJobDefinition,
): Promise<Response> {
  const { admin, session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const shopUrl = ShopifyUtils.getShopAdminUrl(session.shop);
    const orderIds = await resolveOrderIds(
      admin,
      shopUrl,
      parseOrderSelection(formData),
    );
    const timeZone = formData.get("timeZone");

    const jobAdmin = createJobAdmin(session.shop);
    const startedAt = new Date();

    const result = startBackgroundJob({
      job: definition.job,
      title: definition.title,
      orderIds,
      build: () =>
        definition.buildArtifact({
          admin: jobAdmin,
          shopUrl,
          orderIds,
          startedAt,
          timeZone: typeof timeZone === "string" ? timeZone : null,
        }),
    });

    if (!result.isStarted) {
      return respond(409, {
        ok: false,
        error: `${result.busyOrderIds.length} of these orders are already in a running job. Wait for it to finish, then try again.`,
      });
    }

    return respond(202, {
      ok: true,
      jobId: result.jobId,
      orderCount: orderIds.length,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return respond(error.status, { ok: false, error: error.message });
    }

    console.error(
      `AppError[StartJob:${definition.job}] could not start the job.`,
      error,
    );
    return respond(500, {
      ok: false,
      error: `Could not start the job: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function respond(status: number, body: StartJobResponse): Response {
  return Response.json(body, { status });
}
