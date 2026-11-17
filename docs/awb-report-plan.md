# AWB report: used and cancelled AWBs

Status: built. Waiting on the checks under [To verify](#to-verify).

The current report trusts what TrackMe recorded at the moment it booked an AWB.
After that, it doesn't notice anything that happens in Shopify:

- a cancelled fulfillment, or a removed tracking number, still shows as used;
- AWBs booked on the Optimus website and pasted into Shopify by hand are
  missing.

The fix is to take the status of each AWB from Shopify.

Optimus specifics, including why cancelling needs no API call:
[couriers/optimus.md](couriers/optimus.md).

## The rule

> **An AWB is used while it is on an active Shopify fulfillment. Otherwise it is
> cancelled.**

Every time an order's fulfillments change, the app works the status out
again. This means one rule covers every flow below, and an AWB can go from
cancelled back to used. The one exception is AWBs added by hand on the report
page (see below): they keep the status they were given.

**Which month an AWB belongs to:** the month it was **issued**, and it stays
there whatever happens to it later.

- For an AWB that TrackMe booked, issued means when Optimus returned it.
- For an AWB found on a Shopify fulfillment (pasted by hand, or from before
  the report existed), issued means when that fulfillment was created.
- For an AWB added by hand on the report page, the day typed in.

## The flows

| What the admin does | What the report shows |
| --- | --- |
| Adds tracking with TrackMe | Used, source TrackMe |
| Books on the Optimus website, then fulfills in Shopify with that number and courier GLS (Shopify's list has no Optimus) | Used, source Shopify |
| Same, but the courier is left empty or set to something else | **Unrecognised courier** table |
| Cancels the fulfillment, or removes its tracking number | Cancelled |
| Delivers the order ourselves: keeps the order fulfilled, uses **Edit tracking**, deletes the number, and doesn't notify the customer | Cancelled (tracking removed) |
| Big order that needs one more label (see below) | Old AWB: used. New AWB: used |
| TrackMe books the AWB, but adding it to Shopify fails | Cancelled (never on Shopify) |

The steps for a big order that needs one more label:

1. Copy the order's AWB.
2. Cancel the fulfillment. The AWB is briefly cancelled.
3. Split the order and fulfill one part with the copied AWB. The AWB is used
   again.
4. Add tracking to the other part with TrackMe.

The AWB keeps its original month throughout.

## Data

The first `ShippingLabel` migration was already applied on the dev database,
so `20261117120000_shipping_label_status` changes the table and keeps its
rows: each one becomes a TrackMe AWB, used if it reached Shopify, otherwise
cancelled (never on Shopify). One table, with the status as a column:

| Column | |
| --- | --- |
| `trackingNumber` | key |
| `source` | `TRACKME`, `SHOPIFY` (found on a fulfillment) or `IMPORT` (added by hand on the report page) |
| `courier` | `OPTIMUS` or `UNKNOWN` |
| `trackingCompany` | the courier as typed in Shopify |
| `orderId`, `orderName`, `orderCreatedAt` | |
| `fulfillmentId` | the fulfillment it is on, or was last on |
| `status` | `USED` or `CANCELLED` |
| `cancelReason` | `FULFILLMENT_CANCELLED`, `TRACKING_REMOVED`, `NEVER_ON_SHOPIFY` or `SET_BY_HAND` |
| `issuedAt` | the month key, indexed |
| `cancelledAt` | |
| `weightKg`, `parcelPosition` | TrackMe only |
| `note` | for AWBs added by hand |
| print columns | as before |

`AwbReportSync` keeps, per month, when the report last read it from Shopify.

This replaces `addedToShopifyAt` and the "Not on Shopify" flag. Those become
`CANCELLED` / `NEVER_ON_SHOPIFY`.

## Keeping it in step with Shopify

1. **Webhooks** `fulfillments/create` and `fulfillments/update`:
   - The handler reads the order's fulfillments again over GraphQL, rather
     than relying on the payload, and reconciles that order's AWBs.
   - It returns 500 when the database write fails, so Shopify retries, the
     same pattern as `orders/create`.
   - The existing `write_fulfillments` scope covers these topics.
2. **"Refresh from Shopify" button** on the report:
   - It reconciles every order updated since the start of the chosen month.
   - It covers webhooks that were missed.
   - It also **backfills** AWBs from before the deploy. For old TrackMe AWBs,
     the fulfillment date stands in for the booking date.
   - The page shows when the last refresh ran.
3. **Add tracking** still records the AWB the moment Optimus returns it,
   before Shopify. Once the fulfillment exists, it links the AWB to it.

The reconcile step is one pure function: it takes the AWBs known for the
order and the order's fulfillments, and returns the changes. Every flow in
the table above becomes a unit test of that function.

How reconcile handles each AWB:

- **The AWB is on an active fulfillment:** used. The app sets
  `fulfillmentId` and clears the cancel fields.
- **The AWB is known for this order but isn't on any active fulfillment:**
  cancelled. The reason depends on the fulfillment it was linked to:
  - that fulfillment was cancelled: `FULFILLMENT_CANCELLED`;
  - that fulfillment is still active but no longer has this number:
    `TRACKING_REMOVED`;
  - it was never linked to a fulfillment: `NEVER_ON_SHOPIFY`.
- **A number on an active fulfillment that isn't known yet:** a new `SHOPIFY`
  row. Its courier is recognised from the tracking company.
- **A number only on a cancelled fulfillment that isn't known yet:** a new
  `SHOPIFY` row, cancelled. This is how the refresh finds AWBs cancelled
  before the report existed.
- **Rows added by hand (`IMPORT`):** never changed.

The code: `reconcileOrderLabels.ts` (pure, tested per flow),
`ShippingLabelRepository.reconcileOrder` (one transaction under a Postgres
advisory lock), `ShippingLabelSync` (one order for the webhooks, a whole
month for the refresh), and the route `webhooks.app.fulfillments.ts`.

## Report

**Page:** a month picker as today, then three tables, each with its count:

1. **Used AWBs** ("AWB-uri folosite"). Columns: No., AWB, Order, Source,
   Parcel, Weight, Order date, Issued, First printed, Prints.
2. **Cancelled AWBs** ("AWB-uri anulate"). Columns: AWB, Order, Source, Issued,
   Cancelled, Reason, Prints.
   - A cancelled AWB that was printed is highlighted, because it's the one
     most likely to have been scanned and billed.
3. **Unrecognised courier** ("Curier nerecunoscut"). Columns: AWB, Order,
   Courier as typed, Issued, Status. Shown only when not empty. Fixing the
   courier in Shopify moves the row to the right table.

**Excel:** the same three tables as three sheets, with the same names and
columns.

**Buttons:** Download Excel, Refresh from Shopify, Add AWBs by hand. Under the
month picker: when the month was last read from Shopify.

## Adding AWBs by hand

For the AWBs the app cannot find in Shopify: ones whose tracking was removed
before the report existed (the one-time catch-up of the current month), or
ones booked on the Optimus website for a parcel outside Shopify.

- A dialog on the report page: status (used or cancelled), issue day, note,
  and a box with one AWB per line, optionally followed by its order number
  (`6256347789 1022`). Spaces, tabs, commas and semicolons all separate, so a
  column pasted from Excel works.
- Each order number is looked up in Shopify. If any line can't be read or
  names an unknown order, nothing is saved and the lines to fix are listed.
- An AWB the report already has is left alone and named in the message.
- These rows can be deleted from the tables. Reconcile never changes them.

## Tutorials page

`/app/tutorials` ("Tutoriale"), linked from the nav and from the report. The
text is in `app/commons/tutorials/Tutorials.ts`, Romanian and English:

- working a pack, in order;
- an order that needs one more label;
- delivering an order ourselves;
- cancelling an AWB;
- making the label on the Optimus website (e.g. cash on delivery);
- checking the monthly Optimus bill;
- bringing this month's AWBs into the report, once.

## To verify

On the dev store, after `shopify app dev` has registered the webhooks:

Checked on 17.11.2026: the refresh brings in older AWBs; **Cancel
fulfillment** and **Edit tracking** with the number deleted both fire
`fulfillments/update` and move the AWB to cancelled; the extra-label flow ends
with both AWBs used; a GLS courier is recognised; adding by hand works.

Still open:

1. Does TrackMe's **Print labels** get the PDF of an AWB booked on the
   Optimus website?
2. The Romanian names of Shopify's buttons, for the tutorials
   (`SHOPIFY_LABELS` in `Tutorials.ts`).

## Setup you do

You run: `npx prisma migrate deploy`, and `shopify app dev` or
`shopify app deploy` so Shopify picks up the new webhook subscriptions.

## Not in scope

- Asking Optimus whether a cancelled AWB was scanned. See the courier notes.
- Couriers other than Optimus. `courier` is a column so they can be added
  later.
