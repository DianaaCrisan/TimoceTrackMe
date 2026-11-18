# Background work visibility: plan

Goal: the admin never sees a finished-looking screen while work is still
running, and never sees work as lost after it has finished.

## The problem today

Moving 45 orders to a pack: the table shows a loading bar for about a second,
then the same 45 orders again, with no loading bar and a success toast. After a
manual refresh a minute later, they are gone.

Why:

1. `PackService.addOrders` writes the membership to the database and answers.
   The Shopify tags follow in the background (`startPackTagging`), 4 orders at a
   time, one or two API calls per order.
2. The table is a Shopify search on those tags (`tag_not:in-pachet` for "Fără
   pachet", `tag:<pack tag>` inside a pack). An order only moves once its tag is
   written **and** Shopify's search index has picked it up.
3. The loading bar follows the HTTP request, and the page reloads once more
   after a fixed 5 s (`TAGS_CATCH_UP_MS`). For 45 orders the tagging is often
   still running by then, and nothing reloads after that.
4. The tag queue lives in memory. A restart drops whatever was queued: added
   and moved orders keep `taggedAt = null` (the Retry button finds them),
   removed orders leave no trace at all.

Add tracking and print labels: since `2c5653c` the jobs wait for the search
index before they report finished, so the reload after a job is right. What is
still missing is everything **during** the run: the loading bar stops once the
job is queued, the "started" notice hides after 8 s, the orders stay ticked
and clickable, and the only progress is the Recent jobs list at the bottom.

## Throughput, for sizing

Every tag call is a mutation and costs 10 points. Shopify refills the app's
bucket at 100 points/s on Standard plans (200 Advanced, 1000 Plus), so on
Standard about **10 tag calls/s** however many run in parallel. The
`GraphqlLimiter` already paces calls to the bucket. Raising the worker count
only spends the starting bucket faster. It helps small batches, not large ones.

| Orders (Standard plan, estimates) | Added | Moved between packs |
| --- | --- | --- |
| 45 | ~4–5 s | ~8–10 s |
| 300 | ~30 s | ~1 min |
| 1000 | ~1.5–2 min | ~3 min |

The design below has to stay honest for minutes-long runs, not just seconds.
Bulk mutations (`bulkOperationRunMutation`) are left for later, if these waits
turn out to be a problem in practice.

## Decisions

| Topic | Decision |
| --- | --- |
| Pending tag work | Stored in the database, written in the **same transaction** as the membership change. A restart loses nothing; a worker picks it up on boot. |
| What the worker does | Brings an order's tags in line with the database **at the time it runs**: it reads the order's current pack, it does not replay a queued instruction. An order moved A → B → C before the worker reaches it gets C's tags in one go. |
| Progress | Each pack action creates a tag batch: total, done, failed. Jobs (add tracking, print labels) report done/total too. |
| "Finished" | A batch or job is finished once its changes show in Shopify search (`waitForSearchIndex`, as add tracking does now), or after the 30 s timeout. Only then does the page reload. |
| Polling | While anything runs, the page polls one cheap endpoint (database + memory, **no Shopify calls**) every 2 s. It does not reload the table on a timer: those reloads use the same API bucket as the tagging and would slow it down. |
| Rows in flux | Shown greyed out with a badge ("Se mută în pachet…", "Se adaugă AWB…"), checkbox disabled. They stay visible, so pagination and counts stay stable. |
| Where pending rows come from | The server, in the loader. The browser does not know the IDs behind "Select all N in this tab", and the state has to survive a refresh. |
| Selection safety | "Select all in this tab" leaves out orders whose database state contradicts the tab (e.g. on "Fără pachet" but already in a pack in the database). Otherwise an admin could re-add orders that are still being tagged. |
| Fixed timers | `TAGS_CATCH_UP_MS` and `SEARCH_INDEX_CATCH_UP_MS` are removed. |
| Worker count | 4 → 8 for tagging: about 2× faster for batches under ~150 orders, no change for bigger ones. |
| Select all | The header checkbox always selects **every order in the tab, across all pages**. There is no "this page only" step and no separate "Select all N" link. |
| Pack size | A full pack waits (it does not lock). The limit is 200, shown read-only in Settings for now. |

## Phase 1: pending tag work in the database (backend)

### Schema

```prisma
/// An order whose Shopify tags may not match its pack yet. The worker brings
/// the tags in line with FulfillmentPackOrder, then deletes the row.
model PackTagSync {
  orderId     String            @id
  shop        String
  /// Pack tags that may still be on the order and must go (packs it left).
  staleTags   String[]          @default([])
  status      PackTagSyncStatus @default(PENDING)
  attempts    Int               @default(0)
  lastError   String?
  /// Bumped on every new change, so the worker never deletes a row that
  /// changed while it was tagging the order.
  version     Int               @default(0)
  requestedAt DateTime          @default(now())
  batch       PackTagBatch?     @relation(fields: [batchId], references: [id], onDelete: SetNull)
  batchId     String?

  @@index([status, requestedAt])
  @@index([batchId])
}

enum PackTagSyncStatus {
  PENDING
  FAILED
}

/// One admin action's tag work, for its progress banner.
model PackTagBatch {
  id          String    @id @default(cuid())
  kind        String    // addOrders | removeOrders | close | retry
  /// The pack orders joined (add, move, close leftovers) or left (remove).
  packId      String?
  orderIds    String[]  // for the search-index check at the end
  orderCount  Int
  failedCount Int       @default(0)
  createdAt   DateTime  @default(now())
  /// Every tag call done (or given up).
  taggedAt    DateTime?
  /// Shopify search shows the result, or the wait timed out.
  finishedAt  DateTime?
  syncs       PackTagSync[]
}
```

Webhook orders (`orders/create`) get a `PackTagSync` row with no batch: no
banner for a single new order, but the row is still shown as pending.

Migration backfill: a `PENDING` row for every `FulfillmentPackOrder` with
`taggedAt IS NULL`, so today's untagged orders join the new flow.

### Writing the work

`PackRepository.addOrders / removeOrders / close / assignNewOrder` upsert
`PackTagSync` rows inside `withPacksLock`, in the same transaction:

- joining: `staleTags = []`
- moving: `staleTags ∪ {old pack tag}`
- leaving: `staleTags ∪ {old pack tag}`
- every upsert sets `status = PENDING`, `attempts = 0`, `version + 1`, and the
  new `batchId`

`PackService` creates the `PackTagBatch` in the same transaction and returns
its id. `startPackTagging` and the in-memory `tagQueue` go away.

### The worker (`PackTagWorker.server.ts`)

- One per process. `kick()` after each commit; also on server start, which
  resumes work left by a restart.
- Loop: take the oldest 50 `PENDING` rows, tag them 8 at a time through
  `createPool`, repeat. Rounds run one after another in one process, so no
  order is tagged twice at once. Like `OrderJobLocks`, this assumes a single
  app instance.
- A round where no order could even be marked (the database is failing) stops
  the loop instead of spinning; the 1-minute tick tries again.
- Per order:
  1. read its current membership
  2. wanted tags: `[pack tag, in-pachet]`, or `[]` if in no pack
  3. remove: `staleTags` minus the wanted tags, plus `in-pachet` when in no pack
  4. send `tagsRemove` and `tagsAdd` in **one** GraphQL document (two aliased
     mutations): same cost, half the round trips
- On success: delete the row `WHERE orderId = ? AND version = <claimed>`. Set
  `taggedAt` on the membership if the order is in a pack.
- On failure: retry with the existing delays (500 ms, 1 s). After 3 attempts,
  `FAILED` with `lastError`, and `failedCount + 1` on the batch.
- When a batch has no `PENDING` rows left: set `taggedAt`, run
  `waitForSearchIndex` on its orders (`tag:<pack tag>` for joiners, `NOT
  tag:in-pachet` for leavers), then set `finishedAt`.
- Pure parts as functions with tests: `planTagSync(membership, staleTags) →
  { add, remove }`, batch completion.

### Retry button

`PackService.retryTagging` queues again, in a new `retry` batch:

- the pack's orders with `taggedAt = NULL` (failed, or never queued)
- `FAILED` orders that still have to lose the pack's tag (they left it, but
  its tabs still show them)

Orders already pending are left to the worker. The pack view's
`untaggedCount` is split into `taggingCount` (pending: an info line) and
`tagFailedCount` (failed: the warning with Retry).

Finished batches are deleted after 24 hours: they only exist for the
progress shown right after an action.

### Selection guard

In `resolveOrderIds` for a `filter` selection, drop:

- on the Orders page: orders that have a `FulfillmentPackOrder` row
- in a pack: orders whose row is no longer in that pack

For an `ids` selection the server already works from the database, so no change
is needed.

**Tests:** `planTagSync` (join, move, leave, A → B → C before the worker runs),
upsert merging of `staleTags`, version guard on delete, batch completion,
selection guard, migration backfill on an empty schema. No test touches the dev
database's existing rows.

## Phase 2: showing it (frontend and loader)

### Activity endpoint

`/app/jobs/recent` returns `{ jobs, tagBatches, generatedAt }`:

- `tagBatches`: the unfinished ones, plus those finished in the last 10
  minutes, with `{ id, kind, packId, packName, orderCount, doneCount,
  failedCount, taggedAt, finishedAt }`
- `doneCount = orderCount − rows still PENDING in the batch`

One indexed `groupBy` query plus the in-memory job list. No Shopify calls.

### Job progress

- `JobRecord` gets `processedCount`.
- `OrdersJobContext` gets `onProgress(done)`. The existing progress logger in
  `addTrackingNumbers` and the label fetch pool in `printLabels` call it.
- The job shows a separate "Se verifică în Shopify…" step while
  `waitForSearchIndex` runs.

### `useBackgroundActivity` hook

- Takes the snapshot from the loader. While anything is running, it polls the
  endpoint every 2 s. `RecentJobsSection` reads from it instead of polling on
  its own.
- When a job or batch that was running finishes, it runs `revalidator.revalidate()`
  **once**. It also clears the selection and shows the finished notice
  (today's `handleJobFinished` logic, moved here).
- Safety net: if the reloaded page still has stale rows (see below) and nothing
  is running, it reloads again after 3, 6 and 12 s. After that it shows
  "Shopify încă actualizează lista, reîmprospătează în câteva momente."

### Pending rows from the loader

`loadOrdersDashboard` adds `pendingByOrderId` for the visible rows only. Each
entry has a reason:

| Reason | Source | Badge |
| --- | --- | --- |
| `joiningPack` | `PackTagSync` row, order is in a pack in the database | Se adaugă în pachetul X… |
| `leavingPack` | `PackTagSync` row, order is in no pack in the database | Se scoate din pachet… |
| `inJob` | `orderJobLocks.findBusy(visibleIds)` | Se adaugă AWB… / Se pregătesc etichetele… |
| `stale` | the row's own fields contradict the tab | Se actualizează… |

`stale` is the general safety net. The order's fields in the response are
current; only the search that picked the order is behind. The dashboard query
already reads `displayFulfillmentStatus`. Adding `tags` (free) lets a small
function `contradictsTab(order, filter, packTag)` catch every case: a
fulfilled order on "Neexecutată", a printed one on "Neprintate", a packed one
on "Fără pachet". These are changes made by other admins, by webhooks, or past
a search-index timeout.

The table greys these rows out and disables their checkboxes.
`allVisibleSelected` and "Select all" skip them.

### Banners

`ActivityBanner`, above the table, one line per running batch or job, with a
progress bar:

- "Se mută 45 comenzi în pachetul 18.11.2026/1 — 12/45"
- "Adăugare AWB — 34/120"
- "Se verifică în Shopify…" (search-index step)
- failed tags: "3 comenzi nu au putut fi etichetate — Reîncearcă"

It stays up until the work is finished, then turns into the finished notice.

On a pack's page, the pack summary adds "300 comenzi încă se adaugă în acest
pachet" for batches into that pack. The pack's own tabs only list tagged
orders, so without it a pack that is still filling looks short.

### Select all across pages

Today the header checkbox ticks the visible page. A "Select all N in this tab"
link then appears, so it is easy to act on 50 orders while believing it is all
of them. New behaviour:

| Action | Result |
| --- | --- |
| Click the header checkbox (nothing ticked, or some ticked) | Every order in the tab, on every page: `filter` mode. The bar says "Toate cele 45 comenzi din tab selectate". |
| Click it again (all selected) | Clears the selection. |
| Untick a row while all are selected | Stays "all in the tab", minus that order: "44 din 45 selectate". The exception holds on every page. Ticking the row again removes it. |
| Tick rows by hand | As today: `ids` mode. Ticks survive page changes within the tab. |
| Change tab | Clears the selection, as today. |

Header checkbox state: checked when all are selected with no exceptions,
indeterminate when some are ticked or there are exceptions, unchecked
otherwise.

Edge cases:

- **More than 1000 orders in the tab** (`MAX_ORDERS_PER_JOB`): the checkbox is
  disabled, with the reason as its tooltip. Rows can still be ticked by hand.
  With 200-order packs this can only happen on the Orders page.
- **The count is not known** (the count query failed): same, disabled with a
  tooltip.
- **Greyed-out (pending) rows** are not in the selection. The server's
  selection guard (phase 1) leaves them out, and the banner or toast reports
  the real number acted on.
- **The ZIP to fix tab is out of scope.** Its panel has a ZIP input per row, so
  its own checkbox keeps selecting just the visible page.

Code:

- `OrderSelection` `filter` mode gets `excludedOrderIds?: string[]`. These
  are sent as form fields, checked as order GIDs in `parseOrderSelection`,
  and subtracted in `resolveOrderIds`. The tracking review and every job use
  the same parser, so they all follow.
- `OrdersDashboardPage`: `isFilterSelected` and `selectedOrderIds` become one
  `selection` state:
  `{ kind: "none" } | { kind: "ids", ids } | { kind: "all", excluded }`.
  `handleSelectAllInFilter`, `isWholeTabSelected`, the "Select all N" link
  and the `tabTooLarge` hint go away.
- `OrdersDashboardTable`: the header checkbox gets `checked`, `indeterminate`,
  `disabled` and `title` from the page. A row is ticked if it is in `ids`, or
  if the selection is `all` and the row is not excluded.

**Tests:** the selection reducer (each row of the table above), the
exclusions round-trip through `appendOrderSelection` → `parseOrderSelection`,
and `resolveOrderIds` with exclusions.

### Quick wins in the same phase

- Pack toast: "45 comenzi adăugate în X. Se actualizează în Shopify…"
  instead of a plain "done".
- Clear the selection when a job starts; its orders become pending rows anyway.
- The "started" notice is replaced by the banner, so it no longer hides after
  8 s.

**Tests:** `contradictsTab` per tab, `useBackgroundActivity` transitions
(running → finished → one reload; stale rows → backoff → give up), pending row
rendering.

**Manual check on the dev store:**

1. Move 45 orders to a pack: the banner counts up, the rows are greyed out, and
   the list updates once without a manual refresh.
2. Move ~300 orders.
3. Restart the dev server while tagging runs: the work resumes and the banner
   picks it up.
4. Add tracking on 20 orders: the rows show "Se adaugă AWB…" and the counter
   moves.
5. Run a second action while the first is running.

## Phase 3: pack size limit

A setting: **"Pachet nou după N comenzi"**, fixed at **200** for now.

### Behaviour

- `AppSettings.packMaxOrders Int @default(200)`. It is a column, not a
  constant, so making it editable later is only a settings-page change. It is
  read inside the packs transaction, like `packStartWeekdays`.
- The filling pack stops taking new orders once it holds `packMaxOrders`.
  It becomes **waiting**, the same state a scheduled cut leads to. The next
  order starts a new pack.
- It applies when the app picks the filling pack, meaning to new orders from the
  webhook and to "Add to the filling pack". A selection is never split: if the
  admin adds 150 orders to a filling pack with room for 50, all 150 go in, the
  picker warns ("va depăși limita de 200"), and the next new order starts a
  new pack.
- Not capped: manual adds to a specific pack, and leftovers moved on close.
  The admin chose those, and the leftovers have to go somewhere.
- The waiting badge says why: "Așteaptă (programare)" or "Plin (200)".
- Lowering the limit below the filling pack's size takes effect at the next
  order.

### Code

- `findFillingPack`: the newest open pack waits if it has had a scheduled cut
  **or** `orderCount >= packMaxOrders`. Counted inside the packs lock, so two
  webhooks at the limit cannot both get in.
- `isWaiting` in `toRecords` uses the same rule (the order count is already
  there), and gets `waitingReason: "schedule" | "full"`.
- Settings page: a **read-only** field next to the weekday cuts, showing
  200, with the note: "Valoarea recomandată pentru planul Shopify actual
  (<plan>): acțiunile pe un pachet întreg durează în jur de un minut. Nu
  poate fi modificată deocamdată."
  - `<plan>` comes from `shop { plan { displayName } }`, read in the settings
    loader. One cheap query. If it fails, the note leaves the name out.
  - The settings action ignores the field, so a crafted request cannot
    change it.

**Tests:** waiting by count, by schedule, by both; the limit at exactly N;
manual add over the limit; close leftovers past the limit; the settings
action leaving `packMaxOrders` untouched.

### Why 200

- **It's well under the job cap.** "Select all in this tab" and every job stop
  at `MAX_ORDERS_PER_JOB = 1000`. Past that, a pack can't be processed in one
  job.
- **Pack-wide actions stay around a minute** on a Standard plan:
  - moving the whole pack: 200 × 2 calls ≈ 40 s
  - add tracking: several calls per order plus Optimus, about 1–1.5 min
    (estimate; the `[ThrottleMonitoring]` logs of a real run will show it)
  - at 500, the same actions take 3–4 min
- **The pack stays easy to work with:** 4 pages of 50, and a picking report
  short enough to use on the floor.

These timings assume a Standard plan (100 points/s). On Advanced or Plus,
the same actions run 2× to 10× faster, and the limit could go up once the
field becomes editable.

## Decided

1. Rows in flux are greyed out, not hidden: pagination and counts stay stable.
2. A full pack waits; it does not lock. Locking means "work has started",
   which is the team's call.
3. The pack limit is 200, read-only in Settings for now.
4. The header checkbox selects every order in the tab, across all pages.

## Later

- Bulk mutations for tagging above ~150 orders, if 1–3 minute waits are
  felt.
- Bump the API version to 2026-01, which allows 5 concurrent bulk operations
  instead of 1.
