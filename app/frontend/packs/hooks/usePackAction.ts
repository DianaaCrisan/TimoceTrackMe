import { useEffect, useRef } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { LOCALE_PARAM } from "app/commons/i18n/Locale";
import { PACKS_MANAGE_PATH } from "app/commons/packs/FulfillmentPack";
import {
  PACK_ACTION_FIELDS,
  type PackActionIntent,
  type PackActionResponse,
} from "app/commons/packs/PackAction";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

/**
 * Tags are added in the background and Shopify search lags behind them, so
 * the page reloads once more after this long to show where orders landed.
 */
const TAGS_CATCH_UP_MS = 5000;

/**
 * Sends a pack action and shows the server's answer as a toast. The page's
 * data reloads on its own after the action, and once more after
 * `TAGS_CATCH_UP_MS`.
 */
export function usePackAction(
  onSuccess?: (response: Extract<PackActionResponse, { ok: true }>) => void,
) {
  const fetcher = useFetcher<PackActionResponse>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const { locale } = useI18n();

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const revalidateRef = useRef(revalidator.revalidate);
  revalidateRef.current = revalidator.revalidate;

  const catchUpTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(catchUpTimerRef.current), []);

  useEffect(() => {
    const response = fetcher.data;
    if (!response) return;

    if (!response.ok) {
      shopify.toast.show(response.error, { isError: true, duration: 8000 });
      return;
    }

    shopify.toast.show(response.message, { duration: 6000 });
    onSuccessRef.current?.(response);
    clearTimeout(catchUpTimerRef.current);
    catchUpTimerRef.current = setTimeout(
      () => revalidateRef.current(),
      TAGS_CATCH_UP_MS,
    );
  }, [fetcher.data, shopify]);

  function submit(
    intent: PackActionIntent,
    fields: Record<string, string> = {},
    addFields?: (formData: FormData) => void,
  ) {
    const formData = new FormData();
    formData.append(PACK_ACTION_FIELDS.intent, intent);
    formData.append(LOCALE_PARAM, locale);
    Object.entries(fields).forEach(([name, value]) =>
      formData.append(name, value),
    );
    addFields?.(formData);

    fetcher.submit(formData, { method: "post", action: PACKS_MANAGE_PATH });
  }

  return { submit, isBusy: fetcher.state !== "idle" };
}
