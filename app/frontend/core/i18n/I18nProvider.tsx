import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "app/commons/i18n/Locale";
import { createTranslator, type Translate } from "app/commons/i18n/translate";

type I18n = { locale: Locale; t: Translate };

const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  t: createTranslator(DEFAULT_LOCALE),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: createTranslator(locale) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The admin user's language (`locale`) and a translator for it (`t`). */
export function useI18n(): I18n {
  return useContext(I18nContext);
}
