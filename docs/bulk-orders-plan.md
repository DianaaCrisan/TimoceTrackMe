# Bulk order actions: plan

Goal: select hundreds of orders in the Orders dashboard and solve ZIP codes,
add tracking numbers and print labels for all of them at once.

This is an intermediate step. A new multi-client app with its own bucket will
replace it later, so it stays deliberately simple: every bulk action runs as a
background job and stores its result file in S3. You download the files from
the S3 console. There is no email.

## Decisions

| Topic                                        | Decision                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delivery of results                          | Stored in S3 and downloaded from the S3 console. No email, no instant in-browser download.                                                                                                                                                       |
| Knowing a job finished                       | A "Recent jobs" list in the app: status, summary, and a link to the file in the S3 console. Kept in memory, so it empties on restart; the files stay in S3.                                                                                      |
| Failed jobs                                  | Store a `FAILED_<job>.txt` file with the error and the order IDs next to where the result would have been.                                                                                                                                       |
| Storage                                      | Bucket `shopify-timoce-s3-bucket` (eu-central-1). Keys: `<APP_NAME>/<job>/<YYYY-MM-DD>/<HH-mm-ss>_<shortId>_<file>`, in the shop's time zone, so the console lists runs in order.                                                                |
| Cleanup                                      | None (no lifecycle rule). The bucket is only for this intermediate app.                                                                                                                                                                          |
| Selecting orders                             | "Select all N orders in this filter". The server resolves the IDs. Capped at 1,000 orders per job.                                                                                                                                               |
| ZIP during add tracking                      | Solve before calling Optimus if missing; re-solve and retry once if Optimus rejects the zip ("delivery zip code").                                                                                                                               |
| "Printed" marker                             | Shopify's API cannot create timeline comments (`CommentEvent` is read-only up to API 2026-10). Instead: a `LABEL_PRINTED` fulfillment event on each printed delivery fulfillment, plus the order tag `eticheta-printata` on every printed order. |
| Label PDF layout                             | Items and order numbers on the same 150×100mm page: items on top, order numbers below, overflow on a "Comenzi (cont.)" page.                                                                                                                     |
| Result reports                               | Excel, one row per order.                                                                                                                                                                                                                        |
| Document archive (Tropical's Documents page) | Not in this app.                                                                                                                                                                                                                                 |

## Phases

### Phase 1: Job infrastructure (done)

- `@aws-sdk/client-s3`.
- `app/backend/aws-s3/`: upload a buffer, build the object key, build S3 console links.
- `app/backend/jobs/`:
  - `startBackgroundJob`: locks the orders, returns at once, runs the build in the background, uploads the result (or a `FAILED_` file) and records the outcome.
  - `OrderJobLocks`: an order already in a running job cannot be added to another one. This prevents duplicate AWBs from a double click.
  - `JobRegistry`: the last 30 jobs, in memory.
- Admin panel: S3 setup checklist, a link to the app's folder in the S3 console, an "Upload test file" button, and the Recent jobs list.
- Env vars: `AWS_REGION`, `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

### Phase 2: Select all matching orders, all actions as jobs (done)

- The 20-order cap is gone; one job takes up to `MAX_ORDERS_PER_JOB` (1,000).
- After ticking the header checkbox, "Select all N orders in this tab" appears (count from `ordersCount`). Unticking any order leaves that mode.
- Requests carry either `selectedOrderIds` or `{ selectionMode: "filter", filter }`. With a filter, the server pages through `orders(query){ id }` and locks those orders before the job starts.
- The three buttons start jobs (`handleStartOrdersJob`) and show a notice. The result panels and the browser download are gone.
- Recent jobs list on the Orders dashboard. It polls while a job runs and reloads the table when one finishes.
- Jobs use `createJobAdmin`, which reloads the offline session at most once a minute, so a long job keeps a valid (refreshed) access token.
- Every job produces an Excel report, one row per order (failed first): succeeded, failed, or skipped with the reason. Print labels zips the PDFs, the report and `errors.txt`.
- Print labels fetches orders in batches of 50 (it was one query for all of them).

### Phase 3: Add tracking: automatic ZIP solving (done)

- `ZipRecovery` solves ZIPs during one add-tracking run, at most once per order:
  - before any Optimus call, every order without a ZIP is solved in one zip-solver call; an order that stays without a ZIP fails without calling Optimus
  - when Optimus rejects a ZIP ("delivery zip code"), that order is re-solved (overwriting its ZIP in Shopify) and the AWB retried once. No retry if the solver suggests the same ZIP or cannot solve it.
- The solved ZIP is used for the order's later fulfillment orders too.
- As in Tropical, Optimus keeps the rejected AWB; it is never fulfilled.
- Report: "ZIP solved automatically: old → new (confidence)" in the Details column.

### Phase 4: Print labels: speed, layout, printed marker (done)

- Optimus label PDFs are fetched for 4 orders at a time (it was one at a time).
- Each group of identical labels starts with one combined page (`generateGroupHeaderPDF`): items on top, then "Comenzi (N)" with the order numbers in 5 columns. Long lists continue on "Comenzi (cont.)" pages. The "Total etichete" page stays. This replaces the separate items page and order-numbers page.
- Every order with a label in the PDF is marked as printed (`markLabelsPrinted`):
  - each delivery fulfillment gets a `LABEL_PRINTED` fulfillment event with the message "Etichetă printată (TrackMe)"
  - each order (delivery and pickup) gets the tag `eticheta-printata`
  - a marking failure is listed on the order's report row; the labels still count as printed
- Label errors are reported on the order they belong to. `errors.txt` only holds problems that belong to no order.
- Scope `write_fulfillments` added to `shopify.app.toml`.

### Phase 5: Tests (done along the way)

Vitest covers job running and locking, selection resolution, reports, ZIP recovery, the combined page layout and its overflow, and printed marking.

## Setup you do

1. AWS: an IAM user whose policy allows `s3:PutObject` on `arn:aws:s3:::shopify-timoce-s3-bucket/*`. `s3:GetObject` is not needed by the app.
2. Set the four `AWS_*` env vars locally and on the host.
3. Run `shopify app deploy` so the `write_fulfillments` scope is released, then open the app in the store and approve the new permission.
4. On the dev store, check whether the `LABEL_PRINTED` event shows on the customer's order status page or sends them a notification.

## Known limits

- Jobs run inside the app's server process. A restart or deploy mid-job loses that job: it leaves no file, and the Recent jobs list is emptied.
- Order locks and the Recent jobs list are in memory, so they only work with one app instance.
