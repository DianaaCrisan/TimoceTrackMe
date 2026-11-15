/**
 * The admin's weight limit per parcel, and what happens to fulfillments over
 * it. Without a limit, nothing is checked or split.
 */
export type ParcelWeightSettings = {
  /** Heaviest parcel to ship, in kg; null when the check is off. */
  parcelWeightLimitKg: number | null;
  /**
   * Split fulfillments over the limit into several parcels when adding
   * tracking. When false, heavy orders are only highlighted.
   */
  autoSplitHeavyOrders: boolean;
};

export const PARCEL_WEIGHT_LIMIT_FIELD = "parcelWeightLimitKg";
export const AUTO_SPLIT_HEAVY_ORDERS_FIELD = "autoSplitHeavyOrders";

/** The limit add tracking splits at, or null when it must not split. */
export function getSplitLimitKg(settings: ParcelWeightSettings): number | null {
  return settings.autoSplitHeavyOrders ? settings.parcelWeightLimitKg : null;
}

export function isOverWeightLimit(
  weightKg: number | null,
  settings: ParcelWeightSettings,
): boolean {
  return (
    weightKg !== null &&
    settings.parcelWeightLimitKg !== null &&
    weightKg > settings.parcelWeightLimitKg
  );
}

/**
 * Reads the limit typed on the Settings page: empty turns the check off,
 * otherwise it must be a positive number of kg (comma or dot decimals).
 * Returns undefined when the value is not valid.
 */
export function parseWeightLimitKg(
  value: FormDataEntryValue | null,
): number | null | undefined {
  const text = typeof value === "string" ? value.trim().replace(",", ".") : "";
  if (text === "") return null;

  const limitKg = Number(text);
  return Number.isFinite(limitKg) && limitKg > 0 ? limitKg : undefined;
}
