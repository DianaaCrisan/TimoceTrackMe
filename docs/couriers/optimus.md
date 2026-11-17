# Courier: Optimus (carried by GLS)

How Optimus behaves, as far as the app is concerned. Each courier gets its own
file in `docs/couriers/`, so a later app with more couriers can treat each one
on its own terms.

Optimus is a booking platform. The parcels themselves are carried by GLS.

## Booking an AWB

- The app books AWBs through the Optimus API (`action=new_awb`). See
  `app/backend/optimus/createOptimusTrackingNumber.server.ts`.
- One AWB per parcel. Weight is in kg. See
  [gls-shipping-specification.md](../gls-shipping-specification.md).
- GLS tracking numbers start with `6` and are all digits.
- AWBs can also be booked by hand on the Optimus website, which has more
  settings than the API. The admin then pastes the number into the Shopify
  fulfillment.

## Cancelling an AWB: nothing to call

**Optimus has no cancel call, and none is needed.** An AWB that the courier
never scans is cancelled by Optimus on its own and is not billed. Cancelling
an AWB is therefore only our own bookkeeping:

- in Shopify, the AWB is no longer on an active fulfillment (the fulfillment
  was cancelled, or its tracking number was removed);
- in our AWB report, it moves to the cancelled table, so the month's bill can
  be checked against it.

What follows from this:

- An AWB cancelled on our side **is still billed if the courier scanned it**.
  The app does not check for that yet. The status endpoint (below) could flag
  it.
- An AWB that is booked but never added to Shopify (because the Shopify step
  failed) costs nothing, as long as nobody prints it and hands it to the
  courier.

## Billing

Optimus bills per month for the AWBs the courier scanned. The AWB report lists
the AWBs in the month they were booked, split into used and cancelled, so the
bill can be checked line by line.

## Labels

- `action=get_pdf` returns the label PDF, base64. The app sends no page size;
  Optimus decides it. The app copies those pages into the print file
  unchanged.
- The pages the app draws itself (pickup labels, group headers, totals) are
  150 × 100 mm.

## Status

- `POST /api-status`, on the same host as the API (not `/api` with
  `action=status`). See `app/backend/optimus/optimus-test.server.ts` and the
  developer panel.
- The response has not been mapped to Shopify statuses yet.

## How the app recognises an Optimus AWB in Shopify

- AWBs that TrackMe adds get the tracking company `Optimus`. The API accepts
  any name.
- In the Shopify admin, the shipping carrier is a list, and Optimus is not in
  it. When pasting an AWB by hand, the admin picks **GLS** (checked on the dev
  store, 17.11.2026).
- An AWB counts as Optimus when the tracking company contains `optimus` or
  `gls`, case ignored.
- Any other tracking company, or none, is listed in the report as an
  unrecognised courier, for the admin to check.
