import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  type Locale,
} from "app/commons/i18n/Locale";

export class DateUtils {
  static formatDate(value: string, locale: Locale = DEFAULT_LOCALE) {
    const date = new Date(value);

    if (locale === "ro") return formatRomanianDate(date);

    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

/**
 * As Shopify's Romanian admin shows it: "13 apr. la 23:04", with the year only
 * when it is not the current one ("13 apr. 2025 la 23:04").
 */
function formatRomanianDate(date: Date): string {
  const isThisYear = date.getFullYear() === new Date().getFullYear();

  const day = new Intl.DateTimeFormat(INTL_LOCALE.ro, {
    day: "numeric",
    month: "short",
    ...(isThisYear ? {} : { year: "numeric" }),
  }).format(date);
  const time = new Intl.DateTimeFormat(INTL_LOCALE.ro, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${day} la ${time}`;
}
