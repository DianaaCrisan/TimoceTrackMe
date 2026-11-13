import { readRequiredEnv } from "../core/utils/readRequiredEnv";

/**
 * ZeptoMail keeps accounts per data centre and an API key only works against
 * its own one. Tropical's account is on the EU one; set `ZEPTOMAIL_API_URL`
 * if Timoce's account lives elsewhere (e.g. https://api.zeptomail.com/v1.1/email).
 */
const DEFAULT_ZEPTOMAIL_API_URL = "https://api.zeptomail.eu/v1.1/email";

const SENDER_COMPANY_NAME = "Timoce";

export type SendEmailInput = {
  to: string[];
  subject: string;
  htmlBody: string;
};

export async function sendEmailViaZeptoMail({
  to,
  subject,
  htmlBody,
}: SendEmailInput): Promise<void> {
  const apiKey = readRequiredEnv("ZEPTOMAIL_API_KEY");
  const sender = readRequiredEnv("ZEPTOMAIL_SENDER");
  const apiUrl = process.env.ZEPTOMAIL_API_URL || DEFAULT_ZEPTOMAIL_API_URL;
  const appName = process.env.APP_NAME || "TrackMe";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      // the key is stored with its "Zoho-enczapikey " prefix, as ZeptoMail shows it
      Authorization: apiKey,
    },
    body: JSON.stringify({
      from: { address: sender, name: `${SENDER_COMPANY_NAME} - ${appName}` },
      to: to.map((address) => ({
        email_address: { address, name: address.split("@")[0] },
      })),
      subject,
      htmlbody: htmlBody,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `ZeptoMail responded with HTTP ${response.status}: ${errorBody.slice(0, 1000)}`,
    );
  }
}
