import { randomUUID } from "node:crypto";
import {
  buildTemporaryKey,
  type TemporaryFileJob,
} from "../aws-s3/buildTemporaryKey";
import type { AllowedContentType } from "../aws-s3/models/AllowedContentType";
import { uploadAndGetDownloadLink } from "../aws-s3/uploadAndGetDownloadLink.server";
import { readRequiredEnv } from "../core/utils/readRequiredEnv";
import { escapeHtml } from "../zepto-mail/escapeHtml";
import {
  sendEmailViaZeptoMail,
  type SendEmailInput,
} from "../zepto-mail/sendEmailViaZeptoMail.server";
import { orderJobLocks, type OrderJobLocks } from "./OrderJobLocks";

export const DOWNLOAD_LINK_EXPIRES_IN_SECONDS = 24 * 60 * 60;
const DEFAULT_JOB_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** What a job's build step produces: one file to upload and link to. */
export type EmailJobArtifact = {
  buf: Buffer;
  fileName: string;
  contentType: AllowedContentType;
  subject: string;
  /** Trusted HTML, placed above the download link. Escape anything from Shopify. */
  summaryHtml?: string;
  hasErrors?: boolean;
};

export type StartEmailJobInput = {
  job: TemporaryFileJob;
  /** Shown in the failure email, e.g. "Add tracking numbers". */
  title: string;
  orderIds: string[];
  build: () => Promise<EmailJobArtifact>;
  timeoutMs?: number;
};

export type StartEmailJobResult =
  | { isStarted: true; recipient: string }
  | { isStarted: false; busyOrderIds: string[] };

type Deps = {
  uploadAndGetDownloadLink: typeof uploadAndGetDownloadLink;
  sendEmail: (input: SendEmailInput) => Promise<void>;
  locks: OrderJobLocks;
  now: () => Date;
  newId: () => string;
  /** Called once the job is fully over and its orders are unlocked. */
  onFinished?: () => void;
};

const defaultDeps: Deps = {
  uploadAndGetDownloadLink,
  sendEmail: sendEmailViaZeptoMail,
  locks: orderJobLocks,
  now: () => new Date(),
  newId: randomUUID,
};

/**
 * Starts a bulk job in the background and returns at once, so the route can
 * answer before the work is done:
 * 1. lock the orders (refused if another job holds any of them)
 * 2. `build` the result file
 * 3. upload it to S3 and email a download link, or email the error
 *
 * The recipient is checked before anything starts, so a missing
 * `JOB_RESULT_EMAIL` fails the request instead of a job nobody hears about.
 */
export function startEmailJob(
  input: StartEmailJobInput,
  deps: Deps = defaultDeps,
): StartEmailJobResult {
  const recipient = readRequiredEnv("JOB_RESULT_EMAIL");

  const lock = deps.locks.tryLock(input.orderIds);
  if (!lock.isLocked) {
    return { isStarted: false, busyOrderIds: lock.busyOrderIds };
  }

  void runJob(input, recipient, deps)
    .catch((error) => {
      console.error(`AppError[EmailJob:${input.job}] job crashed.`, error);
    })
    .finally(() => {
      deps.locks.release(input.orderIds);
      deps.onFinished?.();
    });

  return { isStarted: true, recipient };
}

async function runJob(
  input: StartEmailJobInput,
  recipient: string,
  deps: Deps,
): Promise<void> {
  const startedAt = deps.now();

  // Exactly one email per job. The timeout and the work race each other, and
  // whichever settles first claims the email.
  let isEmailClaimed = false;
  const claimEmail = () => {
    if (isEmailClaimed) return false;
    isEmailClaimed = true;
    return true;
  };

  const work = (async () => {
    const artifact = await input.build();

    const url = await deps.uploadAndGetDownloadLink({
      buf: artifact.buf,
      key: buildTemporaryKey({
        job: input.job,
        createdAt: startedAt,
        id: deps.newId(),
        fileName: artifact.fileName,
      }),
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      expiresInSeconds: DOWNLOAD_LINK_EXPIRES_IN_SECONDS,
    });

    if (!claimEmail()) return;

    await deps.sendEmail({
      to: [recipient],
      subject: artifact.subject,
      htmlBody: buildSuccessHtml(artifact, url),
    });
    console.log(`[EmailJob:${input.job}] result emailed to ${recipient}.`);
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Timed out after ${Math.round((input.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS) / 60000)} minutes.`,
          ),
        ),
      input.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([work, timeout]);
  } catch (error) {
    console.error(`AppError[EmailJob:${input.job}] job failed.`, error);

    if (claimEmail()) {
      await deps
        .sendEmail({
          to: [recipient],
          subject: `[Failed] ${input.title}`,
          htmlBody: buildFailureHtml(input, error),
        })
        .catch((mailError) => {
          console.error(
            `AppError[EmailJob:${input.job}] could not send the failure email.`,
            mailError,
          );
        });
    }
  } finally {
    clearTimeout(timer);
  }

  // A timeout cannot cancel the build. Wait for it to stop before the caller
  // unlocks the orders, or a new job could start on orders still being fulfilled.
  await work.catch(() => undefined);
}

function buildSuccessHtml(artifact: EmailJobArtifact, url: string): string {
  const errorWarning = artifact.hasErrors
    ? `<p style="color:#D82C0D;"><strong>Some orders had errors. See the report in the download.</strong></p>`
    : "";

  return (
    errorWarning +
    (artifact.summaryHtml ?? "") +
    `<p>Your file is ready: <a href="${escapeHtml(url)}">${escapeHtml(artifact.fileName)}</a></p>` +
    `<p style="color:#6D7175;">The link expires in ${DOWNLOAD_LINK_EXPIRES_IN_SECONDS / 3600} hours.</p>`
  );
}

function buildFailureHtml(input: StartEmailJobInput, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return (
    `<p><strong>${escapeHtml(input.title)}</strong> failed for ${input.orderIds.length} order(s).</p>` +
    `<p>Error: ${escapeHtml(message)}</p>` +
    `<p>Orders that were processed before the error keep their changes. Check them in Shopify before running the job again.</p>`
  );
}
