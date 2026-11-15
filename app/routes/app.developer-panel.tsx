import { useEffect, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getOptimusTestCredentialsForDisplay,
  sendOptimusConnectionTest,
} from "../backend/optimus/optimus-test.server";
import {
  getS3SetupStatus,
  getRecentJobsSnapshot,
  startTestJob,
} from "../backend/jobs/jobsSetup.server";
import { ReadOnlyField } from "app/frontend/core/components/ReadOnlyField";
import { ResponseViewer } from "app/frontend/core/components/ResponseViewer";
import { RecentJobsSection } from "app/frontend/jobs/components/RecentJobsSection";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

const OPTIMUS_TEST_INTENT = "optimusTest";
const S3_TEST_INTENT = "s3Test";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    credentials: getOptimusTestCredentialsForDisplay(),
    s3Setup: getS3SetupStatus(),
    recentJobs: await getRecentJobsSnapshot(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const t = createTranslator(resolveLocale(formData.get(LOCALE_PARAM)));

  if (intent === S3_TEST_INTENT) {
    try {
      const result = startTestJob(t);

      return {
        intent,
        ok: result.isStarted,
        data: {
          message: result.isStarted
            ? t("developer.testUploadStartedDetails")
            : t("developer.testUploadAlreadyRunning"),
        },
      };
    } catch (error) {
      return {
        intent,
        ok: false,
        data: {
          message:
            error instanceof Error
              ? error.message
              : t("developer.unknownTestUploadError"),
        },
      };
    }
  }

  try {
    const result = await sendOptimusConnectionTest();

    return {
      intent: OPTIMUS_TEST_INTENT,
      ok: result.ok,
      data: result,
    };
  } catch (error) {
    return {
      intent: OPTIMUS_TEST_INTENT,
      ok: false,
      data: {
        message:
          error instanceof Error
            ? error.message
            : t("developer.unknownOptimusError"),
      },
    };
  }
};

/**
 * Tools for whoever runs the app: test the Optimus and S3 connections, and
 * follow the background jobs. Nothing here changes how the shop works; that
 * is the Settings page.
 */
export default function DeveloperPanelPage() {
  const { credentials, s3Setup, recentJobs } = useLoaderData<typeof loader>();
  const optimusFetcher = useFetcher<typeof action>();
  const s3TestFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const { locale, t } = useI18n();

  const isSendingOptimusTest = optimusFetcher.state !== "idle";
  const isStartingS3Test = s3TestFetcher.state !== "idle";
  const isS3SetupComplete = s3Setup.envVars.every((envVar) => envVar.isSet);

  const optimusResponseContent = useMemo(() => {
    if (!optimusFetcher.data) {
      return t("developer.noRequestYet");
    }

    return JSON.stringify(optimusFetcher.data.data, null, 2);
  }, [optimusFetcher.data, t]);

  useEffect(() => {
    if (!optimusFetcher.data) return;

    shopify.toast.show(
      optimusFetcher.data.ok
        ? t("developer.optimusTestCompleted")
        : t("developer.optimusTestFailed"),
    );
    // `t` is left out: a language change reloads the app, and the toast must
    // only show when a response arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimusFetcher.data, shopify]);

  useEffect(() => {
    if (!s3TestFetcher.data) return;

    shopify.toast.show(
      s3TestFetcher.data.ok
        ? t("developer.testUploadStarted")
        : t("developer.testUploadCouldNotStart"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s3TestFetcher.data, shopify]);

  return (
    <s-page heading={t("developer.heading")}>
      <s-stack direction="block" gap="large">
        <s-section heading={t("developer.credentialsHeading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("developer.credentialsIntro")}</s-paragraph>

            <ReadOnlyField
              label={t("developer.apiUrl")}
              value={credentials.apiUrl}
            />
            <ReadOnlyField
              label={t("developer.username")}
              value={credentials.username}
            />
            <ReadOnlyField
              label={t("developer.apiKey")}
              value={credentials.maskedApiKey}
            />
          </s-stack>
        </s-section>

        <s-section heading={t("developer.testRequestHeading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("developer.testRequestIntro")}</s-paragraph>

            <optimusFetcher.Form method="post">
              <input type="hidden" name="intent" value={OPTIMUS_TEST_INTENT} />
              <input type="hidden" name={LOCALE_PARAM} value={locale} />
              <s-button
                type="submit"
                {...(isSendingOptimusTest ? { loading: true } : {})}
              >
                {t("developer.sendTestRequest")}
              </s-button>
            </optimusFetcher.Form>
          </s-stack>
        </s-section>

        <ResponseViewer content={optimusResponseContent} />

        <s-section heading={t("developer.s3Heading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("developer.s3Intro")}</s-paragraph>

            <s-stack direction="block" gap="small-200">
              {s3Setup.envVars.map((envVar) => (
                <s-text key={envVar.name}>
                  {envVar.isSet ? "✅" : "❌"} {envVar.name}
                </s-text>
              ))}
            </s-stack>

            <ReadOnlyField
              label={t("developer.s3Bucket")}
              value={s3Setup.bucket ?? t("developer.notSet")}
            />
            <ReadOnlyField
              label={t("developer.awsRegion")}
              value={s3Setup.region ?? t("developer.notSet")}
            />
            <ReadOnlyField
              label={t("developer.appFolder")}
              value={s3Setup.appFolderKey || t("developer.bucketRoot")}
            />

            {s3Setup.appFolderConsoleUrl ? (
              <s-link href={s3Setup.appFolderConsoleUrl} target="_blank">
                {t("developer.openAppFolder")}
              </s-link>
            ) : null}

            <s-paragraph>{t("developer.s3TestIntro")}</s-paragraph>

            <s3TestFetcher.Form method="post">
              <input type="hidden" name="intent" value={S3_TEST_INTENT} />
              <input type="hidden" name={LOCALE_PARAM} value={locale} />
              <s-button
                type="submit"
                {...(isStartingS3Test ? { loading: true } : {})}
                {...(!isS3SetupComplete ? { disabled: true } : {})}
              >
                {t("developer.uploadTestFile")}
              </s-button>
            </s3TestFetcher.Form>

            {s3TestFetcher.data && "message" in s3TestFetcher.data.data ? (
              <s-text>{s3TestFetcher.data.data.message}</s-text>
            ) : null}
          </s-stack>
        </s-section>

        <RecentJobsSection
          initialSnapshot={recentJobs}
          refreshSignal={s3TestFetcher.data}
        />
      </s-stack>
    </s-page>
  );
}
