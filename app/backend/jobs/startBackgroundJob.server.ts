import { randomUUID } from "node:crypto";
import { buildJobFileKey, type JobKind } from "../aws-s3/buildJobFileKey";
import type { AllowedContentType } from "../aws-s3/models/AllowedContentType";
import { assertS3Configured, uploadToS3 } from "../aws-s3/uploadToS3.server";
import { jobRegistry, type JobRegistry } from "./JobRegistry";
import { orderJobLocks, type OrderJobLocks } from "./OrderJobLocks";

/** What a job's build step produces: one file to store on S3. */
export type JobArtifact = {
  buf: Buffer;
  fileName: string;
  contentType: AllowedContentType;
  /** The file exists, but some orders in it failed. */
  hasErrors?: boolean;
  /** One line for the jobs list, e.g. "40 succeeded, 2 failed". */
  summary?: string;
};

export type StartBackgroundJobInput = {
  job: JobKind;
  /** Shown in the jobs list and the failure file, e.g. "Add tracking numbers". */
  title: string;
  orderIds: string[];
  build: () => Promise<JobArtifact>;
  /** Name of the text file stored when the job fails. `FAILED_<job>.txt` if unset. */
  failureFileName?: string;
};

export type StartBackgroundJobResult =
  | { isStarted: true; jobId: string }
  | { isStarted: false; busyOrderIds: string[] };

type Deps = {
  uploadToS3: typeof uploadToS3;
  assertS3Configured: typeof assertS3Configured;
  locks: OrderJobLocks;
  registry: JobRegistry;
  now: () => Date;
  newId: () => string;
  /** Called once the job is fully over and its orders are unlocked. */
  onFinished?: () => void;
};

const defaultDeps: Deps = {
  uploadToS3,
  assertS3Configured,
  locks: orderJobLocks,
  registry: jobRegistry,
  now: () => new Date(),
  newId: randomUUID,
};

/**
 * Starts a bulk job in the background and returns at once, so the route can
 * answer before the work is done:
 * 1. lock the orders (refused if another job holds any of them)
 * 2. `build` the result file
 * 3. upload it to S3, or upload a FAILED_ text file with the error
 *
 * The outcome is recorded in the job registry for the app to show.
 *
 * There is deliberately no timeout. It could not cancel the build, and the
 * orders must stay locked until the build really stops, or a second job could
 * fulfill them again.
 */
export function startBackgroundJob(
  input: StartBackgroundJobInput,
  deps: Deps = defaultDeps,
): StartBackgroundJobResult {
  deps.assertS3Configured();

  const lock = deps.locks.tryLock(input.orderIds);
  if (!lock.isLocked) {
    return { isStarted: false, busyOrderIds: lock.busyOrderIds };
  }

  const id = deps.newId();
  const startedAt = deps.now();

  deps.registry.add({
    id,
    job: input.job,
    title: input.title,
    orderCount: input.orderIds.length,
    startedAt: startedAt.toISOString(),
    status: "running",
  });

  void runJob(input, id, startedAt, deps)
    .catch((error) => {
      console.error(`AppError[Job:${input.job}] job crashed.`, error);
    })
    .finally(() => {
      deps.locks.release(input.orderIds);
      deps.onFinished?.();
    });

  return { isStarted: true, jobId: id };
}

async function runJob(
  input: StartBackgroundJobInput,
  id: string,
  startedAt: Date,
  deps: Deps,
): Promise<void> {
  try {
    const artifact = await input.build();
    const key = buildJobFileKey({
      job: input.job,
      startedAt,
      id,
      fileName: artifact.fileName,
    });

    await deps.uploadToS3({
      buf: artifact.buf,
      key,
      contentType: artifact.contentType,
    });

    deps.registry.update(id, {
      status: "succeeded",
      finishedAt: deps.now().toISOString(),
      s3Key: key,
      fileName: artifact.fileName,
      hasErrors: artifact.hasErrors ?? false,
      summary: artifact.summary,
    });
    console.log(`[Job:${input.job}] result stored at ${key}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`AppError[Job:${input.job}] job failed.`, error);

    const failedAt = deps.now();
    const failureFileName = input.failureFileName ?? `FAILED_${input.job}.txt`;
    const failureKey = buildJobFileKey({
      job: input.job,
      startedAt,
      id,
      fileName: failureFileName,
    });

    let storedFailureKey: string | undefined;
    try {
      await deps.uploadToS3({
        buf: Buffer.from(
          buildFailureReport(input, startedAt, failedAt, message),
          "utf8",
        ),
        key: failureKey,
        contentType: "text/plain; charset=utf-8",
      });
      storedFailureKey = failureKey;
    } catch (uploadError) {
      console.error(
        `AppError[Job:${input.job}] could not store the failure file.`,
        uploadError,
      );
    }

    deps.registry.update(id, {
      status: "failed",
      finishedAt: failedAt.toISOString(),
      s3Key: storedFailureKey,
      fileName: storedFailureKey ? failureFileName : undefined,
      error: message,
    });
  }
}

function buildFailureReport(
  input: StartBackgroundJobInput,
  startedAt: Date,
  failedAt: Date,
  message: string,
): string {
  return [
    `${input.title} FAILED`,
    "",
    `Started: ${startedAt.toISOString()}`,
    `Failed:  ${failedAt.toISOString()}`,
    `Orders:  ${input.orderIds.length}`,
    "",
    `Error: ${message}`,
    "",
    "Orders processed before the error keep their changes.",
    "Check them in Shopify before running the job again.",
    "",
    "Order IDs:",
    ...input.orderIds,
    "",
  ].join("\n");
}
