import { DEFAULT_LOCALE, type Locale } from "./Locale";
import {
  en,
  ro,
  type TranslationEntry,
  type TranslationKey,
} from "./translations";

export type TranslationParams = Record<string, string | number>;

/** Turns a key into text in one language. Used in the browser and on the server. */
export type Translate = (
  key: TranslationKey,
  params?: TranslationParams,
) => string;

const DICTIONARIES: Record<Locale, Record<TranslationKey, TranslationEntry>> = {
  en,
  ro,
};

export function isTranslationKey(key: string): key is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translate {
  const pluralRules = new Intl.PluralRules(locale);

  return (key, params = {}) => {
    const entry = DICTIONARIES[locale][key] ?? en[key];
    const template =
      typeof entry === "string"
        ? entry
        : pickPluralForm(entry, pluralRules, params.count);

    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in params ? String(params[name]) : placeholder,
    );
  };
}

function pickPluralForm(
  forms: Exclude<TranslationEntry, string>,
  pluralRules: Intl.PluralRules,
  count: string | number | undefined,
): string {
  if (typeof count !== "number") return forms.other;

  const category = pluralRules.select(count);
  if (category === "one" || category === "few") {
    return forms[category] ?? forms.other;
  }
  return forms.other;
}

/** For server code and tests that have no user language to go by. */
export const translateEn: Translate = createTranslator("en");

/**
 * A Shopify value such as `PARTIALLY_PAID`, translated when the dictionary has
 * it (`financialStatus.PARTIALLY_PAID`), otherwise shown as "Partially paid".
 */
export function translateShopifyEnum(
  t: Translate,
  prefix: "financialStatus" | "fulfillmentStatus" | "deliveryMethod",
  value: string | null | undefined,
): string {
  if (!value) return "";

  const key = `${prefix}.${value}`;
  if (isTranslationKey(key)) return t(key);

  const formatted = value.toLowerCase().replace(/_/g, " ");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
