import { buildAppFolderKey } from "../aws-s3/buildJobFileKey";
import { s3ConsoleFolderUrl } from "../aws-s3/s3ConsoleUrls";
import { getDownloadUrl } from "../aws-s3/uploadToS3.server";
import { isEnvSet } from "../core/utils/readRequiredEnv";
import type { RecentJobsSnapshot } from "app/commons/jobs/RecentJobView";
import type { S3SetupStatus } from "app/commons/jobs/S3SetupStatus";
import { jobRegistry } from "./JobRegistry";
import {
  startBackgroundJob,
  type StartBackgroundJobResult,
} from "./startBackgroundJob.server";

const S3_ENV_VARS = [
  "AWS_REGION",
  "AWS_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

function readBucketLocation(): { bucket: string; region: string } | null {
  const bucket = process.env.AWS_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  return bucket && region ? { bucket, region } : null;
}

export function getS3SetupStatus(): S3SetupStatus {
  const location = readBucketLocation();
  const appFolderKey = buildAppFolderKey();

  return {
    envVars: S3_ENV_VARS.map((name) => ({ name, isSet: isEnvSet(name) })),
    bucket: location?.bucket ?? null,
    region: location?.region ?? null,
    appFolderKey,
    appFolderConsoleUrl: location
      ? s3ConsoleFolderUrl({ ...location, folderKey: appFolderKey })
      : null,
  };
}

export const DOWNLOAD_LINK_EXPIRES_IN_SECONDS = 60 * 60;

/**
 * The jobs list with a fresh download link per file. Links are signed on
 * every call, so one is never older than the last time the list loaded.
 */
export async function getRecentJobsSnapshot(): Promise<RecentJobsSnapshot> {
  const jobs = await Promise.all(
    jobRegistry.list().map(async (record) => ({
      ...record,
      downloadUrl: await signDownloadUrl(record.s3Key, record.fileName),
    })),
  );

  return { jobs, generatedAt: Date.now() };
}

async function signDownloadUrl(
  key: string | undefined,
  fileName: string | undefined,
): Promise<string | null> {
  if (!key) return null;

  try {
    return await getDownloadUrl({
      key,
      fileName: fileName ?? key.split("/").pop() ?? "download",
      expiresInSeconds: DOWNLOAD_LINK_EXPIRES_IN_SECONDS,
    });
  } catch (error) {
    // e.g. AWS variables missing; the list still shows, without links
    console.error(
      `AppError[RecentJobs] could not sign a link for ${key}.`,
      error,
    );
    return null;
  }
}

/** Runs the whole job path (lock, build, upload, registry) on a tiny text file. */
export function startTestJob(): StartBackgroundJobResult {
  const createdAt = new Date().toISOString();

  return startBackgroundJob({
    job: "test",
    title: "Test upload",
    orderIds: [],
    build: async () => ({
      buf: Buffer.from(`TrackMe test file\nCreated at ${createdAt}\n`, "utf8"),
      fileName: "trackme-test.txt",
      contentType: "text/plain; charset=utf-8",
      summary: "Test file uploaded",
    }),
  });
}
