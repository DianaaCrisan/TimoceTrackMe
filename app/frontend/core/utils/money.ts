import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";

/**
 * English: "RON 48.94" as Shopify's API gives the amount.
 * Romanian: "48,94 lei", as Shopify's Romanian admin shows it.
 */
export function formatMoney(
  amount: string,
  currencyCode: string,
  locale: Locale,
): string {
  const value = Number(amount);
  if (locale !== "ro" || !Number.isFinite(value)) {
    return `${currencyCode} ${amount}`;
  }

  try {
    return new Intl.NumberFormat(INTL_LOCALE.ro, {
      style: "currency",
      currency: currencyCode,
    })
      .formatToParts(value)
      .map((part) =>
        part.type === "currency" && currencyCode === "RON" ? "lei" : part.value,
      )
      .join("");
  } catch {
    // a currency code Intl does not know
    return `${amount} ${currencyCode}`;
  }
}
