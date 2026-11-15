import type { ParcelWeightSettings } from "app/commons/settings/ParcelWeightSettings";
import { formatKilograms } from "app/commons/shipping/Weight";
import { Badge } from "app/frontend/core/components/Badge";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import "app/frontend/orders-dashboard/components/WeightCell/styles.scss";

type WeightCellProps = {
  weightKg: number | null;
  /** A shipping order over the admin's weight limit. */
  isHeavy: boolean;
  /** How many parcels the order shipped in; null until all of it shipped. */
  shippedParcelCount: number | null;
  parcelWeight: ParcelWeightSettings;
};

/**
 * The order's weight. Over the limit, a badge says:
 * - once all of it shipped in several parcels: how many
 * - otherwise, what add tracking does with it: split it, or ship it as one
 *   heavy parcel
 */
export function WeightCell({
  weightKg,
  isHeavy,
  shippedParcelCount,
  parcelWeight,
}: WeightCellProps) {
  const { locale, t } = useI18n();

  if (weightKg === null) return <>-</>;

  const weight = formatKilograms(weightKg, locale);
  if (!isHeavy || parcelWeight.parcelWeightLimitKg === null)
    return <>{weight}</>;

  const limit = formatKilograms(parcelWeight.parcelWeightLimitKg, locale);
  const isSplit = shippedParcelCount !== null && shippedParcelCount > 1;
  const willSplit =
    shippedParcelCount === null && parcelWeight.autoSplitHeavyOrders;

  return (
    <span className="weight-cell" title={t("weight.limitTitle", { limit })}>
      <span className="weight-cell__value">{weight}</span>
      {isSplit ? (
        <Badge tone="info">
          {t("weight.splitInto", { count: shippedParcelCount })}
        </Badge>
      ) : willSplit ? (
        <Badge tone="info">{t("weight.willSplit")}</Badge>
      ) : (
        <Badge tone="warning">{t("weight.overLimit", { limit })}</Badge>
      )}
    </span>
  );
}
