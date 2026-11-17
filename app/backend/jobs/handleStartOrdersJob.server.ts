import { authenticate } from "app/shopify.server";
import type { StartJobResponse } from "app/commons/jobs/StartJobResponse";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator, translateEn } from "app/commons/i18n/translate";
import type { JobKind } from "../aws-s3/buildJobFileKey";
import { RequestError } from "../core/errors/RequestError";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";
import {
  parseOrderSelection,
  resolveOrderIds,
} from "../orders/resolveOrderSelection.server";
import { parseManualZips } from "../add-tracking/parseManualZips";
import { buildFailureFileName } from "./buildFailureFileName";
import { createJobAdmin } from "./createJobAdmin.server";
import type { OrdersJobContext } from "./definitions/OrdersJobContext";
import {
  startBackgroundJob,
  type JobArtifact,
} from "./startBackgroundJob.server";

type OrdersJobDefinition = {
  job: JobKind;
  title: string;
  /** Reads ZIPs the admin typed from the form (see `ManualZips`). */
  acceptsManualZips?: boolean;
  buildArtifact: (ctx: OrdersJobContext) => Promise<JobArtifact>;
};

/**
 * The action behind every bulk button on the dashboard:
 * 1. turn the selection into order IDs (resolving "all in this filter" here,
 *    so the orders can be locked before the job starts). With "jobs only in
 *    packs" on, the selection must come from inside a pack.
 * 2. start the job in the background
 * 3. answer 202 straight away; the result shows up under Recent jobs
 */
export async function handleStartOrdersJob(
  request: Request,
  definition: OrdersJobDefinition,
): Promise<Response> {
  const { admin, session } = await authenticate.admin(request);
  // English until the form says otherwise, so even a broken form gets an answer
  let t = translateEn;

  try {
    const formData = await request.formData();
    const locale = resolveLocale(formData.get(LOCALE_PARAM));
    t = createTranslator(locale);

    const shopUrl = ShopifyUtils.getShopAdminUrl(session.shop);
    const selection = parseOrderSelection(formData, t);
    // jobs run on a pack's orders only; checked here, not only by hiding the
    // buttons, so an old page or a crafted request cannot get round it
    if (!selection.packId) {
      throw new RequestError(409, t("startJob.onlyInPacks"));
    }
    const orderIds = await resolveOrderIds(admin, shopUrl, selection, t);
    const timeZone = formData.get("timeZone");
    const manualZips = definition.acceptsManualZips
      ? parseManualZips(formData, orderIds, t)
      : undefined;

    const jobAdmin = createJobAdmin(session.shop);
    const startedAt = new Date();

    const result = startBackgroundJob({
      job: definition.job,
      title: definition.title,
      orderIds,
      failureFileName: buildFailureFileName(definition.job, t),
      build: () =>
        definition.buildArtifact({
          admin: jobAdmin,
          shopUrl,
          orderIds,
          startedAt,
          timeZone: typeof timeZone === "string" ? timeZone : null,
          locale,
          manualZips,
        }),
    });

    if (!result.isStarted) {
      return respond(409, {
        ok: false,
        error: t("startJob.ordersBusy", {
          count: result.busyOrderIds.length,
        }),
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
      error: t("startJob.couldNotStart", {
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  }
}

function respond(status: number, body: StartJobResponse): Response {
  return Response.json(body, { status });
}
