import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import {
  formatJobTitle,
  type RecentJobView,
  type RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import type { TranslationKey } from "app/commons/i18n/translations";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

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

const STATUS_LABEL: Record<RecentJobView["status"], TranslationKey> = {
  running: "jobs.status.running",
  succeeded: "jobs.status.succeeded",
  failed: "jobs.status.failed",
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
  const { locale, t } = useI18n();
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
    <s-section heading={t("jobs.heading")}>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-paragraph>
            {t("jobs.linksExpire")}
            {hasRunningJob ? ` ${t("jobs.autoUpdates")}` : ""}
          </s-paragraph>
          <s-button
            onClick={reload}
            {...(fetcher.state !== "idle" ? { loading: true } : {})}
          >
            {t("jobs.refresh")}
          </s-button>
        </s-stack>

        {jobs.length === 0 ? (
          <s-text color="subdued">{t("jobs.empty")}</s-text>
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
                <s-table-header>{t("jobs.colJob")}</s-table-header>
                <s-table-header>{t("jobs.colOrders")}</s-table-header>
                <s-table-header>{t("jobs.colStarted")}</s-table-header>
                <s-table-header>{t("jobs.colStatus")}</s-table-header>
                <s-table-header>{t("jobs.colResult")}</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {jobs.map((job) => (
                  <s-table-row key={job.id}>
                    <s-table-cell>{formatJobTitle(job, t)}</s-table-cell>
                    <s-table-cell>{job.orderCount}</s-table-cell>
                    <s-table-cell>
                      {formatTime(job.startedAt, locale)}
                    </s-table-cell>
                    <s-table-cell>
                      {t(STATUS_LABEL[job.status])}
                      {job.status === "succeeded" && job.hasErrors
                        ? ` ${t("jobs.withErrors")}`
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
                              ? t("jobs.downloadErrorFile")
                              : t("jobs.downloadFile", {
                                  fileName:
                                    job.fileName ?? t("jobs.defaultFileName"),
                                })}
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

function formatTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
