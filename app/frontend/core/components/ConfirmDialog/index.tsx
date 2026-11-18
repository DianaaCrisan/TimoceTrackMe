import { useEffect, useRef, type ReactNode } from "react";
import "app/frontend/core/components/ConfirmDialog/styles.scss";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  /** What will happen; the dialog's body. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  isConfirmDisabled?: boolean;
  /**
   * The confirmed action's request is on its way: the confirm button shows
   * a spinner, and the dialog cannot be closed until the answer arrives.
   */
  isConfirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A modal asking the admin to confirm an action. A native `<dialog>`: the
 * browser's `confirm()` may be blocked inside the Shopify admin's iframe.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel,
  isConfirmDisabled = false,
  isConfirmLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      // Esc closes a native dialog; keep React's state in step
      onCancel={(event) => {
        event.preventDefault();
        if (!isConfirmLoading) onCancel();
      }}
    >
      {isOpen ? (
        <>
          <h2 className="confirm-dialog__title">{title}</h2>
          {children ? <div className="confirm-dialog__body">{children}</div> : null}
          <div className="confirm-dialog__footer">
            <button
              type="button"
              className="confirm-dialog__secondary"
              disabled={isConfirmLoading}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`confirm-dialog__primary${
                isConfirmLoading ? " --loading" : ""
              }`}
              disabled={isConfirmDisabled || isConfirmLoading}
              aria-busy={isConfirmLoading}
              onClick={onConfirm}
            >
              {isConfirmLoading ? (
                <span className="confirm-dialog__spinner" aria-hidden="true" />
              ) : null}
              {confirmLabel}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
