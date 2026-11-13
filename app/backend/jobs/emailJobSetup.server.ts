import { isEnvSet } from "../core/utils/readRequiredEnv";
import {
  startEmailJob,
  type StartEmailJobResult,
} from "./startEmailJob.server";

const EMAIL_JOB_ENV_VARS = [
  "AWS_REGION",
  "AWS_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "ZEPTOMAIL_API_KEY",
  "ZEPTOMAIL_SENDER",
  "JOB_RESULT_EMAIL",
] as const;

export type EmailJobSetupStatus = {
  envVars: { name: string; isSet: boolean }[];
  /** Not secret, so shown in full to make a wrong value easy to spot. */
  region: string | null;
  bucket: string | null;
  recipient: string | null;
};

export function getEmailJobSetupStatus(): EmailJobSetupStatus {
  return {
    envVars: EMAIL_JOB_ENV_VARS.map((name) => ({
      name,
      isSet: isEnvSet(name),
    })),
    region: process.env.AWS_REGION || null,
    bucket: process.env.AWS_BUCKET || null,
    recipient: process.env.JOB_RESULT_EMAIL || null,
  };
}

/** Runs the whole job path (upload, presigned link, email) on a tiny text file. */
export function startTestEmailJob(): StartEmailJobResult {
  const createdAt = new Date().toISOString();

  return startEmailJob({
    job: "test",
    title: "Test job email",
    orderIds: [],
    build: async () => ({
      buf: Buffer.from(`TrackMe test file\nCreated at ${createdAt}\n`, "utf8"),
      fileName: "trackme-test.txt",
      contentType: "text/plain; charset=utf-8",
      subject: "[TrackMe] Test job email",
      summaryHtml:
        "<p>This is a test of the S3 upload and email setup. If the link below downloads a small text file, everything works.</p>",
    }),
  });
}
