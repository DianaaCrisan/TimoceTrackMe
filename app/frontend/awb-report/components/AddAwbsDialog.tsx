import { useEffect, useState } from "react";
import type { AwbStatus } from "app/commons/shipping-labels/AwbReport";
import { ConfirmDialog } from "app/frontend/core/components/ConfirmDialog";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

export type AddAwbsInput = {
  status: AwbStatus;
  day: string;
  awbs: string;
  note: string;
};

type AddAwbsDialogProps = {
  isOpen: boolean;
  /** `YYYY-MM-DD` to start with. */
  defaultDay: string;
  isBusy: boolean;
  error: string | null;
  lineErrors: string[];
  onSubmit: (input: AddAwbsInput) => void;
  onCancel: () => void;
};

const valueOf = (event: Event) =>
  (event.currentTarget as HTMLInputElement).value;

/**
 * Adds AWBs the app cannot find in Shopify, all with one status and issue
 * day. The text is kept when the server sends back lines to fix.
 */
export function AddAwbsDialog({
  isOpen,
  defaultDay,
  isBusy,
  error,
  lineErrors,
  onSubmit,
  onCancel,
}: AddAwbsDialogProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<AwbStatus>("CANCELLED");
  const [day, setDay] = useState(defaultDay);
  const [awbs, setAwbs] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setStatus("CANCELLED");
    setDay(defaultDay);
    setAwbs("");
    setNote("");
    // only reset when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={t("awbReport.add.title")}
      confirmLabel={t("awbReport.add.submit")}
      cancelLabel={t("awbReport.cancel")}
      isConfirmDisabled={isBusy || !awbs.trim() || !day}
      onConfirm={() => onSubmit({ status, day, awbs, note })}
      onCancel={onCancel}
    >
      <s-stack direction="block" gap="base">
        <s-paragraph>{t("awbReport.add.intro")}</s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-box minInlineSize="140px">
            <s-select
              label={t("awbReport.add.status")}
              value={status}
              onChange={(event) => setStatus(valueOf(event) as AwbStatus)}
            >
              <s-option value="CANCELLED">
                {t("awbReport.status.CANCELLED")}
              </s-option>
              <s-option value="USED">{t("awbReport.status.USED")}</s-option>
            </s-select>
          </s-box>
          <s-date-field
            label={t("awbReport.add.day")}
            details={t("awbReport.add.dayDetails")}
            value={day}
            onChange={(event) => setDay(valueOf(event))}
          />
        </s-stack>
        <s-text-area
          label={t("awbReport.add.awbs")}
          details={t("awbReport.add.awbsDetails")}
          rows={6}
          value={awbs}
          onInput={(event) => setAwbs(valueOf(event))}
        />
        <s-text-field
          label={t("awbReport.add.note")}
          value={note}
          onInput={(event) => setNote(valueOf(event))}
        />
        {error ? (
          <s-banner tone="critical">
            <s-stack direction="block" gap="small-200">
              <s-text>{error}</s-text>
              {lineErrors.length > 0 ? (
                <s-unordered-list>
                  {lineErrors.map((line) => (
                    <s-list-item key={line}>{line}</s-list-item>
                  ))}
                </s-unordered-list>
              ) : null}
            </s-stack>
          </s-banner>
        ) : null}
      </s-stack>
    </ConfirmDialog>
  );
}
