import { describe, expect, it } from "vitest";
import { JobRegistry, type JobRecord } from "./JobRegistry";

function record(id: string, status: JobRecord["status"]): JobRecord {
  return {
    id,
    job: "test",
    title: "Test",
    orderCount: 0,
    startedAt: "2026-11-13T10:00:00.000Z",
    status,
  };
}

describe("JobRegistry", () => {
  it("lists the newest job first", () => {
    const registry = new JobRegistry();
    registry.add(record("1", "succeeded"));
    registry.add(record("2", "running"));

    expect(registry.list().map((job) => job.id)).toEqual(["2", "1"]);
  });

  it("updates a job in place", () => {
    const registry = new JobRegistry();
    registry.add(record("1", "running"));

    registry.update("1", { status: "failed", error: "boom" });

    expect(registry.list()[0]).toMatchObject({
      status: "failed",
      error: "boom",
    });
  });

  it("drops the oldest finished job when full, never a running one", () => {
    const registry = new JobRegistry(2);
    registry.add(record("old-running", "running"));
    registry.add(record("old-finished", "succeeded"));
    registry.add(record("new", "running"));

    expect(registry.list().map((job) => job.id)).toEqual([
      "new",
      "old-running",
    ]);
  });

  it("returns copies, so callers cannot change the stored jobs", () => {
    const registry = new JobRegistry();
    registry.add(record("1", "running"));

    registry.list()[0].status = "failed";

    expect(registry.list()[0].status).toBe("running");
  });
});
