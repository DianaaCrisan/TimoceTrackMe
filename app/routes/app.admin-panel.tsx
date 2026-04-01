import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

type LoaderData = {
  credentials: {
    apiUrl: string;
    username: string;
    maskedApiKey: string;
  };
};

function maskApiKey(apiKey: string) {
  if (!apiKey) return "Not configured";

  const visibleChars = 4;
  if (apiKey.length <= visibleChars) {
    return "*".repeat(apiKey.length);
  }

  const maskedPart = "*".repeat(apiKey.length - visibleChars);
  const visiblePart = apiKey.slice(-visibleChars);

  return `${maskedPart}${visiblePart}`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const apiUrl = process.env.OPTIMUS_API_URL_TEST ?? "";
  const username = process.env.OPTIMUS_USERNAME_TEST ?? "";
  const apiKey = process.env.OPTIMUS_API_KEY_TEST ?? "";

  return {
    credentials: {
      apiUrl: apiUrl || "Not configured",
      username: username || "Not configured",
      maskedApiKey: maskApiKey(apiKey),
    },
  } satisfies LoaderData;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <s-stack direction="block" gap="xsmall">
      <s-text fontWeight="semibold">{label}</s-text>
      <s-box
        padding="base"
        borderWidth="base"
        borderRadius="base"
        background="subdued"
      >
        <s-text>{value}</s-text>
      </s-box>
    </s-stack>
  );
}

export default function AdminPanelPage() {
  const { credentials } = useLoaderData<typeof loader>();

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
              In the next step, this button will trigger a test request to
              Optimus using test credentials and a mocked payload.
            </s-paragraph>

            <s-stack direction="inline" gap="base">
              <s-button disabled>Send test request</s-button>
            </s-stack>
          </s-stack>
        </s-section>

        <s-section heading="Response output">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {`No request sent yet.
The Optimus response will be displayed here in the next step.`}
            </pre>
          </s-box>
        </s-section>
      </s-stack>
    </s-page>
  );
}
