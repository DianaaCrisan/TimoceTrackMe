import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import type {
  RecentJobView,
  RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";

const RECENT_JOBS_URL = "/app/jobs/recent";
const POLL_INTERVAL_MS = 4000;

type RecentJobsSectionProps = {
  /** From the page loader. A newer polled copy takes over once it arrives. */
  initialSnapshot: RecentJobsSnapshot;
  /** Change it (to anything truthy) to reload the list, e.g. after starting a job. */
  refreshSignal?: unknown;
  /** Called with the jobs that were running and have now finished, so the page can reload its data. */
  onJobFinished?: (finishedJobs: RecentJobView[]) => void;
  /** Caps the list's height (e.g. "22vh"); it scrolls past that. */
  listMaxHeight?: string;
};

const STATUS_LABEL: Record<RecentJobView["status"], string> = {
  running: "⏳ Running",
  succeeded: "✅ Done",
  failed: "❌ Failed",
};

/**
 * Jobs run in the background and report nowhere else, so this list is how the
 * user learns that one finished and where its file is. It polls while a job is
 * running. The list lives in server memory and empties on restart; the files
 * stay in S3.
 */
export function RecentJobsSection({
  initialSnapshot,
  refreshSignal,
  onJobFinished,
  listMaxHeight,
}: RecentJobsSectionProps) {
  const fetcher = useFetcher<RecentJobsSnapshot>();
  const snapshot =
    fetcher.data && fetcher.data.generatedAt > initialSnapshot.generatedAt
      ? fetcher.data
      : initialSnapshot;
  const jobs = snapshot.jobs;
  const hasRunningJob = jobs.some((job) => job.status === "running");

  // `fetcher.load` is not guaranteed to keep its identity between renders.
  const loadRef = useRef(fetcher.load);
  loadRef.current = fetcher.load;
  const reload = () => loadRef.current(RECENT_JOBS_URL);

  useEffect(() => {
    if (!hasRunningJob) return;
    const timer = setInterval(
      () => loadRef.current(RECENT_JOBS_URL),
      POLL_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [hasRunningJob]);

  useEffect(() => {
    if (refreshSignal) loadRef.current(RECENT_JOBS_URL);
  }, [refreshSignal]);

  const onJobFinishedRef = useRef(onJobFinished);
  onJobFinishedRef.current = onJobFinished;
  const runningIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const runningIds = new Set(
      jobs.filter((job) => job.status === "running").map((job) => job.id),
    );
    const finishedJobs = jobs.filter(
      (job) => runningIdsRef.current.has(job.id) && job.status !== "running",
    );
    runningIdsRef.current = runningIds;

    if (finishedJobs.length > 0) onJobFinishedRef.current?.(finishedJobs);
  }, [jobs]);

  return (
    <s-section heading="Recent jobs">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-paragraph>
            Download links work for 1 hour. Press Refresh for new ones.
            {hasRunningJob
              ? " This list updates on its own while a job runs."
              : ""}
          </s-paragraph>
          <s-button
            onClick={reload}
            {...(fetcher.state !== "idle" ? { loading: true } : {})}
          >
            Refresh
          </s-button>
        </s-stack>

        {jobs.length === 0 ? (
          <s-text color="subdued">No jobs since the app last started.</s-text>
        ) : (
          <div
            style={
              listMaxHeight
                ? { maxHeight: listMaxHeight, overflowY: "auto" }
                : undefined
            }
          >
            <s-table>
              <s-table-header-row>
                <s-table-header>Job</s-table-header>
                <s-table-header>Orders</s-table-header>
                <s-table-header>Started</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Result</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {jobs.map((job) => (
                  <s-table-row key={job.id}>
                    <s-table-cell>{job.title}</s-table-cell>
                    <s-table-cell>{job.orderCount}</s-table-cell>
                    <s-table-cell>{formatTime(job.startedAt)}</s-table-cell>
                    <s-table-cell>
                      {STATUS_LABEL[job.status]}
                      {job.status === "succeeded" && job.hasErrors
                        ? " (with errors)"
                        : ""}
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="block" gap="small-300">
                        {job.summary ? <s-text>{job.summary}</s-text> : null}
                        {job.error ? (
                          <s-text tone="critical">{job.error}</s-text>
                        ) : null}
                        {job.downloadUrl ? (
                          <s-link href={job.downloadUrl} target="_blank">
                            {job.status === "failed"
                              ? "Download error file"
                              : `Download ${job.fileName ?? "file"}`}
                          </s-link>
                        ) : null}
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          </div>
        )}
      </s-stack>
    </s-section>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
