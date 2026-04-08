import type { createPool } from "./createPool";
import type { createProgressLogger } from "./createProgressLogger";

type Pool = ReturnType<typeof createPool>;
type Progress = ReturnType<typeof createProgressLogger>;

/** Wrap a pool task with progress logs, keyed for nicer messages */
export function scheduleWithProgress<T>(
  pool: Pool,
  progress: Progress,
  key: string,
  task: () => Promise<T>
): Promise<T> {
  return pool.schedule(() => progress.track(key, task));
}
