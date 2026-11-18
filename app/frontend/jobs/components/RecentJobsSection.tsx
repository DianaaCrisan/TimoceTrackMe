import {
  formatJobTitle,
  type RecentJobView,
} from "app/commons/jobs/RecentJobView";
import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import type { TranslationKey } from "app/commons/i18n/translations";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import type { BackgroundActivity } from "app/frontend/jobs/hooks/useBackgroundActivity";

type RecentJobsSectionProps = {
  /** The page's background activity: it keeps the list current. */
  activity: BackgroundActivity;
  /** Caps the list's height (e.g. "22vh"); it scrolls past that. */
  listMaxHeight?: string;
};

const STATUS_LABEL: Record<RecentJobView["status"], TranslationKey> = {
  running: "jobs.status.running",
  succeeded: "jobs.status.succeeded",
  failed: "jobs.status.failed",
};

/**
 * Jobs run in the background, so this list is where the user finds each
 * one's result file. It follows the page's background activity, which
 * polls while a job runs. The list lives in server memory and empties on
 * restart; the files stay in S3.
 */
export function RecentJobsSection({
  activity,
  listMaxHeight,
}: RecentJobsSectionProps) {
  const { locale, t } = useI18n();
  const jobs = activity.snapshot.jobs;
  const hasRunningJob = jobs.some((job) => job.status === "running");

  return (
    <s-section heading={t("jobs.heading")}>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-paragraph>
            {t("jobs.linksExpire")}
            {hasRunningJob ? ` ${t("jobs.autoUpdates")}` : ""}
          </s-paragraph>
          <s-button
            onClick={activity.refresh}
            {...(activity.isRefreshing ? { loading: true } : {})}
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
                      {job.status === "running" && job.processedCount
                        ? ` ${t("activity.progress", {
                            done: job.processedCount,
                            total: job.orderCount,
                          })}`
                        : ""}
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
