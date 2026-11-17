# TrackMe on the Shopify order page: plan

Status: built, not yet tried on the dev store. See [To verify](#to-verify).

The Orders page now only lists orders in no pack. For one order, TrackMe works
from the Shopify order page instead: Shopify's search finds the order, and
every exception in the tutorials already starts there.

Order details page only, for now. The order list (several orders at once) can
come later with the same backend.

## What the admin sees

### 1. "More actions" → **TrackMe: adaugă tracking** (action extension)

Target `admin.order-details.action.render`. A small window:

- **What will happen.** The items still to ship, the parcels they go in
  (with weight, and the split if it's over the limit), and the ZIP code.
- **The checks add tracking already does.** Customer note, over the weight
  limit, missing ZIP (solved automatically).
- **Button "Adaugă tracking".** Runs add tracking for this order only, while
  the window is open (not as a background job).
- **The result.** The AWBs, or the error. A ZIP problem shows the address and
  says to fix it in Shopify.
- **Nothing to ship** (already fulfilled, cancelled, pickup): it says so and
  points to Print.

### 2. "Print" → **TrackMe: etichetă** (print extension)

Target `admin.order-details.print-action.render`. Shopify shows the PDF in its
print preview:

- Delivery: the order's Optimus labels, one per active fulfillment with an
  AWB.
- Pickup: the pickup label.
- Only this order's labels: no group header or totals pages.

**Marking as printed.** Serving the PDF marks the order as printed, the same
as Print labels:

- the `eticheta-printata` tag;
- the fulfillment event;
- the AWB report's print count.

Shopify gives no signal for the Print button itself, so **opening the preview
counts as printing**.

## Decisions

| Topic | Decision |
| --- | --- |
| Where | Order details page only. |
| Language | The extensions follow the admin's Shopify language (their own `locales/en.default.json`, `ro.json`). |
| Pack rule | Jobs run only from a pack; these buttons are the exception, for one order opened on purpose. |
| Double booking | Add tracking takes the same in-memory order lock as the jobs, so it refuses while that order is in a running job. |
| Backend | New routes under `/api/order-actions/…`, authenticated with `authenticate.admin` (Shopify adds the ID token to the extension's `fetch`), answered through its `cors` helper. |
| Reuse | `addTrackingNumbers` and `buildPrintLabels` as they are. Print gets an option to leave out the summary pages. |

## Built

- `extensions/trackme-order-action` (`ActionExtension.jsx`) and
  `extensions/trackme-order-print` (`PrintActionExtension.jsx`), each with
  `locales/en.default.json` and `ro.json`. Each language file also carries
  its own code (`"locale": "ro"`): the extension API doesn't expose the
  admin's language, and the app's messages need it.
- Routes `api.order-actions.summary.ts`, `api.order-actions.add-tracking.ts`,
  `api.order-actions.label.ts`; logic in `app/backend/order-actions/`.
- Add tracking's own error texts (from `addTrackingNumbers`) stay in English,
  as in the job reports.
- When an order has nothing to print, the label route answers a short HTML
  page that says why; Shopify's preview shows it.

## Steps (done)

1. Backend:
   - `GET /api/order-actions/summary?orderId=`: what add tracking would do,
     and its checks.
   - `POST /api/order-actions/add-tracking`: runs it, and returns the AWBs or
     errors.
   - `GET /api/order-actions/label?orderId=`: the PDF, and marks the order
     as printed.
2. `buildPrintLabels`: an option to print without the group header and totals
   pages.
3. Action extension UI, EN and RO.
4. Print extension UI, EN and RO.
5. Tests for the routes' logic (pure parts) and the print option.
6. Tutorials: the extra-label and Optimus-website cases use the order page
   buttons instead of going back to TrackMe.

Step 6 (tutorials) waits until the extensions are tried.

## To verify

1. "More actions" lists "TrackMe: adaugă tracking"; the window loads the
   summary (no CORS or 401 error).
2. Add tracking from the window makes the AWB, and the order shows the
   fulfillment after a reload.
3. "Print" lists "TrackMe: etichetă"; the preview shows the label PDF, and
   the order gets the `eticheta-printata` tag.
4. A pickup order prints its pickup label; an order without an AWB shows the
   "no label" page.

## You run

`shopify app dev`, then open an order on the dev store. Release with
`shopify app deploy`.
