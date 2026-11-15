import { useEffect, useRef, useState } from "react";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { hasCustomerNote } from "app/commons/orders/CustomerNote";
import type { OrderToReview } from "app/commons/orders/TrackingReview";
import { formatKilograms } from "app/commons/shipping/Weight";
import { Badge } from "app/frontend/core/components/Badge";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { CustomerNoteText } from "app/frontend/orders-dashboard/components/CustomerNoteCell";
import "app/frontend/orders-dashboard/components/TrackingReviewDialog/styles.scss";

/** What the admin has to look at before add tracking starts. */
export type TrackingReview =
  | {
      kind: "review";
      ordersToReview: OrderToReview[];
      /** How many orders the job would run on. */
      orderCount: number;
      parcelWeightLimitKg: number | null;
    }
  | { kind: "loadFailed"; error: string };

type TrackingReviewDialogProps = {
  /** Null keeps the dialog closed. */
  review: TrackingReview | null;
  shopAdminUrl: string;
  onCancel: () => void;
  /** Starts add tracking without the orders the admin unticked. */
  onConfirm: (leftOutOrderIds: string[]) => void;
};

/**
 * Shown before add tracking when a selected order needs a look, all in one
 * place so none is missed:
 * - every customer note in full
 * - orders over the weight limit that would ship as one parcel (auto split
 *   off)
 *
 * The admin can leave an order out (e.g. "please deliver next week", or to
 * split it by hand) and go on with the rest.
 */
export function TrackingReviewDialog({
  review,
  shopAdminUrl,
  onCancel,
  onConfirm,
}: TrackingReviewDialogProps) {
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [leftOutIds, setLeftOutIds] = useState<string[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (review && !dialog.open) {
      setLeftOutIds([]);
      dialog.showModal();
    } else if (!review && dialog.open) {
      dialog.close();
    }
  }, [review]);

  const toggle = (orderId: string) =>
    setLeftOutIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );

  const confirmCount =
    review?.kind === "review" ? review.orderCount - leftOutIds.length : 0;

  return (
    <dialog
      ref={dialogRef}
      className="tracking-review-dialog"
      // Esc closes a native dialog; keep React's state in step
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {review?.kind === "review" ? (
        <>
          <h2 className="tracking-review-dialog__title">
            {t("trackingReview.dialogTitle")}
          </h2>
          <p className="tracking-review-dialog__intro">
            {t("trackingReview.dialogIntro", {
              count: review.ordersToReview.length,
            })}
          </p>

          <ul className="tracking-review-dialog__list">
            {review.ordersToReview.map((order) => {
              const isLeftOut = leftOutIds.includes(order.id);
              return (
                <li
                  key={order.id}
                  className={`tracking-review-dialog__item${
                    isLeftOut ? " --left-out" : ""
                  }`}
                >
                  <div className="tracking-review-dialog__item-header">
                    <a
                      href={ShopifyUtils.getOrderAdminUrl(
                        order.id,
                        shopAdminUrl,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tracking-review-dialog__order-link"
                    >
                      {order.name}
                    </a>
                    <span className="tracking-review-dialog__customer">
                      {order.customerName}
                    </span>
                    <label className="tracking-review-dialog__include">
                      <input
                        type="checkbox"
                        checked={!isLeftOut}
                        onChange={() => toggle(order.id)}
                      />
                      {t("trackingReview.include")}
                    </label>
                  </div>
                  {order.shipsOverWeightLimit &&
                  order.weightKg !== null &&
                  review.parcelWeightLimitKg !== null ? (
                    <div className="tracking-review-dialog__weight">
                      <Badge tone="warning">
                        {formatKilograms(order.weightKg, locale)}
                      </Badge>
                      {t("trackingReview.overWeightLimit", {
                        limit: formatKilograms(
                          review.parcelWeightLimitKg,
                          locale,
                        ),
                      })}
                    </div>
                  ) : null}
                  {hasCustomerNote(order) ? (
                    <div className="tracking-review-dialog__note">
                      <CustomerNoteText customerNote={order} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="tracking-review-dialog__footer">
            {leftOutIds.length > 0 ? (
              <span className="tracking-review-dialog__left-out">
                {t("trackingReview.leftOut", { count: leftOutIds.length })}
              </span>
            ) : null}
            <button
              type="button"
              className="tracking-review-dialog__secondary"
              onClick={onCancel}
            >
              {t("trackingReview.cancel")}
            </button>
            <button
              type="button"
              className="tracking-review-dialog__primary"
              disabled={confirmCount <= 0}
              onClick={() => onConfirm(leftOutIds)}
            >
              {t("trackingReview.confirm", { count: confirmCount })}
            </button>
          </div>
        </>
      ) : null}

      {review?.kind === "loadFailed" ? (
        <>
          <h2 className="tracking-review-dialog__title">
            {t("trackingReview.loadFailedTitle")}
          </h2>
          <p className="tracking-review-dialog__intro">{review.error}</p>
          <div className="tracking-review-dialog__footer">
            <button
              type="button"
              className="tracking-review-dialog__secondary"
              onClick={onCancel}
            >
              {t("trackingReview.cancel")}
            </button>
            <button
              type="button"
              className="tracking-review-dialog__primary"
              onClick={() => onConfirm([])}
            >
              {t("trackingReview.addWithoutChecking")}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
