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
