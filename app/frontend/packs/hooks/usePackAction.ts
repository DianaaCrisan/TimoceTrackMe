import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { LOCALE_PARAM } from "app/commons/i18n/Locale";
import { PACKS_MANAGE_PATH } from "app/commons/packs/FulfillmentPack";
import {
  PACK_ACTION_FIELDS,
  type PackActionIntent,
  type PackActionResponse,
} from "app/commons/packs/PackAction";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import {
  useBackgroundActivityContext,
  type BackgroundActivity,
} from "app/frontend/jobs/hooks/useBackgroundActivity";

/**
 * Sends a pack action and shows the server's answer as a toast.
 *
 * The page's data reloads on its own after the action, which already shows
 * the orders it moved as being updated. The Shopify tags follow in the
 * background: the page's background activity (`activity`, or the one from
 * context) follows that work and reloads the page once it is done.
 */
export function usePackAction(
  onSuccess?: (response: Extract<PackActionResponse, { ok: true }>) => void,
  activity?: BackgroundActivity | null,
) {
  const fetcher = useFetcher<PackActionResponse>();
  const shopify = useAppBridge();
  const { locale } = useI18n();

  const contextActivity = useBackgroundActivityContext();
  const followRef = useRef((activity ?? contextActivity)?.follow);
  followRef.current = (activity ?? contextActivity)?.follow;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const response = fetcher.data;
    if (!response) return;

    if (!response.ok) {
      shopify.toast.show(response.error, { isError: true, duration: 8000 });
      return;
    }

    shopify.toast.show(response.message, { duration: 6000 });
    if (response.tagBatchId) {
      followRef.current?.({ batchId: response.tagBatchId });
    }
    onSuccessRef.current?.(response);
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
