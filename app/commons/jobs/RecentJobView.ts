import type { PackTagBatchView } from "../packs/PackTagBatchView";
import { isTranslationKey, type Translate } from "../i18n/translate";

export type RecentJobView = {
  id: string;
  job: string;
  title: string;
  orderCount: number;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "succeeded" | "failed";
  /** Orders the job is done with so far, while it runs. */
  processedCount?: number;
  /** The work is done; the job waits for Shopify search to show it. */
  isVerifying?: boolean;
  s3Key?: string;
  fileName?: string;
  /** Downloads the file without an AWS sign-in; valid for an hour from `generatedAt`. */
  downloadUrl: string | null;
  hasErrors?: boolean;
  summary?: string;
  /** Orders now on the "ZIP to fix" tab because of this job. */
  zipToFixCount?: number;
  error?: string;
};

/**
 * Everything running in the background at one moment: jobs, and pack tag
 * work. `generatedAt` tells a newer copy from an older one.
 */
export type RecentJobsSnapshot = {
  jobs: RecentJobView[];
  /** Running, or finished in the last few minutes. */
  tagBatches: PackTagBatchView[];
  generatedAt: number;
};

/** Whether anything in the snapshot is still running. */
export function hasRunningWork(snapshot: RecentJobsSnapshot): boolean {
  return (
    snapshot.jobs.some((job) => job.status === "running") ||
    snapshot.tagBatches.some((batch) => batch.finishedAt === null)
  );
}

/**
 * The job's name in the user's language. The server stores it in English (it
 * also goes into the result files), so it is looked up by the job's kind.
 */
export function formatJobTitle(
  job: Pick<RecentJobView, "job" | "title">,
  t: Translate,
): string {
  const key = `job.${job.job}`;
  return isTranslationKey(key) ? t(key) : job.title;
}
