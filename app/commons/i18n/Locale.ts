/** The languages the app is translated into. Anything else falls back to English. */
export const LOCALES = ["en", "ro"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * The URL parameter Shopify uses for the admin user's language when it loads
 * the app, and the form field the dashboard sends it back in so the server can
 * answer in the same language.
 */
export const LOCALE_PARAM = "locale";

/** For `Intl` date formatting. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  ro: "ro-RO",
};

/** "ro", "ro-RO" and "ro_RO" are Romanian; everything else is English. */
export function resolveLocale(value: unknown): Locale {
  if (typeof value !== "string") return DEFAULT_LOCALE;

  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return LOCALES.find((locale) => locale === language) ?? DEFAULT_LOCALE;
}
