import {
  OPTIMUS_API_KEY_TEST,
  OPTIMUS_API_URL_TEST,
  OPTIMUS_USERNAME_TEST,
} from "./optimus.constants.server";
import { OptimusConnectionTestRequest } from "./types/OptimusConnectionTestRequest";
import { OptimusConnectionTestResult } from "./types/OptimusConnectionTestResult";
import { OptimusCredentialsDisplay } from "./types/OptimusCredentialsDisplay";

export function getOptimusTestCredentialsForDisplay(): OptimusCredentialsDisplay {
  return {
    apiUrl: OPTIMUS_API_URL_TEST || "Not configured",
    username: OPTIMUS_USERNAME_TEST || "Not configured",
    maskedApiKey: OPTIMUS_API_KEY_TEST
      ? maskApiKey(OPTIMUS_API_KEY_TEST)
      : "Not configured",
  };
}

export async function sendOptimusConnectionTest(): Promise<OptimusConnectionTestResult> {
  const { apiUrl } = getOptimusTestCredentials();
  const payload = buildMockConnectionPayload();

  let status = 0;
  let rawBody = "";
  let parsedBody: unknown = null;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload),
    });

    status = response.status;
    rawBody = await response.text();
    parsedBody = parseOptimusBody(rawBody);

    return {
      ok: response.ok,
      request: {
        endpoint: apiUrl,
        payload: {
          ...payload,
          api_key: maskApiKey(payload.api_key),
        },
      },
      response: {
        status,
        rawBody,
        parsedBody,
      },
    };
  } catch (error) {
    return {
      ok: false,
      request: {
        endpoint: apiUrl,
        payload: {
          ...payload,
          api_key: maskApiKey(payload.api_key),
        },
      },
      response: {
        status,
        rawBody: String(error),
        parsedBody: null,
      },
    };
  }
}

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

function getOptimusTestCredentials() {
  if (
    !OPTIMUS_API_URL_TEST ||
    !OPTIMUS_USERNAME_TEST ||
    !OPTIMUS_API_KEY_TEST
  ) {
    throw new Error(
      "Missing Optimus test credentials in environment variables.",
    );
  }

  return {
    apiUrl: OPTIMUS_API_URL_TEST,
    username: OPTIMUS_USERNAME_TEST,
    apiKey: OPTIMUS_API_KEY_TEST,
  };
}

/** Try JSON first, then urlencoded, else return null */
function parseOptimusBody(raw: string): unknown | null {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // ignore and continue
    }
  }

  if (/^[\w.-]+=\S/.test(trimmed)) {
    const params = new URLSearchParams(trimmed);
    const obj: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      obj[key] = value;
    }

    return obj;
  }

  return null;
}

function buildMockConnectionPayload(): OptimusConnectionTestRequest {
  return {
    username: OPTIMUS_USERNAME_TEST || "",
    api_key: OPTIMUS_API_KEY_TEST || "",
    action: "new_awb",
    destinatar_nume: "Test Client",
    destinatar_adresa: "Strada Test 10",
    destinatar_localitate: "Bucuresti",
    destinatar_judet: "Bucuresti",
    destinatar_cod_postal: "010101",
    destinatar_contact: "Test Client",
    destinatar_telefon: "0712345678",
    colet_buc: "1",
    colet_greutate: "1",
    data_colectare: new Date().toISOString().split("T")[0] ?? "",
    ramburs_valoare: "0",
    ref_factura: "TEST-ADMIN-PANEL",
    colet_descriere: "Mock request from Shopify Admin Panel",
    destinatar_email: "test@example.com",
  };
}
