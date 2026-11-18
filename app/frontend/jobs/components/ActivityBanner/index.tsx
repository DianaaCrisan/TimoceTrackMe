import {
  formatJobTitle,
  type RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import { formatPackName } from "app/commons/packs/FulfillmentPack";
import type {
  PackTagBatchKind,
  PackTagBatchView,
} from "app/commons/packs/PackTagBatchView";
import type { Translate } from "app/commons/i18n/translate";
import type { TranslationKey } from "app/commons/i18n/translations";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import "app/frontend/jobs/components/ActivityBanner/styles.scss";

const BATCH_LABEL: Record<PackTagBatchKind, TranslationKey> = {
  addOrders: "activity.addOrders",
  removeOrders: "activity.removeOrders",
  close: "activity.close",
  retry: "activity.retry",
};

type ActivityLine = {
  key: string;
  label: string;
  done: number;
  total: number;
  isVerifying: boolean;
  failedCount: number;
};

/**
 * One line per job or pack tag batch still running, with how far it is. It
 * stays up until the work is done, so the page never looks finished while
 * something is still changing its orders.
 */
export function ActivityBanner({ snapshot }: { snapshot: RecentJobsSnapshot }) {
  const { t } = useI18n();

  const lines: ActivityLine[] = [
    ...snapshot.jobs
      .filter((job) => job.status === "running")
      .map((job) => ({
        key: `job:${job.id}`,
        label: formatJobTitle(job, t),
        done: job.processedCount ?? 0,
        total: job.orderCount,
        isVerifying: job.isVerifying ?? false,
        failedCount: 0,
      })),
    ...snapshot.tagBatches
      .filter((batch) => batch.finishedAt === null)
      .map((batch) => ({
        key: `batch:${batch.id}`,
        label: formatBatchLabel(batch, t),
        done: batch.doneCount + batch.failedCount,
        total: batch.orderCount,
        isVerifying: batch.taggedAt !== null,
        failedCount: batch.failedCount,
      })),
  ];
  if (lines.length === 0) return null;

  return (
    <div className="activity-banner" role="status" aria-live="polite">
      {lines.map((line) => (
        <div key={line.key} className="activity-banner__line">
          <span className="activity-banner__spinner" aria-hidden="true" />
          <span className="activity-banner__label">{line.label}</span>
          <span className="activity-banner__progress">
            {line.isVerifying
              ? t("activity.verifying")
              : t("activity.progress", { done: line.done, total: line.total })}
            {line.failedCount > 0
              ? ` · ${t("activity.failed", { count: line.failedCount })}`
              : ""}
          </span>
          <span className="activity-banner__bar" aria-hidden="true">
            <span
              className={`activity-banner__bar-fill${
                line.isVerifying ? " --verifying" : ""
              }`}
              style={{
                width: `${
                  line.total > 0
                    ? Math.round((100 * line.done) / line.total)
                    : 100
                }%`,
              }}
            />
          </span>
        </div>
      ))}
      <div className="activity-banner__hint">
        {t("activity.listUpdatesItself")}
      </div>
    </div>
  );
}

function formatBatchLabel(batch: PackTagBatchView, t: Translate): string {
  return t(BATCH_LABEL[batch.kind], {
    count: batch.orderCount,
    pack: batch.pack ? formatPackName(batch.pack, t) : t("activity.somePack"),
  });
}
