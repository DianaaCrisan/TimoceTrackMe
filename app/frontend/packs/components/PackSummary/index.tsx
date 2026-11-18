import { useState } from "react";
import { Link } from "react-router";
import {
  REPORT_PACK_PARAM,
  SOLD_REPORT_PATH,
  UNFULFILLED_REPORT_PATH,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import {
  buildPackUrl,
  countLeftInPack,
  formatPackName,
  formatPackTime,
  type FulfillmentPackStatus,
  type FulfillmentPackView,
  type PackProgress,
} from "app/commons/packs/FulfillmentPack";
import { PACK_ACTION_FIELDS } from "app/commons/packs/PackAction";
import type { TranslationKey } from "app/commons/i18n/translations";
import { Badge, type BadgeTone } from "app/frontend/core/components/Badge";
import { ConfirmDialog } from "app/frontend/core/components/ConfirmDialog";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { usePackAction } from "app/frontend/packs/hooks/usePackAction";
import "app/frontend/packs/components/PackSummary/styles.scss";

const STATUS_DISPLAY: Record<
  FulfillmentPackStatus,
  { label: TranslationKey; tone: BadgeTone }
> = {
  OPEN: { label: "pack.status.OPEN", tone: "info" },
  LOCKED: { label: "pack.status.LOCKED", tone: "attention" },
  CLOSED: { label: "pack.status.CLOSED", tone: "success" },
};

/** An open pack past a scheduled day: no new orders, not started either. */
const WAITING_DISPLAY: { label: TranslationKey; tone: BadgeTone } = {
  label: "pack.status.waiting",
  tone: "warning",
};

type ConfirmKind = "lock" | "close" | "delete";

type PackSummaryProps = {
  pack: FulfillmentPackView;
  /** Null hides the progress (closed packs are not counted). */
  progress: PackProgress | null;
  /** On the Packs page the name links to the pack; inside a pack it does not. */
  linksToPack: boolean;
};

/**
 * One pack: name, state, progress and the actions its state allows.
 * - filling or waiting: Start working, or Delete while empty
 * - locked: Close, moving orders not done to the next pack
 * - closed: Reopen
 *
 * Packs link to their reports:
 * - unfulfilled items (filling and locked packs): print after starting
 *   work, before add tracking
 * - sold products (any pack with orders): print after add tracking
 */
export function PackSummary({ pack, progress, linksToPack }: PackSummaryProps) {
  const { locale, t } = useI18n();
  const { submit, isBusy } = usePackAction(() => setConfirming(null));
  const [confirming, setConfirming] = useState<ConfirmKind | null>(null);

  const name = formatPackName(pack, t);
  const status = pack.isWaiting
    ? WAITING_DISPLAY
    : STATUS_DISPLAY[pack.status];
  const leftCount = progress ? countLeftInPack(progress) : null;
  const packFields = { [PACK_ACTION_FIELDS.packId]: pack.id };

  const handleConfirm = () => {
    if (confirming === "close") {
      submit("close", {
        ...packFields,
        [PACK_ACTION_FIELDS.moveLeftovers]: "true",
      });
    } else if (confirming) {
      submit(confirming, packFields);
    }
  };

  return (
    <div className="pack-summary">
      <div className="pack-summary__header">
        {linksToPack ? (
          <Link to={buildPackUrl(pack.id)} className="pack-summary__name">
            {name}
          </Link>
        ) : (
          <span className="pack-summary__name">{name}</span>
        )}
        <Badge tone={status.tone}>{t(status.label)}</Badge>
        <span className="pack-summary__meta">
          {[
            t("pack.orderCount", { count: pack.orderCount }),
            pack.startedAt
              ? t("pack.startedAt", {
                  time: formatPackTime(pack.startedAt, locale),
                })
              : null,
            pack.lockedAt
              ? t("pack.lockedAt", {
                  time: formatPackTime(pack.lockedAt, locale),
                })
              : null,
            pack.closedAt
              ? t("pack.closedAt", {
                  time: formatPackTime(pack.closedAt, locale),
                })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>

        <div className="pack-summary__actions">
          {pack.status !== "CLOSED" && pack.orderCount > 0 ? (
            <Link
              to={`${UNFULFILLED_REPORT_PATH}?${REPORT_PACK_PARAM}=${encodeURIComponent(pack.id)}`}
              className={`pack-summary__button${pack.status === "LOCKED" ? " --emphasis" : ""}`}
            >
              {t("pack.action.report")}
            </Link>
          ) : null}
          {pack.orderCount > 0 ? (
            <Link
              to={`${SOLD_REPORT_PATH}?${REPORT_PACK_PARAM}=${encodeURIComponent(pack.id)}`}
              className="pack-summary__button"
            >
              {t("pack.action.soldReport")}
            </Link>
          ) : null}
          {pack.status === "OPEN" && pack.orderCount === 0 ? (
            <button
              type="button"
              className="pack-summary__button"
              disabled={isBusy}
              onClick={() => setConfirming("delete")}
            >
              {t("pack.action.delete")}
            </button>
          ) : null}
          {pack.status === "OPEN" ? (
            <button
              type="button"
              className="pack-summary__button --primary"
              disabled={isBusy || pack.orderCount === 0}
              onClick={() => setConfirming("lock")}
            >
              {t("pack.action.lock")}
            </button>
          ) : null}
          {pack.status === "LOCKED" ? (
            <button
              type="button"
              className={`pack-summary__button${leftCount === 0 ? " --primary" : ""}`}
              disabled={isBusy}
              onClick={() => setConfirming("close")}
            >
              {leftCount
                ? t("pack.action.closeAndMove", { count: leftCount })
                : t("pack.action.close")}
            </button>
          ) : null}
          {pack.status === "CLOSED" ? (
            <button
              type="button"
              className="pack-summary__button"
              disabled={isBusy}
              onClick={() => submit("reopen", packFields)}
            >
              {t("pack.action.reopen")}
            </button>
          ) : null}
        </div>
      </div>

      {progress ? <PackProgressBar progress={progress} /> : null}

      {pack.taggingCount > 0 ? (
        <div className="pack-summary__info">
          {t("pack.tagging", { count: pack.taggingCount })}
        </div>
      ) : null}

      {pack.tagFailedCount > 0 ? (
        <div className="pack-summary__warning">
          {t("pack.tagFailed", { count: pack.tagFailedCount })}
          <button
            type="button"
            className="pack-summary__link-button"
            disabled={isBusy}
            onClick={() => submit("retryTagging", packFields)}
          >
            {t("pack.action.retryTagging")}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirming !== null}
        title={
          confirming === "lock"
            ? t("pack.confirm.lockTitle", { name })
            : confirming === "close"
              ? t("pack.confirm.closeTitle", { name })
              : t("pack.confirm.deleteTitle", { name })
        }
        confirmLabel={
          confirming === "lock"
            ? t("pack.action.lock")
            : confirming === "close"
              ? leftCount
                ? t("pack.action.closeAndMove", { count: leftCount })
                : t("pack.action.close")
              : t("pack.action.delete")
        }
        cancelLabel={t("pack.action.cancel")}
        isConfirmDisabled={isBusy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      >
        {confirming === "lock" ? <p>{t("pack.confirm.lockBody")}</p> : null}
        {confirming === "close" ? (
          <p>
            {leftCount === 0
              ? t("pack.confirm.closeBody")
              : leftCount === null
                ? t("pack.confirm.closeBodyUnknown")
                : t("pack.confirm.closeBodyLeftovers", { count: leftCount })}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function PackProgressBar({ progress }: { progress: PackProgress }) {
  const { t } = useI18n();
  const leftCount = countLeftInPack(progress);

  if (!progress.total || !progress.done || leftCount === null) {
    return (
      <div className="pack-summary__progress-text">
        {t("pack.progressUnavailable")}
      </div>
    );
  }

  const total = progress.total.count;
  const done = progress.done.count;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="pack-summary__progress">
      <div
        className="pack-summary__progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div
          className={`pack-summary__progress-fill${leftCount === 0 ? " --complete" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="pack-summary__progress-text">
        {leftCount === 0 && total > 0
          ? t("pack.progressAllDone", { total })
          : t("pack.progress", { done, total, left: leftCount })}
      </span>
    </div>
  );
}
