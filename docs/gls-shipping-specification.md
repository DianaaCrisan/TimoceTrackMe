# GLS shipping specification

What the app sends when it books a shipping label (AWB). Labels are booked
through the Optimus API and carried by GLS; GLS tracking numbers start
with `6`.

The code that builds the request is
`app/backend/optimus/createOptimusTrackingNumber.server.ts`.

## Weight: always in kg

GLS takes the parcel weight (`colet_greutate`) in **kilograms only**.

- Each product in Shopify can have its weight in grams, kg, pounds or ounces.
  The app reads the unit with the weight and converts every weight to kg
  (`toKilograms` in `app/commons/shipping/Weight.ts`). Nothing reaches the AWB
  in another unit.
- The parcel weight is the sum of `unit weight × quantity` for the items in
  that parcel.
- It is sent with a dot for decimals, rounded to the gram (`12.346`). Rounding
  keeps float noise such as `0.30000000000000004` out of the request.
- An item without a weight stops the order before any AWB is booked. Its
  weight has to be set on the product in Shopify.

## One AWB per parcel

Every AWB is for exactly one parcel (`colet_buc` is always `1`). An order that
ships as several parcels gets one AWB per parcel, and one Shopify fulfillment
per AWB, listing the items in that parcel. Each fulfillment emails the
customer its own tracking link.

## Parcel numbering

When an order ships as more than one parcel, every AWB says which parcel it
is:

| Field             | One parcel        | Parcel 2 of 3               |
| ----------------- | ----------------- | --------------------------- |
| `colet_descriere` | `produse (#1001)` | `produse (#1001) 2/3`       |
| `ref_factura`     | `Comanda #1001`   | `Comanda #1001 (colet 2/3)` |

The numbering is required, not cosmetic: GLS refuses the sixth identical
request within five minutes (error 31). Without the number, every parcel of
the same order would send an identical request.

Parcels are numbered across all of the order's shipping fulfillment orders.

## Weight limit per parcel

Set on the Settings page, under "Parcel weight". It is stored in the database
(`AppSettings`).

- **Empty:** no check, every fulfillment ships as one parcel.
- **Set, automatic split off:** orders over the limit are highlighted on the
  Orders page and listed for a check before adding tracking. They still ship
  as one parcel, and the results file notes the weight.
- **Set, automatic split on:** adding tracking packs a fulfillment over the
  limit into several parcels.

Set the limit a few kg below the most GLS accepts per parcel: products sold
by weight often weigh more than the weight set in Shopify.

### How a heavy fulfillment is split

`app/backend/add-tracking/packIntoParcels.ts`:

- Units are packed one at a time, the heaviest first, each into the first
  parcel with room (first-fit decreasing). A product's quantity can be spread
  over several parcels.
- A single unit heavier than the limit ships in a parcel of its own, and the
  results file warns about it.
- The same items always pack the same way.
- If one parcel fails, the order stops there. The parcels already booked stay
  fulfilled; adding tracking again ships what is left.
