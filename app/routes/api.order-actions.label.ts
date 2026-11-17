import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { OrderActions } from "app/backend/order-actions/OrderActions.server";
import { readOrderActionParams } from "app/backend/order-actions/readOrderActionParams";
import { createTranslator } from "app/commons/i18n/translate";

/**
 * The document behind the order page's Print → "TrackMe: label": a PDF with
 * the order's labels only, and the order marked as printed. Shopify loads it
 * into its print preview, so opening the preview counts as printing.
 *
 * When there is nothing to print, a short HTML page says why: Shopify's
 * preview shows HTML too.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, cors } = await authenticate.admin(request);
  const url = new URL(request.url);
  const { orderId, locale } = readOrderActionParams((name) =>
    url.searchParams.get(name),
  );
  const t = createTranslator(locale);

  if (!orderId) {
    return cors(htmlPage(t("orderAction.invalidOrder"), [], 400));
  }

  try {
    const { pdf, errors } = await OrderActions.buildLabel(
      admin,
      ShopifyUtils.getShopAdminUrl(session.shop),
      orderId,
      locale,
    );
    if (!pdf) {
      return cors(htmlPage(t("orderAction.noLabel"), errors, 200));
    }
    return cors(
      new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline",
          "Cache-Control": "no-store",
        },
      }),
    );
  } catch (error) {
    console.error(`AppError[OrderActions] label for ${orderId} failed.`, error);
    return cors(
      htmlPage(
        t("orderAction.failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        [],
        500,
      ),
    );
  }
};

function htmlPage(title: string, details: string[], status: number): Response {
  const escape = (text: string) =>
    text.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]!,
    );
  const body = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px;color:#303030}
p{margin:0 0 8px}.d{color:#616161;font-size:13px}</style></head><body>
<p><strong>${escape(title)}</strong></p>
${details.map((line) => `<p class="d">${escape(line)}</p>`).join("")}
</body></html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
