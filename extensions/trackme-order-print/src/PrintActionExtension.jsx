import "@shopify/ui-extensions/preact";
import { render } from "preact";

// The app's route for the PDF; see app/routes/api.order-actions.label.ts.
const LABEL_PATH = "/api/order-actions/label";

export default async () => {
  render(<Extension />, document.body);
};

/**
 * Print → "TrackMe: label" on an order: Shopify's print preview shows the
 * order's labels only (its Optimus AWBs, or its pickup label). The app marks
 * the order as printed when it serves the PDF, so opening the preview counts
 * as printing.
 */
function Extension() {
  const { i18n, data } = shopify;
  const orderId = data.selected[0]?.id;
  const params = new URLSearchParams({
    orderId,
    // each language file names its own language, for the app's messages
    locale: i18n.translate("locale"),
  });

  return (
    <s-admin-print-action src={orderId ? `${LABEL_PATH}?${params}` : null}>
      <s-stack direction="block" gap="small-200">
        <s-text>{i18n.translate("intro")}</s-text>
        <s-text color="subdued">{i18n.translate("marksPrinted")}</s-text>
      </s-stack>
    </s-admin-print-action>
  );
}
