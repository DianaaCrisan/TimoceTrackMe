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
            ? t("admin.testUploadStartedDetails")
            : t("admin.testUploadAlreadyRunning"),
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
              : t("admin.unknownTestUploadError"),
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
            : t("admin.unknownOptimusError"),
      },
    };
  }
};

export default function AdminPanelPage() {
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
      return t("admin.noRequestYet");
    }

    return JSON.stringify(optimusFetcher.data.data, null, 2);
  }, [optimusFetcher.data, t]);

  useEffect(() => {
    if (!optimusFetcher.data) return;

    shopify.toast.show(
      optimusFetcher.data.ok
        ? t("admin.optimusTestCompleted")
        : t("admin.optimusTestFailed"),
    );
    // `t` is left out: a language change reloads the app, and the toast must
    // only show when a response arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimusFetcher.data, shopify]);

  useEffect(() => {
    if (!s3TestFetcher.data) return;

    shopify.toast.show(
      s3TestFetcher.data.ok
        ? t("admin.testUploadStarted")
        : t("admin.testUploadCouldNotStart"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s3TestFetcher.data, shopify]);

  return (
    <s-page heading={t("admin.heading")}>
      <s-stack direction="block" gap="large">
        <s-section heading={t("admin.credentialsHeading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("admin.credentialsIntro")}</s-paragraph>

            <ReadOnlyField
              label={t("admin.apiUrl")}
              value={credentials.apiUrl}
            />
            <ReadOnlyField
              label={t("admin.username")}
              value={credentials.username}
            />
            <ReadOnlyField
              label={t("admin.apiKey")}
              value={credentials.maskedApiKey}
            />
          </s-stack>
        </s-section>

        <s-section heading={t("admin.testRequestHeading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("admin.testRequestIntro")}</s-paragraph>

            <optimusFetcher.Form method="post">
              <input type="hidden" name="intent" value={OPTIMUS_TEST_INTENT} />
              <input type="hidden" name={LOCALE_PARAM} value={locale} />
              <s-button
                type="submit"
                {...(isSendingOptimusTest ? { loading: true } : {})}
              >
                {t("admin.sendTestRequest")}
              </s-button>
            </optimusFetcher.Form>
          </s-stack>
        </s-section>

        <ResponseViewer content={optimusResponseContent} />

        <s-section heading={t("admin.s3Heading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("admin.s3Intro")}</s-paragraph>

            <s-stack direction="block" gap="small-200">
              {s3Setup.envVars.map((envVar) => (
                <s-text key={envVar.name}>
                  {envVar.isSet ? "✅" : "❌"} {envVar.name}
                </s-text>
              ))}
            </s-stack>

            <ReadOnlyField
              label={t("admin.s3Bucket")}
              value={s3Setup.bucket ?? t("admin.notSet")}
            />
            <ReadOnlyField
              label={t("admin.awsRegion")}
              value={s3Setup.region ?? t("admin.notSet")}
            />
            <ReadOnlyField
              label={t("admin.appFolder")}
              value={s3Setup.appFolderKey || t("admin.bucketRoot")}
            />

            {s3Setup.appFolderConsoleUrl ? (
              <s-link href={s3Setup.appFolderConsoleUrl} target="_blank">
                {t("admin.openAppFolder")}
              </s-link>
            ) : null}

            <s-paragraph>{t("admin.s3TestIntro")}</s-paragraph>

            <s3TestFetcher.Form method="post">
              <input type="hidden" name="intent" value={S3_TEST_INTENT} />
              <input type="hidden" name={LOCALE_PARAM} value={locale} />
              <s-button
                type="submit"
                {...(isStartingS3Test ? { loading: true } : {})}
                {...(!isS3SetupComplete ? { disabled: true } : {})}
              >
                {t("admin.uploadTestFile")}
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
