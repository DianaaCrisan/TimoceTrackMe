import { useEffect, useState } from "react";
import {
  formatPackName,
  isFillingPack,
  isPackTarget,
  type FulfillmentPackView,
} from "app/commons/packs/FulfillmentPack";
import { FILLING_PACK_TARGET } from "app/commons/packs/PackAction";
import { ConfirmDialog } from "app/frontend/core/components/ConfirmDialog";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import "app/frontend/packs/components/PackPickerDialog/styles.scss";

type PackPickerDialogProps = {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  /** The packs on offer; closed ones are left out. */
  packs: FulfillmentPackView[];
  /** The pack the orders are in now, left out of the choices. */
  currentPackId?: string;
  isBusy: boolean;
  /** A pack ID, or `FILLING_PACK_TARGET` for a new pack. */
  onConfirm: (target: string) => void;
  onCancel: () => void;
};

/**
 * Picks the pack orders go to. The filling pack comes first and is
 * preselected; with no pack filling, "New pack" starts one instead.
 */
export function PackPickerDialog({
  isOpen,
  title,
  confirmLabel,
  packs,
  currentPackId,
  isBusy,
  onConfirm,
  onCancel,
}: PackPickerDialogProps) {
  const { t } = useI18n();
  const choices = packs.filter(
    (pack) => isPackTarget(pack) && pack.id !== currentPackId,
  );
  const hasFillingPack = packs.some(isFillingPack);
  const defaultTarget =
    choices.find(isFillingPack)?.id ??
    (hasFillingPack ? choices[0]?.id : FILLING_PACK_TARGET) ??
    null;

  const [target, setTarget] = useState<string | null>(defaultTarget);
  useEffect(() => {
    if (isOpen) setTarget(defaultTarget);
    // only reset when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={t("pack.action.cancel")}
      isConfirmDisabled={isBusy || target === null}
      onConfirm={() => target && onConfirm(target)}
      onCancel={onCancel}
    >
      <ul className="pack-picker">
        {choices.map((pack) => (
          <li key={pack.id}>
            <label className="pack-picker__choice">
              <input
                type="radio"
                name="pack-target"
                checked={target === pack.id}
                onChange={() => setTarget(pack.id)}
              />
              <span className="pack-picker__name">
                {formatPackName(pack, t)}
              </span>
              <span className="pack-picker__details">
                {t(
                  pack.isWaiting
                    ? "pack.status.waiting"
                    : `pack.status.${pack.status}`,
                )}{" "}
                ·{" "}
                {t("pack.orderCount", { count: pack.orderCount })}
              </span>
            </label>
          </li>
        ))}
        {!hasFillingPack ? (
          <li>
            <label className="pack-picker__choice">
              <input
                type="radio"
                name="pack-target"
                checked={target === FILLING_PACK_TARGET}
                onChange={() => setTarget(FILLING_PACK_TARGET)}
              />
              <span className="pack-picker__name">{t("pack.newPack")}</span>
            </label>
          </li>
        ) : null}
      </ul>
      {choices.length === 0 && hasFillingPack ? (
        <p>{t("pack.picker.noOtherPack")}</p>
      ) : null}
    </ConfirmDialog>
  );
}
