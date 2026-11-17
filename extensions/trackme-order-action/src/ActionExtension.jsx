import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

// The app's routes for this window; see
// app/commons/order-actions/OrderActions.ts. `fetch` resolves them against
// the app's URL and adds an ID token, so the app knows the shop.
const SUMMARY_PATH = "/api/order-actions/summary";
const ADD_TRACKING_PATH = "/api/order-actions/add-tracking";

export default async () => {
  render(<Extension />, document.body);
};

/**
 * "More actions" → "TrackMe: add tracking" on an order. Shows what add
 * tracking would do (units to ship, customer note, weight), then adds
 * tracking to this one order and shows its AWBs or the error.
 */
function Extension() {
  const { i18n, close, data } = shopify;
  const orderId = data.selected[0]?.id;
  // each language file names its own language, for the app's messages
  const locale = i18n.translate("locale");

  const [summary, setSummary] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ orderId, locale });
    fetch(`${SUMMARY_PATH}?${params}`)
      .then(readJson)
      .then((response) =>
        response.ok ? setSummary(response.summary) : setLoadError(response.error),
      )
      .catch((error) => setLoadError(String(error)));
  }, [orderId, locale]);

  async function addTracking() {
    setIsAdding(true);
    try {
      const response = await fetch(ADD_TRACKING_PATH, {
        method: "POST",
        body: new URLSearchParams({ orderId, locale }),
      }).then(readJson);
      setResult(response);
    } catch (error) {
      setResult({ ok: false, error: String(error) });
    } finally {
      setIsAdding(false);
    }
  }

  const isDone = result?.ok === true;
  const canAdd =
    summary &&
    !result?.ok &&
    !summary.isCancelled &&
    !summary.isBusy &&
    summary.unitsToShip > 0;

  return (
    <s-admin-action loading={!summary && !loadError}>
      <s-stack direction="block" gap="base">
        {loadError ? <s-banner tone="critical">{loadError}</s-banner> : null}
        {summary ? <Summary summary={summary} i18n={i18n} /> : null}
        {result ? <Result result={result} i18n={i18n} /> : null}
      </s-stack>

      {isDone ? (
        <s-button slot="primary-action" onClick={() => close()}>
          {i18n.translate("done")}
        </s-button>
      ) : (
        <s-button
          slot="primary-action"
          variant="primary"
          disabled={!canAdd || isAdding}
          loading={isAdding}
          onClick={addTracking}
        >
          {i18n.translate("addTracking")}
        </s-button>
      )}
      <s-button slot="secondary-actions" onClick={() => close()}>
        {i18n.translate("close")}
      </s-button>
    </s-admin-action>
  );
}

function Summary({ summary, i18n }) {
  if (summary.isCancelled) {
    return <s-banner tone="critical">{i18n.translate("cancelled")}</s-banner>;
  }
  if (summary.isBusy) {
    return <s-banner tone="warning">{i18n.translate("busy")}</s-banner>;
  }

  return (
    <s-stack direction="block" gap="small-200">
      {summary.unitsToShip > 0 ? (
        <>
          <s-text>
            {i18n.translate("unitsToShip", { count: summary.unitsToShip })}
          </s-text>
          {summary.weightKg !== null ? (
            <s-text>
              {i18n.translate("weight", {
                weight: i18n.formatNumber(summary.weightKg, {
                  maximumFractionDigits: 2,
                }),
              })}
            </s-text>
          ) : null}
        </>
      ) : (
        <s-banner tone="info">
          {i18n.translate(summary.isPickup ? "pickup" : "nothingToShip")}
        </s-banner>
      )}

      {summary.shipsOverWeightLimit && summary.unitsToShip > 0 ? (
        <s-banner tone="warning">
          {i18n.translate("overWeightLimit", {
            limit: i18n.formatNumber(summary.parcelWeightLimitKg ?? 0),
          })}
        </s-banner>
      ) : null}

      {summary.note || summary.attributes.length > 0 ? (
        <s-banner tone="info" heading={i18n.translate("customerNote")}>
          <s-stack direction="block" gap="small-300">
            {summary.note ? <s-text>{summary.note}</s-text> : null}
            {summary.attributes.map((attribute) => (
              <s-text key={attribute.key}>
                {attribute.key}: {attribute.value}
              </s-text>
            ))}
          </s-stack>
        </s-banner>
      ) : null}

      {summary.existingAwbs.length > 0 ? (
        <s-text color="subdued">
          {i18n.translate("existingAwbs", {
            awbs: summary.existingAwbs.join(", "),
          })}
        </s-text>
      ) : null}
    </s-stack>
  );
}

function Result({ result, i18n }) {
  if (!result.ok) {
    return (
      <s-banner tone="critical" heading={i18n.translate("failed")}>
        <s-stack direction="block" gap="small-300">
          <s-text>{result.error}</s-text>
          {result.isZipProblem ? (
            <s-text>{i18n.translate("fixZip")}</s-text>
          ) : null}
        </s-stack>
      </s-banner>
    );
  }

  return (
    <s-banner tone="success" heading={i18n.translate("added")}>
      <s-stack direction="block" gap="small-300">
        <s-text type="strong">{result.trackingNumbers.join(", ")}</s-text>
        {result.notices.map((notice) => (
          <s-text key={notice}>{notice}</s-text>
        ))}
        <s-text>{i18n.translate("nextSteps")}</s-text>
      </s-stack>
    </s-banner>
  );
}

/** The app always answers JSON; anything else is shown as the error. */
async function readJson(response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return { ok: false, error: `HTTP ${response.status}` };
}
