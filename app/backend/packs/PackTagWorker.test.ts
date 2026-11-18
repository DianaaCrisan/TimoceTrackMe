import { describe, expect, it, vi } from "vitest";
import { PACKED_ORDER_TAG } from "app/commons/packs/FulfillmentPack";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type {
  BatchToFinish,
  PendingTagSync,
  SearchTargets,
} from "./PackTagSyncRepository.server";
import { PackTagWorker, type PackTagWorkerDeps } from "./PackTagWorker.server";

vi.mock("../jobs/createJobAdmin.server", () => ({ createJobAdmin: vi.fn() }));
vi.mock("./PackTagSyncRepository.server", () => ({
  PackTagSyncRepository: {},
}));

const SHOP = "timoce.myshopify.com";
const admin = {} as AdminApiContextWithoutRest;

type QueueRow = PendingTagSync & { status: "PENDING" | "FAILED" };

/** The queue in memory, with the repository's rules. */
function createFakeRepository(
  rows: QueueRow[],
  memberships: Record<string, { packId: string; packTag: string }>,
  batches: BatchToFinish[] = [],
) {
  const failures: { orderId: string; error: string }[] = [];
  const doneOrderIds: string[] = [];
  const taggedBatchIds: string[] = [];
  const finishedBatchIds: string[] = [];

  const repository: PackTagWorkerDeps["repository"] = {
    findPending: vi.fn(async (limit: number) =>
      rows.filter((row) => row.status === "PENDING").slice(0, limit),
    ),
    findMembership: vi.fn(
      async (orderId: string) => memberships[orderId] ?? null,
    ),
    markDone: vi.fn(async (sync: PendingTagSync) => {
      const index = rows.findIndex(
        (row) => row.orderId === sync.orderId && row.version === sync.version,
      );
      if (index >= 0) {
        rows.splice(index, 1);
        doneOrderIds.push(sync.orderId);
      }
    }),
    markFailed: vi.fn(async (sync: PendingTagSync, error: string) => {
      const row = rows.find(
        (candidate) =>
          candidate.orderId === sync.orderId &&
          candidate.version === sync.version,
      );
      if (row) row.status = "FAILED";
      failures.push({ orderId: sync.orderId, error });
    }),
    findBatchesToFinish: vi.fn(async () =>
      batches.filter(
        (batch) =>
          !finishedBatchIds.includes(batch.id) &&
          !rows.some(
            (row) => row.batchId === batch.id && row.status === "PENDING",
          ),
      ),
    ),
    markBatchTagged: vi.fn(async (id: string) => {
      taggedBatchIds.push(id);
    }),
    markBatchFinished: vi.fn(async (id: string) => {
      finishedBatchIds.push(id);
    }),
    findSearchTargets: vi.fn(async (orderIds: string[]) => {
      const targets: SearchTargets = { byPackTag: new Map(), inNoPack: [] };
      for (const orderId of orderIds) {
        const membership = memberships[orderId];
        if (!membership) {
          targets.inNoPack.push(orderId);
        } else {
          targets.byPackTag.set(membership.packTag, [
            ...(targets.byPackTag.get(membership.packTag) ?? []),
            orderId,
          ]);
        }
      }
      return targets;
    }),
    deleteBatchesFinishedBefore: vi.fn(async () => {}),
  };

  return {
    repository,
    failures,
    doneOrderIds,
    taggedBatchIds,
    finishedBatchIds,
  };
}

function row(orderId: string, overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    orderId,
    shop: SHOP,
    staleTags: [],
    version: 1,
    batchId: null,
    status: "PENDING",
    ...overrides,
  };
}

function createWorker(
  repository: PackTagWorkerDeps["repository"],
  overrides: Partial<PackTagWorkerDeps> = {},
) {
  const deps: PackTagWorkerDeps = {
    repository,
    getAdmin: () => admin,
    applyTags: vi.fn(async () => {}),
    waitForSearch: vi.fn(async () => ({ isCaughtUp: true })),
    now: () => 0,
    ...overrides,
  };
  return { worker: new PackTagWorker(deps), deps };
}

describe("PackTagWorker", () => {
  it("tags each order for the pack the database has it in now", async () => {
    const fake = createFakeRepository(
      [
        row("joined"),
        row("moved", { staleTags: ["pachet-a"] }),
        row("left", { staleTags: ["pachet-a"] }),
      ],
      {
        joined: { packId: "b", packTag: "pachet-b" },
        moved: { packId: "b", packTag: "pachet-b" },
      },
    );
    const { worker, deps } = createWorker(fake.repository);

    worker.kick();
    await worker.whenIdle();

    const calls = vi
      .mocked(deps.applyTags)
      .mock.calls.map((call) => [call[2], call[3]]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ["joined", { remove: [], add: ["pachet-b", PACKED_ORDER_TAG] }],
        [
          "moved",
          { remove: ["pachet-a"], add: ["pachet-b", PACKED_ORDER_TAG] },
        ],
        ["left", { remove: ["pachet-a", PACKED_ORDER_TAG], add: [] }],
      ]),
    );
    expect(fake.doneOrderIds.sort()).toEqual(["joined", "left", "moved"]);
  });

  it("marks an order failed and carries on with the others", async () => {
    const fake = createFakeRepository([row("bad"), row("good")], {
      bad: { packId: "b", packTag: "pachet-b" },
      good: { packId: "b", packTag: "pachet-b" },
    });
    const { worker } = createWorker(fake.repository, {
      applyTags: vi.fn(async (_admin, _shopUrl, orderId) => {
        if (orderId === "bad") throw new Error("Order not found");
      }),
    });

    worker.kick();
    await worker.whenIdle();

    expect(fake.failures).toEqual([
      { orderId: "bad", error: "Order not found" },
    ]);
    expect(fake.doneOrderIds).toEqual(["good"]);
  });

  it("records a throttled call's status, not [object Response]", async () => {
    const fake = createFakeRepository([row("throttled")], {});
    const { worker } = createWorker(fake.repository, {
      applyTags: vi.fn(async () => {
        throw new Response(null, {
          status: 429,
          statusText: "Too Many Requests",
        });
      }),
    });

    worker.kick();
    await worker.whenIdle();

    expect(fake.failures[0].error).toBe("HTTP 429 Too Many Requests");
  });

  it("runs again for work queued while it was running", async () => {
    const rows = [row("first")];
    const fake = createFakeRepository(rows, {});
    const kickAgain = { current: () => {} };
    const applyTags = vi.fn(
      async (_admin: unknown, _url: string, orderId: string) => {
        if (orderId === "first") {
          // the next change lands while this round is still tagging
          rows.push(row("second"));
          kickAgain.current();
        }
      },
    );
    const { worker } = createWorker(fake.repository, { applyTags });
    kickAgain.current = () => worker.kick();

    worker.kick();
    await worker.whenIdle();

    expect(fake.doneOrderIds).toEqual(["first", "second"]);
  });

  it("finishes a batch once Shopify search shows where its orders went", async () => {
    const joined = "gid://shopify/Order/1";
    const left = "gid://shopify/Order/2";
    const fake = createFakeRepository(
      [
        row(joined, { batchId: "batch-1" }),
        row(left, { batchId: "batch-1", staleTags: ["pachet-a"] }),
      ],
      { [joined]: { packId: "b", packTag: "pachet-b" } },
      [{ id: "batch-1", shop: SHOP, orderIds: [joined, left] }],
    );
    const { worker, deps } = createWorker(fake.repository);

    worker.kick();
    await worker.whenIdle();

    expect(fake.taggedBatchIds).toEqual(["batch-1"]);
    expect(vi.mocked(deps.waitForSearch).mock.calls[0][1]).toEqual([
      { query: "tag:pachet-b AND (id:1)", expectedCount: 1 },
      { query: `tag_not:${PACKED_ORDER_TAG} AND (id:2)`, expectedCount: 1 },
    ]);
    expect(fake.finishedBatchIds).toEqual(["batch-1"]);
  });

  it("does not finish a batch while any of its orders is pending", async () => {
    const fake = createFakeRepository(
      [row("gid://shopify/Order/1", { batchId: "batch-1" })],
      {},
      [{ id: "batch-1", shop: SHOP, orderIds: ["gid://shopify/Order/1"] }],
    );
    const { worker } = createWorker(fake.repository, {
      // while its order is being tagged, the batch is left alone
      applyTags: vi.fn(async () => {
        expect(fake.taggedBatchIds).toEqual([]);
      }),
    });

    worker.kick();
    await worker.whenIdle();

    expect(fake.finishedBatchIds).toEqual(["batch-1"]);
  });

  it("does not spin when the database keeps failing", async () => {
    const fake = createFakeRepository([row("stuck")], {});
    vi.mocked(fake.repository.findMembership).mockRejectedValue(
      new Error("connection refused"),
    );
    const { worker } = createWorker(fake.repository);

    worker.kick();
    await worker.whenIdle();

    expect(fake.repository.findPending).toHaveBeenCalledTimes(1);
  });
});
