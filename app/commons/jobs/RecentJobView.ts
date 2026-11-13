export type RecentJobView = {
  id: string;
  job: string;
  title: string;
  orderCount: number;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "succeeded" | "failed";
  s3Key?: string;
  /** Opens the file in the S3 console (needs an AWS sign-in). */
  s3ConsoleUrl: string | null;
  hasErrors?: boolean;
  summary?: string;
  error?: string;
};

/** The jobs list at one moment; `generatedAt` tells a newer copy from an older one. */
export type RecentJobsSnapshot = {
  jobs: RecentJobView[];
  generatedAt: number;
};
