import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { SettingsRepository } from "app/backend/settings/SettingsRepository.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import {
  AUTO_SPLIT_HEAVY_ORDERS_FIELD,
  PARCEL_WEIGHT_LIMIT_FIELD,
  parseWeightLimitKg,
} from "app/commons/settings/ParcelWeightSettings";
import {
  ISO_WEEKDAYS,
  PACK_START_WEEKDAYS_FIELD,
  parsePackStartWeekdays,
} from "app/commons/packs/PackSchedule";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

/** Which form was saved: each section saves on its own. */
const INTENT_FIELD = "intent";
const PACK_SCHEDULE_INTENT = "packSchedule";
const JOBS_ONLY_IN_PACKS_FIELD = "jobsOnlyInPacks";

/** How the shop works with the app, set by the shop's admin. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const settings = await SettingsRepository.get();
  return {
    parcelWeight: {
      parcelWeightLimitKg: settings.parcelWeightLimitKg,
      autoSplitHeavyOrders: settings.autoSplitHeavyOrders,
    },
    packStartWeekdays: settings.packStartWeekdays,
    jobsOnlyInPacks: settings.jobsOnlyInPacks,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const t = createTranslator(resolveLocale(formData.get(LOCALE_PARAM)));

  if (formData.get(INTENT_FIELD) === PACK_SCHEDULE_INTENT) {
    await SettingsRepository.update({
      packStartWeekdays: parsePackStartWeekdays(
        formData.getAll(PACK_START_WEEKDAYS_FIELD),
      ),
      jobsOnlyInPacks: formData.get(JOBS_ONLY_IN_PACKS_FIELD) === "true",
    });
    return { ok: true };
  }

  const parcelWeightLimitKg = parseWeightLimitKg(
    formData.get(PARCEL_WEIGHT_LIMIT_FIELD),
  );
  if (parcelWeightLimitKg === undefined) {
    return { ok: false, error: t("settings.invalidWeightLimit") };
  }

  await SettingsRepository.update({
    parcelWeightLimitKg,
    autoSplitHeavyOrders:
      formData.get(AUTO_SPLIT_HEAVY_ORDERS_FIELD) === "true",
  });
  return { ok: true };
};

export default function SettingsPage() {
  const { parcelWeight, packStartWeekdays, jobsOnlyInPacks } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const scheduleFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const { locale, t } = useI18n();

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show(t("settings.saved"));
    // `t` is left out: a language change reloads the app, and the toast must
    // only show when a response arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, shopify]);

  useEffect(() => {
    if (scheduleFetcher.data?.ok) shopify.toast.show(t("settings.saved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleFetcher.data, shopify]);

  return (
    <s-page heading={t("settings.heading")}>
      <s-section heading={t("settings.parcelWeightHeading")}>
        <fetcher.Form method="post">
          <input type="hidden" name={LOCALE_PARAM} value={locale} />
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("settings.parcelWeightIntro")}</s-paragraph>
            <s-stack direction="block" gap="small-200">
              {/* a few digits: a full-width field reads as a long text */}
              <s-box maxInlineSize="200px">
                <s-number-field
                  label={t("settings.weightLimit")}
                  name={PARCEL_WEIGHT_LIMIT_FIELD}
                  defaultValue={
                    parcelWeight.parcelWeightLimitKg?.toString() ?? ""
                  }
                  suffix="kg"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                />
              </s-box>
              <s-text color="subdued">
                {t("settings.weightLimitDetails")}
              </s-text>
            </s-stack>
            <s-checkbox
              label={t("settings.autoSplit")}
              name={AUTO_SPLIT_HEAVY_ORDERS_FIELD}
              value="true"
              defaultChecked={parcelWeight.autoSplitHeavyOrders}
              details={t("settings.autoSplitDetails")}
            />
            {fetcher.data && !fetcher.data.ok ? (
              <s-banner tone="critical">{fetcher.data.error}</s-banner>
            ) : null}
            <div>
              <s-button
                type="submit"
                variant="primary"
                {...(fetcher.state !== "idle" ? { loading: true } : {})}
              >
                {t("settings.save")}
              </s-button>
            </div>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section heading={t("settings.packScheduleHeading")}>
        <scheduleFetcher.Form method="post">
          <input type="hidden" name={LOCALE_PARAM} value={locale} />
          <input
            type="hidden"
            name={INTENT_FIELD}
            value={PACK_SCHEDULE_INTENT}
          />
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("settings.packScheduleIntro")}</s-paragraph>
            <s-stack direction="inline" gap="base">
              {ISO_WEEKDAYS.map((weekday) => (
                <s-checkbox
                  key={weekday}
                  label={t(`weekday.${weekday}`)}
                  name={PACK_START_WEEKDAYS_FIELD}
                  value={String(weekday)}
                  defaultChecked={packStartWeekdays.includes(weekday)}
                />
              ))}
            </s-stack>
            <s-text color="subdued">{t("settings.packScheduleDetails")}</s-text>
            <s-checkbox
              label={t("settings.jobsOnlyInPacks")}
              name={JOBS_ONLY_IN_PACKS_FIELD}
              value="true"
              defaultChecked={jobsOnlyInPacks}
              details={t("settings.jobsOnlyInPacksDetails")}
            />
            <div>
              <s-button
                type="submit"
                variant="primary"
                {...(scheduleFetcher.state !== "idle"
                  ? { loading: true }
                  : {})}
              >
                {t("settings.save")}
              </s-button>
            </div>
          </s-stack>
        </scheduleFetcher.Form>
      </s-section>
    </s-page>
  );
}
