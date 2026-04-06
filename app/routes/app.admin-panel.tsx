import { useEffect, useMemo } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getOptimusTestCredentialsForDisplay,
  sendOptimusConnectionTest,
} from "../backend/optimus/optimus-test.server";
import { ReadOnlyField } from "app/frontend/core/components/ReadOnlyField";
import { ResponseViewer } from "app/frontend/core/components/ResponseViewer";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    credentials: getOptimusTestCredentialsForDisplay(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const result = await sendOptimusConnectionTest();

    return {
      ok: result.ok,
      data: result,
    };
  } catch (error) {
    return {
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
  const { credentials } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSubmitting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const responseContent = useMemo(() => {
    if (!fetcher.data) {
      return `No request sent yet.

The Optimus response will be displayed here after you send a test request.`;
    }

    return JSON.stringify(fetcher.data.data, null, 2);
  }, [fetcher.data]);

  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.ok) {
      shopify.toast.show("Optimus test request completed");
      return;
    }

    shopify.toast.show("Optimus test request failed");
  }, [fetcher.data, shopify]);

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

            <fetcher.Form method="post">
              <s-button
                type="submit"
                {...(isSubmitting ? { loading: true } : {})}
              >
                Send test request
              </s-button>
            </fetcher.Form>
          </s-stack>
        </s-section>

        <ResponseViewer content={responseContent} />
      </s-stack>
    </s-page>
  );
}
