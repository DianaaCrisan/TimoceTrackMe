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
  getEmailJobSetupStatus,
  startTestEmailJob,
} from "../backend/jobs/emailJobSetup.server";
import { ReadOnlyField } from "app/frontend/core/components/ReadOnlyField";
import { ResponseViewer } from "app/frontend/core/components/ResponseViewer";

const OPTIMUS_TEST_INTENT = "optimusTest";
const EMAIL_JOB_TEST_INTENT = "emailJobTest";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    credentials: getOptimusTestCredentialsForDisplay(),
    emailJobSetup: getEmailJobSetupStatus(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === EMAIL_JOB_TEST_INTENT) {
    try {
      const result = startTestEmailJob();

      return {
        intent,
        ok: result.isStarted,
        data: result.isStarted
          ? {
              message: `Test job started. Check ${result.recipient} in a minute. If no email arrives, check the server logs for "AppError[EmailJob:test]".`,
            }
          : { message: "A test job is already running." },
      };
    } catch (error) {
      return {
        intent,
        ok: false,
        data: {
          message:
            error instanceof Error ? error.message : "Unknown test job error.",
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
  const { credentials, emailJobSetup } = useLoaderData<typeof loader>();
  const optimusFetcher = useFetcher<typeof action>();
  const emailJobFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSendingOptimusTest = optimusFetcher.state !== "idle";
  const isStartingEmailJobTest = emailJobFetcher.state !== "idle";
  const isEmailJobSetupComplete = emailJobSetup.envVars.every(
    (envVar) => envVar.isSet,
  );

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
    if (!emailJobFetcher.data) return;

    shopify.toast.show(
      emailJobFetcher.data.ok ? "Test job started" : "Test job could not start",
    );
  }, [emailJobFetcher.data, shopify]);

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

        <s-section heading="Bulk jobs: S3 and email setup">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Bulk actions upload their result to S3 and email a download link.
              Every variable below must be set for them to work.
            </s-paragraph>

            <s-stack direction="block" gap="small-200">
              {emailJobSetup.envVars.map((envVar) => (
                <s-text key={envVar.name}>
                  {envVar.isSet ? "✅" : "❌"} {envVar.name}
                </s-text>
              ))}
            </s-stack>

            <ReadOnlyField
              label="AWS region"
              value={emailJobSetup.region ?? "(not set)"}
            />
            <ReadOnlyField
              label="S3 bucket"
              value={emailJobSetup.bucket ?? "(not set)"}
            />
            <ReadOnlyField
              label="Results are emailed to"
              value={emailJobSetup.recipient ?? "(not set)"}
            />

            <s-paragraph>
              The test uploads a small text file and emails its download link.
            </s-paragraph>

            <emailJobFetcher.Form method="post">
              <input
                type="hidden"
                name="intent"
                value={EMAIL_JOB_TEST_INTENT}
              />
              <s-button
                type="submit"
                {...(isStartingEmailJobTest ? { loading: true } : {})}
                {...(!isEmailJobSetupComplete ? { disabled: true } : {})}
              >
                Send test job email
              </s-button>
            </emailJobFetcher.Form>

            {emailJobFetcher.data && "message" in emailJobFetcher.data.data ? (
              <s-text>{emailJobFetcher.data.data.message}</s-text>
            ) : null}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
