import { buildAppFolderKey } from "../aws-s3/buildJobFileKey";
import {
  s3ConsoleFolderUrl,
  s3ConsoleObjectUrl,
} from "../aws-s3/s3ConsoleUrls";
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

export function getRecentJobsSnapshot(): RecentJobsSnapshot {
  const location = readBucketLocation();

  return {
    jobs: jobRegistry.list().map((record) => ({
      ...record,
      s3ConsoleUrl:
        location && record.s3Key
          ? s3ConsoleObjectUrl({ ...location, key: record.s3Key })
          : null,
    })),
    generatedAt: Date.now(),
  };
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
