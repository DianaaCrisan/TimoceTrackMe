# Fulfillment packs: plan

Goal: work on a fixed group of orders from start to finish. Today the dashboard
tabs show every order in the shop, so new orders mix in with the batch being
worked on, and the batch is easy to lose track of.

A **pack** is a group of orders. New orders go into the pack that is filling.
When work starts on it, the pack is **locked**, and new orders start a new pack.
Inside a pack, the dashboard works exactly as today: the same tabs, counts,
"Select all" and bulk jobs, limited to that pack's orders.

Similar to Tropical's packs, but simpler: a Tropical pack is a range of days,
while here a pack is whatever arrived between two **cuts**. Tropical's
date-range machinery (bucket lookups, schedule-change guards, pending changes)
is not needed.

## Decisions

| Topic | Decision |
| --- | --- |
| How a pack filters orders | Each pack has its own order tag, e.g. `pachet-2026-11-14-2`. A pack's tabs, counts and "Select all" add `tag:<pack tag>` to the existing tab queries, so no tab logic is rewritten. |
| Pack tag | `pachet-<YYYY-MM-DD>-<n>`: fixed when the pack is created and stored on the pack, never rebuilt from the name. Hyphens only, because `.` and `/` need quoting in Shopify search. Year first, so tags sort by date in the Shopify admin. |
| "Not in a pack" | Every packed order also gets the tag `in-pachet`. It is added and removed in the same API call as the pack tag, so it costs nothing extra. Shopify search may not support wildcards like `tag_not:pachet-*`, so a shared tag is the reliable way. |
| Source of truth | The database decides which pack an order is in. The tags make that searchable. A tag that failed to apply is recorded and can be retried. |
| One pack per order | An order is in at most one pack. Adding it to another pack moves it. |
| Name | `Pachet 14.11.2026/2`: the day the pack was created (Europe/Bucharest) and its place among that day's packs. Short however long the app runs, and it says when. The time of the first order shows next to it. |
| Which orders | Every order, pickup included. Assigned on `orders/create` (phase 2). |
| Done | Cancelled, or fulfilled with its label printed. A pickup order is done once it is marked as picked up (which fulfills it in Shopify), printed or not: add tracking skips pickup orders, so the app never fulfills them. |
| Closing | Close turns on once no orders are left. With orders left, "Close and move N orders to the next pack" moves them to the filling pack, after a confirmation. |
| Cuts | Locking a pack is always a cut. Optionally (phase 3), midnight before each chosen weekday is a cut too. |
| When it runs | Every rule is applied when an order arrives or a button is pressed. No cron. |

## Pack states

| State | Stored as | Gets new orders | Can add or remove by hand |
| --- | --- | --- | --- |
| Filling | `OPEN`, no cut since it started | yes | yes |
| Waiting (phase 3 only) | `OPEN`, a scheduled cut since it started | no | yes |
| Locked | `LOCKED` | no | yes |
| Closed | `CLOSED` | no | no |

- **Lock** (button "Start working"): `OPEN` → `LOCKED`. The next order opens a new pack.
- **Close**: `LOCKED` → `CLOSED`. Hidden from the working list.
- **Reopen**: `CLOSED` → `LOCKED`, for a pack closed by mistake.
- **Delete**: only an empty pack.

There is no unlock. Locking by mistake costs nothing: the next order simply
starts a new pack.

## Data model

```prisma
model FulfillmentPack {
  id          String                @id @default(cuid())
  status      FulfillmentPackStatus @default(OPEN)
  /// Name: `<day>/<daySequence>`, e.g. 14.11.2026/2.
  day         DateTime              @db.Date
  daySequence Int
  /// `pachet-2026-11-14-2`, fixed at creation. Never rebuilt from the name.
  orderTag    String                @unique
  /// When the first order entered the pack, shown next to its name; also
  /// the reference point for scheduled cuts. NULL while empty.
  startedAt   DateTime?
  createdAt   DateTime              @default(now())
  lockedAt    DateTime?
  closedAt    DateTime?
  orders      FulfillmentPackOrder[]

  @@unique([day, daySequence])
}

enum FulfillmentPackStatus {
  OPEN
  LOCKED
  CLOSED
}

model FulfillmentPackOrder {
  orderId  String          @id // Shopify order GID: an order is in one pack at most
  pack     FulfillmentPack @relation(fields: [packId], references: [id], onDelete: Cascade)
  packId   String
  addedAt  DateTime        @default(now())
  /// When the pack tags were confirmed on the order. NULL: tagging failed, retry needed.
  taggedAt DateTime?

  @@index([packId])
}
```

Phase 3 adds to `AppSettings`:

```prisma
  /// ISO weekdays (1 = Monday) whose midnight starts a new pack.
  /// Empty: packs only change when one is locked.
  packStartWeekdays Int[] @default([])
```

**Concurrency:** assigning an order, creating a pack and locking a pack all run
in one transaction holding the same Postgres advisory lock
(`pg_advisory_xact_lock`). Two webhooks for the first orders of a new pack
cannot create two packs, and an order arriving while a pack is being locked
lands cleanly on one side of the lock.

## Search queries

`buildOrdersSearchQuery(filter, scope)` gets a scope:

- `{ kind: "all" }`: as today.
- `{ kind: "pack", orderTag }`: `tag:<orderTag> AND (<tab query>)`, or just
  `tag:<orderTag>` for the "All" tab.

The server always reads the tag from the database by pack ID. It never takes
a tag from the browser.

New tab in the all-orders view only, **Not in a pack**: orders that still need
work and are in no pack.

```
tag_not:in-pachet AND NOT status:cancelled AND
(fulfillment_status:unfulfilled OR fulfillment_status:partial OR tag_not:eticheta-printata)
```

Progress, per pack, two counts:

- total: `tag:<orderTag>`
- done: `tag:<orderTag> AND (status:cancelled OR (fulfillment_status:fulfilled AND (tag:eticheta-printata OR delivery_method:pick-up)))`
- left = total − done. Counting twice avoids negating a grouped query, which
  Shopify search handles poorly.

The leftovers moved on close are the pack's order IDs (database) minus the done
IDs (Shopify query).

Known quirks:

- Shopify search picks up a new tag a few seconds after it is added. An order
  just added to a pack can take a moment to appear in its tabs. The printed tag
  works the same way today.
- A pickup order counts as left until it is marked as picked up, even with its
  label printed. A pack with pickups waiting for their customers cannot be
  closed without moving them on.

## Phases

### Phase 1: packs, filled by hand (done)

Fixes "I lose track of my group" on its own, and is how existing orders get
into packs on production.

- Prisma models and migration `20261115120000_add_fulfillment_packs`
  (`start.sh` already runs `prisma migrate deploy`).
- `app/commons/packs/`: pack view type, `buildPackTag`, `PACKED_ORDER_TAG`
  (`in-pachet`), `formatPackName`, `toShopDay`, the action intents.
- `app/backend/packs/`:
  - `PackRepository.server.ts`: create, lock, close, reopen, delete, list,
    add, remove. Every change runs under the packs advisory lock; the next
    `daySequence` is taken under it too.
  - `planMembershipChange.ts`: which orders are new, which move, which stay
    because their pack is closed. Pure, so it is unit tested.
  - `PackOrderTags.server.ts`: the tags follow the database in the
    background (`tagsAdd` / `tagsRemove`, both tags in one call), one batch
    at a time, then `taggedAt`. A tag failure never undoes the change; the
    pack shows "N orders not tagged · Retry tagging".
  - `PackService.server.ts`: ties the two together; progress counts; close
    with leftovers.
- `buildOrdersSearchQuery(filter, packTag)` and `buildPackDoneQuery`.
- `OrderSelection` filter mode has an optional `packId`, so "Select all in
  this tab" inside a pack selects only that pack's orders. Every job route
  (add tracking, print labels, tracking review) gets this through
  `resolveOrderIds`.
- **Packs page** (`/app/packs`, first in the nav):
  - one card per working pack: name, state, first order / started times,
    progress bar (`45 of 60 done · 15 left`)
  - buttons by state: Start working, Delete (empty only), Close / Close and
    move N left, Reopen
  - "New pack" only when no pack is filling
  - the 20 most recently closed packs
- **Pack view** (`/app/packs/:packId?filter=…`): `OrdersDashboardPage` with
  the pack card on top and pack-scoped tabs, counts, "Select all" and jobs.
  Selection actions: Move to pack…, Remove from pack.
- **Orders page**: the "Not in a pack" tab and "Add to pack…" on the
  selection (the filling pack, locked packs, or a new pack).
- All pack changes go through one action route, `app.packs.manage.ts`.
- Closing refuses while a job is running on one of the pack's orders
  (`OrderJobLocks.findBusy`).
- Translations in English and Romanian.

**Rollout on production:** create a pack, open "Not in a pack", select all,
"Add to pack…".

### Phase 2: automatic assignment (done)

- `orders/create` webhook in `shopify.app.toml`, route
  `webhooks.app.orders-create.ts`. Needs the same protected customer data
  access Tropical uses for `orders/paid`. You run `shopify app deploy`.
- For each new order (`readNewOrderWebhook`, then
  `PackService.assignNewOrder`):
  1. no readable order GID → 200, logged
  2. already fulfilled or cancelled when created (e.g. made in the Shopify
     POS) → skip
  3. under the advisory lock: already in a pack → leave it there (Shopify can
     deliver a webhook twice, and the admin may have moved the order since);
     otherwise into the filling pack, or a new one; set `startedAt` if empty
  4. answer, then tag in the background, each order tried 3 times
     (500 / 1000 ms apart); set `taggedAt`
- Answer: 500 when the database write fails (Shopify retries for 48 hours);
  200 otherwise, including tag failures (the order is in the pack, retrying the
  webhook would not help). Failures are logged with `AppError[PackAssignment]`.
  Timoce has no email, so the safety nets are the "Not in a pack" tab and the
  untagged count on the pack card ("3 orders not tagged · Retry tagging").
- From here, a pack starts when its first order arrives. "New pack" stays for
  manual use.

### Unfulfilled items report per pack (done)

The step between "Start working" and add tracking: what the pack's orders
still need, per product, for delivery and for pickup.

- The existing report page with `?packId=`: the order-number interval form is
  hidden and the report and its PDF are named after the pack.
- Same Shopify read as the shop-wide report (they share one bulk query), then
  limited to the pack's orders from the database, not by tag, so an order
  just added is in it before Shopify search shows its tag.
- Linked from every filling or locked pack ("Unfulfilled items report"),
  highlighted once the pack is locked; the "Start working" confirmation names
  it as the next step.

### Phase 3: start packs on chosen days

- Settings page: "Also start a new pack at midnight before: Mon … Sun". None
  ticked = only locking starts a new pack.
- Filling pack rule: the newest `OPEN` pack, unless midnight (Europe/Bucharest)
  before a chosen weekday has passed since its `startedAt`. Then it is
  Waiting, and the order starts a new pack.
- The cut is checked when the order arrives (no cron). A webhook retried after
  midnight lands in the new day's pack.
- A schedule change applies from the next order. No guards needed: packs do
  not store date ranges.
- Day arithmetic with luxon in Europe/Bucharest (`plus({ days: 1 })`, never
  milliseconds: two days a year are 23 or 25 hours long).

## Tests

- `buildOrdersSearchQuery` with each scope and tab, including "Not in a pack".
- Filling-pack rule (pure function): no packs, filling pack, locked pack, and
  scheduled cuts across midnight and daylight-saving changes.
- Membership: add, move, remove; tag failure keeps the move and leaves
  `taggedAt` empty.
- Close with leftovers: only orders that are not done move, into the filling
  pack, created when missing.
- Webhook: skip rules, and the 200/500 answers.
