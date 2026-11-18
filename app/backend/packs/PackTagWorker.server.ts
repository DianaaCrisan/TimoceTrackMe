import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { createPool } from "../graphql/throttle-handling/helpers/createPool";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";
import { createJobAdmin } from "../jobs/createJobAdmin.server";
import {
  searchIndexChecks,
  waitForSearchIndex,
  type SearchIndexCheck,
} from "../orders/waitForSearchIndex.server";
import { applyTagSync } from "./applyTagSync.server";
import {
  PackTagSyncRepository,
  type BatchToFinish,
  type PendingTagSync,
} from "./PackTagSyncRepository.server";
import { planTagSync, type TagSyncPlan } from "./planTagSync";

/**
 * Orders tagged at once. The GraphQL limiter paces the calls to the shop's
 * rate limit either way; more in flight only spends the starting bucket
 * faster, which is what makes small batches quick. See
 * docs/background-work-visibility-plan.md, "Throughput".
 */
export const PACK_TAG_WORKERS = 8;

/** Orders read from the queue per round. */
const ROUND_SIZE = 50;

/**
 * How often the worker looks at the queue without being kicked: picks up
 * work left by a database hiccup.
 */
const TICK_MS = 60_000;

/** Finished batches are only kept for the progress shown right after. */
const BATCH_RETENTION_MS = 24 * 60 * 60 * 1000;

type Repository = Pick<
  typeof PackTagSyncRepository,
  | "findPending"
  | "findMembership"
  | "markDone"
  | "markFailed"
  | "findBatchesToFinish"
  | "markBatchTagged"
  | "markBatchFinished"
  | "findSearchTargets"
  | "deleteBatchesFinishedBefore"
>;

export type PackTagWorkerDeps = {
  repository: Repository;
  getAdmin: (shop: string) => AdminApiContextWithoutRest;
  applyTags: (
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderId: string,
    plan: TagSyncPlan,
  ) => Promise<void>;
  waitForSearch: (
    admin: AdminApiContextWithoutRest,
    checks: SearchIndexCheck[],
  ) => Promise<unknown>;
  now: () => number;
};

/**
 * Drains the pack tag queue (`PackTagSync`): brings each order's Shopify
 * tags in line with the pack the database has it in, then finishes the
 * batches once Shopify search shows the result.
 *
 * One worker per process: rounds run one after another, so no order is
 * tagged twice at once. Like `OrderJobLocks`, this holds for a single app
 * instance.
 */
export class PackTagWorker {
  private isRunning = false;
  private isKicked = false;
  /** Batches waiting on Shopify search, by ID. */
  private finishingBatches = new Map<string, Promise<void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCleanupAt = 0;
  /** Settles when the current run is over; for tests. */
  private currentRun: Promise<void> = Promise.resolve();

  constructor(private readonly deps: PackTagWorkerDeps) {}

  /** Starts the periodic check and a first run. Safe to call again. */
  start(): void {
    if (!this.timer) {
      this.timer = setInterval(() => this.kick(), TICK_MS);
      this.timer.unref?.();
    }
    this.kick();
  }

  /** There may be new work: runs now, or once more after the current run. */
  kick(): void {
    this.isKicked = true;
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentRun = this.run().finally(() => {
      this.isRunning = false;
      if (this.isKicked) this.kick();
    });
  }

  /** Resolves once the worker is idle and no batch is being finished. */
  async whenIdle(): Promise<void> {
    while (this.isRunning || this.finishingBatches.size > 0) {
      await this.currentRun;
      await Promise.all(this.finishingBatches.values());
    }
  }

  private async run(): Promise<void> {
    try {
      while (this.isKicked) {
        this.isKicked = false;
        await this.drain();
        await this.startFinishingBatches();
        await this.cleanUp();
      }
    } catch (error) {
      // e.g. the database is down; the next tick tries again
      console.error("AppError[PackTags] the tag worker stopped.", error);
    }
  }

  private async drain(): Promise<void> {
    for (;;) {
      const syncs = await this.deps.repository.findPending(ROUND_SIZE);
      if (syncs.length === 0) return;

      const pool = createPool(PACK_TAG_WORKERS);
      const handled = await Promise.all(
        syncs.map((sync) => pool.schedule(() => this.syncOrder(sync))),
      );
      // nothing moved on (the database is failing): leave it to the next tick
      // rather than spin on the same rows
      if (!handled.some(Boolean)) return;
    }
  }

  /** False if the order could not be marked either way. */
  private async syncOrder(sync: PendingTagSync): Promise<boolean> {
    try {
      const membership = await this.deps.repository.findMembership(
        sync.orderId,
      );
      const plan = planTagSync(membership?.packTag ?? null, sync.staleTags);

      try {
        await this.deps.applyTags(
          this.deps.getAdmin(sync.shop),
          ShopifyUtils.getShopAdminUrl(sync.shop),
          sync.orderId,
          plan,
        );
      } catch (error) {
        console.error(
          `AppError[PackTags] could not update the tags of ${sync.orderId}.`,
          error,
        );
        await this.deps.repository.markFailed(sync, describeError(error));
        return true;
      }

      await this.deps.repository.markDone(sync, membership?.packId ?? null);
      return true;
    } catch (error) {
      console.error(
        `AppError[PackTags] could not record the tags of ${sync.orderId}.`,
        error,
      );
      return false;
    }
  }

  /** Runs in the background: a search-index wait must not hold up tagging. */
  private async startFinishingBatches(): Promise<void> {
    const batches = await this.deps.repository.findBatchesToFinish();

    for (const batch of batches) {
      if (this.finishingBatches.has(batch.id)) continue;

      const finishing = this.finishBatch(batch)
        .catch((error) => {
          console.error(
            `AppError[PackTags] could not finish batch ${batch.id}.`,
            error,
          );
        })
        .finally(() => this.finishingBatches.delete(batch.id));
      this.finishingBatches.set(batch.id, finishing);
    }
  }

  private async finishBatch(batch: BatchToFinish): Promise<void> {
    await this.deps.repository.markBatchTagged(batch.id);

    const targets = await this.deps.repository.findSearchTargets(
      batch.orderIds,
    );
    const checks = [
      ...[...targets.byPackTag].flatMap(([packTag, orderIds]) =>
        searchIndexChecks(`tag:${packTag}`, orderIds),
      ),
      ...searchIndexChecks(`tag_not:${PACKED_ORDER_TAG}`, targets.inNoPack),
    ];
    // never throws: after its timeout the batch finishes anyway
    await this.deps.waitForSearch(this.deps.getAdmin(batch.shop), checks);

    await this.deps.repository.markBatchFinished(batch.id);
  }

  private async cleanUp(): Promise<void> {
    const now = this.deps.now();
    if (now - this.lastCleanupAt < TICK_MS) return;

    this.lastCleanupAt = now;
    await this.deps.repository.deleteBatchesFinishedBefore(
      new Date(now - BATCH_RETENTION_MS),
    );
  }
}

/** Throttled calls throw the Response itself, not an Error. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Response) {
    return `HTTP ${error.status} ${error.statusText}`.trim();
  }
  return String(error);
}

function createDefaultDeps(): PackTagWorkerDeps {
  // one long-lived client per shop: it refreshes its own token
  const adminByShop = new Map<string, AdminApiContextWithoutRest>();

  return {
    repository: PackTagSyncRepository,
    getAdmin: (shop) => {
      let admin = adminByShop.get(shop);
      if (!admin) {
        admin = createJobAdmin(shop);
        adminByShop.set(shop, admin);
      }
      return admin;
    },
    applyTags: applyTagSync,
    waitForSearch: waitForSearchIndex,
    now: Date.now,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var packTagWorkerGlobal: PackTagWorker | undefined;
}

/**
 * The process's worker. Kept on `globalThis` so a dev-server reload does not
 * start a second one on the same queue.
 */
export const packTagWorker: PackTagWorker = (globalThis.packTagWorkerGlobal ??=
  new PackTagWorker(createDefaultDeps()));
