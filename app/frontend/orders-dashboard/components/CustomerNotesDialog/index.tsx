import { useEffect, useRef, useState } from "react";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import type { OrderWithCustomerNote } from "app/commons/orders/CustomerNote";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import { CustomerNoteText } from "app/frontend/orders-dashboard/components/CustomerNoteCell";
import "app/frontend/orders-dashboard/components/CustomerNotesDialog/styles.scss";

/** What the admin has to look at before add tracking starts. */
export type NotesReview =
  | {
      kind: "notes";
      ordersWithNotes: OrderWithCustomerNote[];
      /** How many orders the job would run on. */
      orderCount: number;
    }
  | { kind: "loadFailed"; error: string };

type CustomerNotesDialogProps = {
  /** Null keeps the dialog closed. */
  review: NotesReview | null;
  shopAdminUrl: string;
  onCancel: () => void;
  /** Starts add tracking without the orders the admin unticked. */
  onConfirm: (leftOutOrderIds: string[]) => void;
};

/**
 * Shown before add tracking when a selected order has a customer note: every
 * note in full, in one place, so none is missed. The admin can leave an order
 * out (e.g. "please deliver next week") and go on with the rest.
 */
export function CustomerNotesDialog({
  review,
  shopAdminUrl,
  onCancel,
  onConfirm,
}: CustomerNotesDialogProps) {
  const { t } = useI18n();
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
    review?.kind === "notes" ? review.orderCount - leftOutIds.length : 0;

  return (
    <dialog
      ref={dialogRef}
      className="customer-notes-dialog"
      // Esc closes a native dialog; keep React's state in step
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {review?.kind === "notes" ? (
        <>
          <h2 className="customer-notes-dialog__title">
            {t("notes.dialogTitle")}
          </h2>
          <p className="customer-notes-dialog__intro">
            {t("notes.dialogIntro", { count: review.ordersWithNotes.length })}
          </p>

          <ul className="customer-notes-dialog__list">
            {review.ordersWithNotes.map((order) => {
              const isLeftOut = leftOutIds.includes(order.id);
              return (
                <li
                  key={order.id}
                  className={`customer-notes-dialog__item${
                    isLeftOut ? " --left-out" : ""
                  }`}
                >
                  <div className="customer-notes-dialog__item-header">
                    <a
                      href={ShopifyUtils.getOrderAdminUrl(
                        order.id,
                        shopAdminUrl,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="customer-notes-dialog__order-link"
                    >
                      {order.name}
                    </a>
                    <span className="customer-notes-dialog__customer">
                      {order.customerName}
                    </span>
                    <label className="customer-notes-dialog__include">
                      <input
                        type="checkbox"
                        checked={!isLeftOut}
                        onChange={() => toggle(order.id)}
                      />
                      {t("notes.include")}
                    </label>
                  </div>
                  <div className="customer-notes-dialog__note">
                    <CustomerNoteText customerNote={order} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="customer-notes-dialog__footer">
            {leftOutIds.length > 0 ? (
              <span className="customer-notes-dialog__left-out">
                {t("notes.leftOut", { count: leftOutIds.length })}
              </span>
            ) : null}
            <button
              type="button"
              className="customer-notes-dialog__secondary"
              onClick={onCancel}
            >
              {t("notes.cancel")}
            </button>
            <button
              type="button"
              className="customer-notes-dialog__primary"
              disabled={confirmCount <= 0}
              onClick={() => onConfirm(leftOutIds)}
            >
              {t("notes.confirm", { count: confirmCount })}
            </button>
          </div>
        </>
      ) : null}

      {review?.kind === "loadFailed" ? (
        <>
          <h2 className="customer-notes-dialog__title">
            {t("notes.loadFailedTitle")}
          </h2>
          <p className="customer-notes-dialog__intro">{review.error}</p>
          <div className="customer-notes-dialog__footer">
            <button
              type="button"
              className="customer-notes-dialog__secondary"
              onClick={onCancel}
            >
              {t("notes.cancel")}
            </button>
            <button
              type="button"
              className="customer-notes-dialog__primary"
              onClick={() => onConfirm([])}
            >
              {t("notes.addWithoutChecking")}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
