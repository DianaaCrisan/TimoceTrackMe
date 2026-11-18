import { describe, expect, it } from "vitest";
import type {
  RecentJobView,
  RecentJobsSnapshot,
} from "app/commons/jobs/RecentJobView";
import type { PackTagBatchView } from "app/commons/packs/PackTagBatchView";
import { advanceWatch, batchKey, jobKey } from "./watchBackgroundWork";

const job = (id: string, status: RecentJobView["status"]): RecentJobView => ({
  id,
  job: "add-tracking",
  title: "Add tracking numbers",
  orderCount: 3,
  startedAt: "2026-11-18T10:00:00Z",
  status,
  downloadUrl: null,
});

const batch = (id: string, finishedAt: string | null): PackTagBatchView => ({
  id,
  kind: "addOrders",
  pack: null,
  orderCount: 45,
  doneCount: finishedAt ? 45 : 10,
  failedCount: 0,
  createdAt: "2026-11-18T10:00:00Z",
  taggedAt: finishedAt,
  finishedAt,
});

const snapshot = (
  jobs: RecentJobView[],
  tagBatches: PackTagBatchView[] = [],
): RecentJobsSnapshot => ({ jobs, tagBatches, generatedAt: 1 });

describe("advanceWatch", () => {
  it("reports work that was running and has now finished", () => {
    const first = advanceWatch(
      new Map(),
      snapshot([job("j1", "running")], [batch("b1", null)]),
    );
    expect(first.finished).toBeNull();

    const second = advanceWatch(
      first.watched,
      snapshot([job("j1", "succeeded")], [batch("b1", "2026-11-18T10:01:00Z")]),
    );
    expect(second.finished?.jobs.map((j) => j.id)).toEqual(["j1"]);
    expect(second.finished?.tagBatches.map((b) => b.id)).toEqual(["b1"]);
    expect(second.watched.size).toBe(0);
  });

  it("ignores work that was already finished when the page loaded", () => {
    const result = advanceWatch(
      new Map(),
      snapshot([job("j1", "succeeded")], [batch("b1", "2026-11-18T10:01:00Z")]),
    );
    expect(result.finished).toBeNull();
  });

  it("reports followed work that finished before any snapshot saw it run", () => {
    const followed = new Map([[batchKey("b1"), 0]]);
    const result = advanceWatch(
      followed,
      snapshot([], [batch("b1", "2026-11-18T10:01:00Z")]),
    );
    expect(result.finished?.tagBatches.map((b) => b.id)).toEqual(["b1"]);
  });

  it("gives followed work one missing snapshot before counting it as done", () => {
    const followed = new Map([[jobKey("j9"), 0]]);

    const first = advanceWatch(followed, snapshot([]));
    expect(first.finished).toBeNull();
    expect(first.watched.get(jobKey("j9"))).toBe(1);

    const second = advanceWatch(first.watched, snapshot([]));
    expect(second.finished?.unseenCount).toBe(1);
    expect(second.watched.size).toBe(0);
  });

  it("keeps waiting on followed work that is running", () => {
    const followed = new Map([[jobKey("j1"), 1]]);
    const result = advanceWatch(followed, snapshot([job("j1", "running")]));
    expect(result.finished).toBeNull();
    expect(result.watched.get(jobKey("j1"))).toBe(0);
  });
});
