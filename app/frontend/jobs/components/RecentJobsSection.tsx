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
  /** Called when a job that was running has finished, so the page can reload its data. */
  onJobFinished?: () => void;
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
    const hasFinishedJob = [...runningIdsRef.current].some(
      (id) => !runningIds.has(id),
    );
    runningIdsRef.current = runningIds;

    if (hasFinishedJob) onJobFinishedRef.current?.();
  }, [jobs]);

  return (
    <s-section heading="Recent jobs">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-paragraph>
            Results are stored in S3. Open a file with its link, then download
            it from the S3 console.
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
                      {job.s3ConsoleUrl ? (
                        <s-link href={job.s3ConsoleUrl} target="_blank">
                          {job.status === "failed"
                            ? "Open error file in S3"
                            : "Open file in S3"}
                        </s-link>
                      ) : null}
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
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
