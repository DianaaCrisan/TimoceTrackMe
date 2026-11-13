import type { JobKind } from "../aws-s3/buildJobFileKey";

export type JobStatus = "running" | "succeeded" | "failed";

export type JobRecord = {
  id: string;
  job: JobKind;
  title: string;
  orderCount: number;
  startedAt: string;
  finishedAt?: string;
  status: JobStatus;
  /** The result file, or the FAILED_ file for a failed job. */
  s3Key?: string;
  /** The result file exists, but some orders in it failed. */
  hasErrors?: boolean;
  /** One line for the jobs list, e.g. "40 succeeded, 2 failed". */
  summary?: string;
  error?: string;
};

/**
 * The most recent jobs, so the app can say what is running and where each
 * result landed. In memory: it empties on restart. S3 keeps the files, so
 * nothing is lost but the list.
 */
export class JobRegistry {
  private records: JobRecord[] = [];

  constructor(private readonly limit = 30) {}

  add(record: JobRecord): void {
    this.records.unshift({ ...record });
    this.dropOldestFinished();
  }

  update(id: string, patch: Partial<Omit<JobRecord, "id">>): void {
    const record = this.records.find((candidate) => candidate.id === id);
    if (record) Object.assign(record, patch);
  }

  /** Newest first. */
  list(): JobRecord[] {
    return this.records.map((record) => ({ ...record }));
  }

  /** A running job is never dropped, or its result would have nowhere to show. */
  private dropOldestFinished(): void {
    while (this.records.length > this.limit) {
      let oldestFinishedIndex = -1;
      for (let index = this.records.length - 1; index >= 0; index--) {
        if (this.records[index].status !== "running") {
          oldestFinishedIndex = index;
          break;
        }
      }
      if (oldestFinishedIndex === -1) return;
      this.records.splice(oldestFinishedIndex, 1);
    }
  }
}

export const jobRegistry = new JobRegistry();
