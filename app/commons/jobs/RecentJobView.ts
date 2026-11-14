import { isTranslationKey, type Translate } from "../i18n/translate";

export type RecentJobView = {
  id: string;
  job: string;
  title: string;
  orderCount: number;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "succeeded" | "failed";
  s3Key?: string;
  fileName?: string;
  /** Downloads the file without an AWS sign-in; valid for an hour from `generatedAt`. */
  downloadUrl: string | null;
  hasErrors?: boolean;
  summary?: string;
  error?: string;
};

/** The jobs list at one moment; `generatedAt` tells a newer copy from an older one. */
export type RecentJobsSnapshot = {
  jobs: RecentJobView[];
  generatedAt: number;
};

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
