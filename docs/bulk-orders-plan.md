# Bulk order actions: plan

Goal: select hundreds of orders in the Orders dashboard and solve ZIP codes,
add tracking numbers and print labels for all of them at once.

The approach is borrowed from Tropical TrackMe. Every bulk action runs as a
background job. The result goes to S3, and a download link is emailed via
ZeptoMail.

## Decisions

| Topic                                        | Decision                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delivery of results                          | Always by email. No instant in-browser download, at any selection size.                                                                                                                                                                          |
| Recipient                                    | `JOB_RESULT_EMAIL` env var (currently diana.crisan20@gmail.com).                                                                                                                                                                                 |
| Storage                                      | Timoce's own S3 bucket. Keys: `<APP_NAME>/temporary-files/<job>/<YYYY/MM/DD>/<uuid>-<file>`.                                                                                                                                                     |
| Link lifetime                                | 24 hours.                                                                                                                                                                                                                                        |
| Selecting orders                             | "Select all N orders in this filter". The server resolves the IDs when the job starts. Capped at 1,000 orders per job.                                                                                                                           |
| ZIP during add tracking                      | Solve before calling Optimus if missing; re-solve and retry once if Optimus rejects the zip ("delivery zip code").                                                                                                                               |
| "Printed" marker                             | Shopify's API cannot create timeline comments (`CommentEvent` is read-only up to API 2026-10). Instead: a `LABEL_PRINTED` fulfillment event on each printed delivery fulfillment, plus the order tag `eticheta-printata` on every printed order. |
| Label PDF layout                             | Items and order numbers on the same 150×100mm page: items on top, order numbers below, overflow on a "Comenzi (cont.)" page.                                                                                                                     |
| Result reports                               | Excel, one row per order.                                                                                                                                                                                                                        |
| Document archive (Tropical's Documents page) | Not now.                                                                                                                                                                                                                                         |

## Phases

### Phase 1: Job infrastructure

- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- `app/backend/aws-s3/`: upload a buffer and return a presigned download link; build the object key.
- `app/backend/zepto-mail/`: send an email.
- `app/backend/jobs/`:
  - `startEmailJob`: locks the orders, returns at once, runs the build in the background, then emails the link (or the error).
  - `OrderJobLocks`: an order already in a running job cannot be added to another one. This prevents duplicate AWBs from a double click.
- Admin panel: a "Send test job email" button that uploads a small file and emails its link, to check the AWS and ZeptoMail setup.
- Env vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET`, `ZEPTOMAIL_API_KEY`, `ZEPTOMAIL_SENDER`, `JOB_RESULT_EMAIL`.

### Phase 2: Select all matching orders

- Remove the 20-order cap (`MAX_SELECTED_ORDERS`).
- After ticking the header checkbox, show "Select all N orders in this filter" (count from `ordersCount`).
- Requests carry either `orderIds` or `{ filter }`. With a filter, the job pages through `orders(query){ id }`.
- The three buttons start jobs and show "Started, the result will be emailed to …". The result panels and the browser download go away.

### Phase 3: Solve ZIP and add tracking as jobs

- `exceljs` for the result reports.
- Before calling Optimus, solve all missing zips in one zip-solver call.
- On an Optimus "delivery zip code" rejection: re-solve that order's zip (overwriting it), update Shopify, retry once. Each order is solved at most once per run. As in Tropical, the rejected AWB stays orphaned in Optimus.
- Orders with nothing to fulfill are reported as "skipped" (today they disappear from the result).
- Report columns: order, status, tracking numbers, old zip → new zip when solved automatically, errors.

### Phase 4: Print labels as a job

- Fetch order data in batches of 50; fetch Optimus PDFs with a worker pool.
- New combined items + order numbers page (replaces `generateSummaryLabelPDF` + `appendOrderNamePagesToPDF`). The "Total etichete" page stays.
- Once the PDF is on S3 and before the email:
  - `fulfillmentEventCreate` with status `LABEL_PRINTED` and message "Etichetă printată (TrackMe)" for each printed delivery fulfillment
  - `tagsAdd` `eticheta-printata` for each printed order (delivery and pickup)
  - marking failures are listed in the email; they don't fail the job
- Email: zip with the shipping PDF, the pickup PDF and the Excel report.
- Needs the `write_fulfillments` scope in `shopify.app.toml`. You then run `shopify app deploy` and re-approve the app on the store.

### Phase 5: Tests

Vitest for zip recovery, the combined page layout and its overflow, select-all ID resolution, and printed marking (including partial failures).

## Setup you do

1. AWS: an IAM user with `s3:PutObject` and `s3:GetObject` on the Timoce bucket; optionally a lifecycle rule that deletes `temporary-files/` objects after 7 days.
2. Fill in the env vars listed in Phase 1, locally and on the host.
3. After Phase 4: `shopify app deploy`, then re-approve the new scope on the store.
4. On the dev store, check whether the `LABEL_PRINTED` event shows on the customer's order status page or sends them a notification.

## Known limits

- Jobs run inside the app's server process. A restart or deploy mid-job loses that job, and no email arrives.
- Order locks are in memory, so they only work with one app instance.
