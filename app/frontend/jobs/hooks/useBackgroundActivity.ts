import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFetcher } from "react-router";
import {
  hasRunningWork,
  type RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import {
  advanceWatch,
  batchKey,
  jobKey,
  type FinishedWork,
  type WatchedWork,
} from "./watchBackgroundWork";

export type { FinishedWork };

const RECENT_JOBS_URL = "/app/jobs/recent";

/**
 * How often to look while something runs. The endpoint reads only the
 * database and the server's memory, never Shopify, so polling it does not
 * slow the work it watches.
 */
const POLL_INTERVAL_MS = 2000;

const EMPTY_SNAPSHOT: RecentJobsSnapshot = {
  jobs: [],
  tagBatches: [],
  generatedAt: 0,
};

export type BackgroundActivity = {
  /** The latest known jobs and pack tag work. */
  snapshot: RecentJobsSnapshot;
  /** Something is running, or the page waits on work it started. */
  isWatching: boolean;
  isRefreshing: boolean;
  /** Loads the snapshot now. */
  refresh: () => void;
  /**
   * Waits on this job or tag batch until it finishes, even if it finishes
   * before the next snapshot would have seen it running.
   */
  follow: (work: { jobId?: string | null; batchId?: string | null }) => void;
};

/**
 * What is running in the background, kept current while anything runs, with
 * a callback as work finishes so the page can reload its data then, and only
 * then.
 */
export function useBackgroundActivity({
  initialSnapshot,
  onFinished,
}: {
  /** From the page loader; null to start empty and load on the first refresh. */
  initialSnapshot: RecentJobsSnapshot | null;
  onFinished?: (finished: FinishedWork) => void;
}): BackgroundActivity {
  const fetcher = useFetcher<RecentJobsSnapshot>();
  const loaded = fetcher.data;
  const initial = initialSnapshot ?? EMPTY_SNAPSHOT;
  const snapshot =
    loaded && loaded.generatedAt > initial.generatedAt ? loaded : initial;

  // `fetcher.load` is not guaranteed to keep its identity between renders.
  const loadRef = useRef(fetcher.load);
  loadRef.current = fetcher.load;
  const refresh = useCallback(() => {
    void loadRef.current(RECENT_JOBS_URL);
  }, []);

  const watchedRef = useRef<WatchedWork>(new Map());
  // the ref drives the logic; this mirrors its size so polling re-renders
  const [watchedCount, setWatchedCount] = useState(0);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    const { watched, finished } = advanceWatch(watchedRef.current, snapshot);
    watchedRef.current = watched;
    setWatchedCount(watched.size);
    if (finished) onFinishedRef.current?.(finished);
    // a new snapshot is a new `generatedAt`; the object may be re-created
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.generatedAt]);

  const follow = useCallback<BackgroundActivity["follow"]>(
    ({ jobId, batchId }) => {
      const watched = new Map(watchedRef.current);
      if (jobId) watched.set(jobKey(jobId), 0);
      if (batchId) watched.set(batchKey(batchId), 0);
      watchedRef.current = watched;
      setWatchedCount(watched.size);
      refresh();
    },
    [refresh],
  );

  const isWatching = watchedCount > 0 || hasRunningWork(snapshot);
  useEffect(() => {
    if (!isWatching) return;
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isWatching, refresh]);

  const isRefreshing = fetcher.state !== "idle";
  return useMemo(
    () => ({ snapshot, isWatching, isRefreshing, refresh, follow }),
    [snapshot, isWatching, isRefreshing, refresh, follow],
  );
}

/**
 * The page's background activity, for components inside it that start work
 * (pack actions in the pack summary) or list it (Recent jobs).
 */
export const BackgroundActivityContext =
  createContext<BackgroundActivity | null>(null);

export function useBackgroundActivityContext(): BackgroundActivity | null {
  return useContext(BackgroundActivityContext);
}
