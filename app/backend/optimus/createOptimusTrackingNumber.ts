import {
  OPTIMUS_API_KEY,
  OPTIMUS_API_URL,
  OPTIMUS_USERNAME,
} from "./optimus.constants.server";

type NewAWBOptimusRequest = {
  username: string;
  api_key: string;
  action: string;
  destinatar_nume: string;
  destinatar_adresa: string;
  destinatar_localitate: string;
  destinatar_judet: string;
  destinatar_cod_postal: string;
  destinatar_contact: string;
  destinatar_telefon: string;
  colet_buc: string;
  colet_greutate: string;
  data_colectare: string;
  ramburs_valoare: string;
  ref_factura: string;
  colet_descriere: string;
  destinatar_email: string;
};

/**
 * @property {string} email NOTE: - Email not mandatory, proven by tests
 * @property {string} formatted A formatted version of the address, customized by the provided arguments.
 */
type NewAWBRequest = {
  orderName: string;
  email?: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
  address: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  invoiceDetails?: string;
  weight: string;
  formatted: string; // TODO: - check if we need this
};

type NewAWBResponse = {
  labelId: string;
  trackingNumber: string;
};

/**
 * @property { string } pcl array of tracking numbers
 * NOTE: no uses cases yet in which this array would contain more than 1 item
 *
 * @property { string } id tracking label identifier, based on which the PDF is created
 * @property {number} error if 0, then the request is successful
 */
type NewAWBOptimusResponse = {
  id?: number;
  pcl?: string[];
  error: number;
  error_message?: string;
};

export async function createOptimusTrackingNumber(
  shippingDetails: NewAWBRequest,
): Promise<NewAWBResponse> {
  if (!OPTIMUS_API_URL || !OPTIMUS_USERNAME || !OPTIMUS_API_KEY) {
    throw new Error(
      `Invalid optimus credentials. API_URL: ${OPTIMUS_API_URL}, USERNAME: ${OPTIMUS_USERNAME}, API_KEY: ${OPTIMUS_API_KEY}.`,
    );
  }

  const optimusPayload: NewAWBOptimusRequest = {
    username: OPTIMUS_USERNAME,
    api_key: OPTIMUS_API_KEY,
    action: "new_awb",
    destinatar_nume: shippingDetails.name,
    destinatar_adresa: shippingDetails.address,
    destinatar_localitate: shippingDetails.city,
    destinatar_judet: shippingDetails.province,
    destinatar_cod_postal: shippingDetails.zip,
    destinatar_contact: shippingDetails.name,
    destinatar_telefon: shippingDetails.phoneNumber,
    colet_buc: "1",
    colet_greutate: shippingDetails.weight,
    data_colectare: new Date().toISOString().split("T")[0].toString(),
    ramburs_valoare: "0",
    ref_factura: shippingDetails.invoiceDetails ?? "",
    colet_descriere: `fructe (${shippingDetails.orderName})`,
    destinatar_email: shippingDetails.email ?? "",
  };

  let rawText = "";
  let status = 0;

  try {
    const res = await fetch(OPTIMUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(optimusPayload),
    });

    status = res.status;
    rawText = await res.text();

    if (!res.ok) {
      throw new Error(
        `Optimus responded with HTTP ${status} for order ${shippingDetails.orderName}. Body: ${rawText}. Status: ${status}. Payload: ${optimusPayload}`,
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to fetch new AWB response via Optimus for order ${shippingDetails.orderName}: ${error}`,
    );
  }

  const parsed = parseOptimusBody(rawText);
  const optimusResponse = normalizeOptimusResponse(parsed);

  if (optimusResponse.error !== 0 || optimusResponse.error_message) {
    throw new Error(
      `Failed to generate tracking number via Optimus for order ${shippingDetails.orderName}: ${optimusResponse.error_message}`,
    );
  }

  if (
    !optimusResponse.id ||
    !optimusResponse.pcl ||
    optimusResponse.pcl.length < 1
  ) {
    throw new Error(
      `Optimus response missing tracking number or ID for order ${shippingDetails.orderName}. Payload: ${optimusPayload}. Response: ${optimusResponse}`,
    );
  }

  if (optimusResponse.pcl.length > 1) {
    throw new Error(
      `Generating tracking number via Optimus returned multiple numbers for order ${shippingDetails.orderName}. Payload: ${optimusPayload}. Response: ${optimusResponse}`,
    );
  }

  return {
    labelId: optimusResponse.id.toString(),
    trackingNumber: optimusResponse.pcl[0].toString(),
  };
}

/** Try JSON first, then urlencoded (key=value&…), else return null to signal failure */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOptimusBody(raw: string): any | null {
  const trimmed = raw.trim();

  // JSON?
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }

  // URL-encoded?
  if (/^[\w.-]+=\S/.test(trimmed)) {
    const params = new URLSearchParams(trimmed);
    const obj: Record<string, string> = {};
    for (const [k, v] of params) obj[k] = v;
    return obj;
  }

  // Could be HTML or plain text error page
  return null;
}

/** Coerce loose shapes/strings into the expected structure */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOptimusResponse(src: any | null): NewAWBOptimusResponse {
  if (!src) {
    // Nothing we can parse — make a sentinel that will trip error handling above
    return { error: 1, error_message: "Non-parseable response from Optimus" };
  }

  const errorNum =
    typeof src.error === "string"
      ? Number(src.error)
      : typeof src.error === "number"
        ? src.error
        : 1;

  // pcl may be array or comma/space-separated string
  let pcl: string[] | undefined;
  if (Array.isArray(src.pcl)) {
    pcl = src.pcl.map(String);
  } else if (typeof src.pcl === "string") {
    pcl = src.pcl.split(/[,\s]+/).filter(Boolean);
  }

  const idVal =
    typeof src.id === "string"
      ? src.id
      : typeof src.id === "number"
        ? src.id
        : undefined;

  return {
    id: idVal,
    pcl,
    error: isNaN(errorNum) ? 1 : errorNum,
    error_message:
      typeof src.error_message === "string" ? src.error_message : undefined,
  };
}
