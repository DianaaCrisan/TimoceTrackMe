import type {
  RecentJobView,
  RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import type { PackTagBatchView } from "app/commons/packs/PackTagBatchView";

/**
 * Work the page waits on, by key (`job:<id>`, `batch:<id>`) → how many
 * snapshots in a row have not listed it.
 */
export type WatchedWork = ReadonlyMap<string, number>;

export type FinishedWork = {
  jobs: RecentJobView[];
  tagBatches: PackTagBatchView[];
  /**
   * Followed work that never showed up as running: it finished before a
   * snapshot caught it, or the list dropped it. It still changed the list.
   */
  unseenCount: number;
};

/**
 * Snapshots that may miss followed work before it counts as finished: the
 * first one can come from a request sent before the work started.
 */
const MISSING_SNAPSHOTS_BEFORE_DONE = 2;

export const jobKey = (id: string) => `job:${id}`;
export const batchKey = (id: string) => `batch:${id}`;

/**
 * Moves the watch on by one snapshot: running work joins it, finished work
 * leaves it and is returned.
 */
export function advanceWatch(
  watched: WatchedWork,
  snapshot: RecentJobsSnapshot,
): { watched: WatchedWork; finished: FinishedWork | null } {
  const next = new Map(watched);
  const finished: FinishedWork = { jobs: [], tagBatches: [], unseenCount: 0 };

  const jobsByKey = new Map(snapshot.jobs.map((job) => [jobKey(job.id), job]));
  const batchesByKey = new Map(
    snapshot.tagBatches.map((batch) => [batchKey(batch.id), batch]),
  );

  for (const [key, job] of jobsByKey) {
    if (job.status === "running") next.set(key, 0);
  }
  for (const [key, batch] of batchesByKey) {
    if (batch.finishedAt === null) next.set(key, 0);
  }

  for (const [key, missingCount] of next) {
    const job = jobsByKey.get(key);
    const batch = batchesByKey.get(key);

    if (job) {
      if (job.status !== "running") {
        finished.jobs.push(job);
        next.delete(key);
      }
    } else if (batch) {
      if (batch.finishedAt !== null) {
        finished.tagBatches.push(batch);
        next.delete(key);
      }
    } else if (missingCount + 1 >= MISSING_SNAPSHOTS_BEFORE_DONE) {
      finished.unseenCount++;
      next.delete(key);
    } else {
      next.set(key, missingCount + 1);
    }
  }

  const hasFinished =
    finished.jobs.length > 0 ||
    finished.tagBatches.length > 0 ||
    finished.unseenCount > 0;
  return { watched: next, finished: hasFinished ? finished : null };
}
