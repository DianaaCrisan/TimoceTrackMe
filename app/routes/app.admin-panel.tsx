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

const OPTIMUS_TEST_INTENT = "optimusTest";
const S3_TEST_INTENT = "s3Test";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    credentials: getOptimusTestCredentialsForDisplay(),
    s3Setup: getS3SetupStatus(),
    recentJobs: getRecentJobsSnapshot(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === S3_TEST_INTENT) {
    try {
      const result = startTestJob();

      return {
        intent,
        ok: result.isStarted,
        data: {
          message: result.isStarted
            ? "Test upload started. Press Refresh under Recent jobs in a few seconds."
            : "A test upload is already running.",
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
              : "Unknown test upload error.",
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
            : "Unknown Optimus test error.",
      },
    };
  }
};

export default function AdminPanelPage() {
  const { credentials, s3Setup, recentJobs } = useLoaderData<typeof loader>();
  const optimusFetcher = useFetcher<typeof action>();
  const s3TestFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSendingOptimusTest = optimusFetcher.state !== "idle";
  const isStartingS3Test = s3TestFetcher.state !== "idle";
  const isS3SetupComplete = s3Setup.envVars.every((envVar) => envVar.isSet);

  const optimusResponseContent = useMemo(() => {
    if (!optimusFetcher.data) {
      return `No request sent yet.

The Optimus response will be displayed here after you send a test request.`;
    }

    return JSON.stringify(optimusFetcher.data.data, null, 2);
  }, [optimusFetcher.data]);

  useEffect(() => {
    if (!optimusFetcher.data) return;

    shopify.toast.show(
      optimusFetcher.data.ok
        ? "Optimus test request completed"
        : "Optimus test request failed",
    );
  }, [optimusFetcher.data, shopify]);

  useEffect(() => {
    if (!s3TestFetcher.data) return;

    shopify.toast.show(
      s3TestFetcher.data.ok
        ? "Test upload started"
        : "Test upload could not start",
    );
  }, [s3TestFetcher.data, shopify]);

  return (
    <s-page heading="Admin Panel">
      <s-stack direction="block" gap="large">
        <s-section heading="Optimus test credentials">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              These values are loaded from environment variables. The API key is
              masked for safety.
            </s-paragraph>

            <ReadOnlyField label="API URL" value={credentials.apiUrl} />
            <ReadOnlyField label="Username" value={credentials.username} />
            <ReadOnlyField label="API Key" value={credentials.maskedApiKey} />
          </s-stack>
        </s-section>

        <s-section heading="Test request">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              This sends a server-side test request to Optimus using test
              credentials and a mocked AWB-style payload.
            </s-paragraph>

            <optimusFetcher.Form method="post">
              <input type="hidden" name="intent" value={OPTIMUS_TEST_INTENT} />
              <s-button
                type="submit"
                {...(isSendingOptimusTest ? { loading: true } : {})}
              >
                Send test request
              </s-button>
            </optimusFetcher.Form>
          </s-stack>
        </s-section>

        <ResponseViewer content={optimusResponseContent} />

        <s-section heading="Bulk jobs: S3 setup">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Bulk actions store their result files in S3. Every variable below
              must be set for them to work.
            </s-paragraph>

            <s-stack direction="block" gap="small-200">
              {s3Setup.envVars.map((envVar) => (
                <s-text key={envVar.name}>
                  {envVar.isSet ? "✅" : "❌"} {envVar.name}
                </s-text>
              ))}
            </s-stack>

            <ReadOnlyField
              label="S3 bucket"
              value={s3Setup.bucket ?? "(not set)"}
            />
            <ReadOnlyField
              label="AWS region"
              value={s3Setup.region ?? "(not set)"}
            />
            <ReadOnlyField
              label="This app's folder in the bucket"
              value={s3Setup.appFolderKey || "(bucket root)"}
            />

            {s3Setup.appFolderConsoleUrl ? (
              <s-link href={s3Setup.appFolderConsoleUrl} target="_blank">
                Open this app&apos;s folder in the S3 console
              </s-link>
            ) : null}

            <s-paragraph>
              The test uploads a small text file. It then appears under Recent
              jobs with a link to it in S3.
            </s-paragraph>

            <s3TestFetcher.Form method="post">
              <input type="hidden" name="intent" value={S3_TEST_INTENT} />
              <s-button
                type="submit"
                {...(isStartingS3Test ? { loading: true } : {})}
                {...(!isS3SetupComplete ? { disabled: true } : {})}
              >
                Upload test file
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
