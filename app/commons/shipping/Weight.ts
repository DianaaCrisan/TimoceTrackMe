/** Shopify's `WeightUnit`. */
export type WeightUnit = "GRAMS" | "KILOGRAMS" | "OUNCES" | "POUNDS";

const KILOGRAMS_PER_UNIT: Record<WeightUnit, number> = {
  GRAMS: 0.001,
  KILOGRAMS: 1,
  OUNCES: 0.028349523125,
  POUNDS: 0.45359237,
};

/**
 * A Shopify weight in kg. Every weight the app ships with goes through this:
 * GLS takes parcel weights in kg only (see docs/gls-shipping-specification.md),
 * while each product in Shopify can use its own unit.
 */
export function toKilograms(value: number, unit: WeightUnit): number {
  return value * KILOGRAMS_PER_UNIT[unit];
}

/**
 * A kg weight as sent on an AWB: rounded to the gram, so float noise such as
 * 0.30000000000000004 never reaches the courier.
 */
export function formatKilogramsForAwb(weightKg: number): string {
  return String(Math.round(weightKg * 1000) / 1000);
}

/** A kg weight for the admin to read, such as "12.4 kg". */
export function formatKilograms(weightKg: number, locale: string): string {
  return `${weightKg.toLocaleString(locale, { maximumFractionDigits: 1 })} kg`;
}
