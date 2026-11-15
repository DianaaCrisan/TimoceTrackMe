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
        onCancel();
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
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="confirm-dialog__primary"
              disabled={isConfirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
