import type {
  HeadersFunction,
  LoaderFunctionArgs,
  ShouldRevalidateFunction,
} from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import { I18nProvider } from "app/frontend/core/i18n/I18nProvider";
import { UNFULFILLED_REPORT_PATH } from "app/commons/unfulfilled-report/UnfulfilledReport";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    // the language the admin user picked in their Shopify settings
    locale: resolveLocale(url.searchParams.get(LOCALE_PARAM)),
  };
};

/**
 * Shopify passes `?locale=` only when it loads the app, and loads it again
 * when the user changes their language. In-app navigation drops the param, so
 * keep the language from that load rather than falling back to English.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  defaultShouldRevalidate,
}) =>
  nextUrl.searchParams.has(LOCALE_PARAM) ? defaultShouldRevalidate : false;

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const t = createTranslator(locale);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <I18nProvider locale={locale}>
        <s-app-nav>
          <s-link href="/app/orders-dashboard">{t("nav.orders")}</s-link>
          <s-link href={UNFULFILLED_REPORT_PATH}>
            {t("nav.unfulfilledReport")}
          </s-link>
          <s-link href="/app/admin-panel">{t("nav.adminPanel")}</s-link>
        </s-app-nav>
        <Outlet />
      </I18nProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
