import {
  OPTIMUS_API_URL,
  OPTIMUS_USERNAME,
  OPTIMUS_API_KEY,
} from "./optimus.constants.server";

type PdfData = {
  pdfBuffer: Buffer;
};

/**
 * @property {number} error if 0, it means the request is successful
 */
type OptimusResponse = {
  error: number;
  error_message?: string;
  pdf_data?: string;
};

export async function getOptimusLabelPDF(
  trackingNumber: string,
): Promise<PdfData> {
  if (!OPTIMUS_API_URL || !OPTIMUS_USERNAME || !OPTIMUS_API_KEY) {
    throw new Error("Invalid optimus credentials.");
  }

  let response;
  try {
    response = await fetch(OPTIMUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: OPTIMUS_USERNAME,
        api_key: OPTIMUS_API_KEY,
        action: "get_pdf",
        id: String(trackingNumber),
      }),
    });
  } catch (error) {
    throw new Error(`Failed to fetch PDF response via Optimus: ${error}`);
  }

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Optimus responded with HTTP ${response.status} for trackingNumber ${trackingNumber}. Response ${raw.slice(0, 2000)}`,
    );
  }

  let optimusResponse: OptimusResponse;
  try {
    optimusResponse = JSON.parse(raw) as OptimusResponse;
  } catch (error) {
    throw new Error(
      `Failed to parse Optimus response JSON for trackingNumber ${trackingNumber}. Response ${raw.slice(0, 2000)}. Error: ${error}`,
    );
  }

  if (optimusResponse.error !== 0 || !optimusResponse.pdf_data) {
    throw new Error(
      `Failed to generate PDF via Optimus for label ID ${trackingNumber}. Response: ${raw.slice(0, 1000)}`,
    );
  }

  try {
    const pdfBuffer = Buffer.from(optimusResponse.pdf_data, "base64");
    return { pdfBuffer };
  } catch (error) {
    throw new Error(
      `Failed to decode PDF data from Optimus for trackingNumber ${trackingNumber}. Error: ${error}`,
    );
  }
}
