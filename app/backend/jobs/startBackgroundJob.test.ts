import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobRegistry } from "./JobRegistry";
import { OrderJobLocks } from "./OrderJobLocks";
import {
  startBackgroundJob,
  type JobArtifact,
  type StartBackgroundJobInput,
} from "./startBackgroundJob.server";

// The real S3 client is replaced through `deps`. Mocked here only so the AWS
// SDK is not loaded: Vitest resolves its ESM build, whose extensionless imports
// fail outside a bundler.
vi.mock("../aws-s3/uploadToS3.server", () => ({
  uploadToS3: vi.fn(),
  assertS3Configured: vi.fn(),
}));

const artifact: JobArtifact = {
  buf: Buffer.from("file"),
  fileName: "labels.zip",
  contentType: "application/zip",
  summary: "2 labels",
};

function setup() {
  let markFinished!: () => void;
  const finished = new Promise<void>((resolve) => (markFinished = resolve));

  const deps = {
    uploadToS3: vi.fn(async () => undefined),
    assertS3Configured: vi.fn(),
    locks: new OrderJobLocks(),
    registry: new JobRegistry(),
    now: () => new Date("2026-11-13T12:35:02Z"),
    newId: () => "a1b2c3d4-0000",
    onFinished: markFinished,
  };

  return { deps, finished };
}

function jobInput(
  overrides: Partial<StartBackgroundJobInput> = {},
): StartBackgroundJobInput {
  return {
    job: "print-labels",
    title: "Print labels",
    orderIds: ["order-1", "order-2"],
    build: async () => artifact,
    ...overrides,
  };
}

describe("startBackgroundJob", () => {
  beforeEach(() => {
    vi.stubEnv("APP_NAME", "TrackMeTest");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uploads the result and records where it is", async () => {
    const { deps, finished } = setup();

    const result = startBackgroundJob(jobInput(), deps);
    expect(result).toEqual({ isStarted: true, jobId: "a1b2c3d4-0000" });
    expect(deps.registry.list()[0]).toMatchObject({
      status: "running",
      title: "Print labels",
      orderCount: 2,
    });
    await finished;

    const key =
      "TrackMeTest/print-labels/2026-11-13/14-35-02_a1b2c3d4_labels.zip";
    expect(deps.uploadToS3).toHaveBeenCalledWith({
      buf: artifact.buf,
      key,
      contentType: "application/zip",
    });
    expect(deps.registry.list()[0]).toMatchObject({
      status: "succeeded",
      s3Key: key,
      summary: "2 labels",
      hasErrors: false,
    });
  });

  it("stores a FAILED_ file with the error when the build fails", async () => {
    const { deps, finished } = setup();

    startBackgroundJob(
      jobInput({
        build: async () => {
          throw new Error("Optimus is down");
        },
      }),
      deps,
    );
    await finished;

    const failureKey =
      "TrackMeTest/print-labels/2026-11-13/14-35-02_a1b2c3d4_FAILED_print-labels.txt";
    expect(deps.uploadToS3).toHaveBeenCalledTimes(1);
    expect(deps.uploadToS3).toHaveBeenCalledWith(
      expect.objectContaining({
        key: failureKey,
        contentType: "text/plain; charset=utf-8",
      }),
    );
    const failureText = (
      deps.uploadToS3.mock.calls[0] as unknown as [{ buf: Buffer }]
    )[0].buf.toString("utf8");
    expect(failureText).toContain("Error: Optimus is down");
    expect(failureText).toContain("order-1");
    expect(deps.registry.list()[0]).toMatchObject({
      status: "failed",
      error: "Optimus is down",
      s3Key: failureKey,
    });
  });

  it("still records the failure when even the failure file cannot be stored", async () => {
    const { deps, finished } = setup();
    deps.uploadToS3.mockRejectedValue(new Error("AccessDenied"));

    startBackgroundJob(jobInput(), deps);
    await finished;

    expect(deps.registry.list()[0]).toMatchObject({
      status: "failed",
      error: "AccessDenied",
      s3Key: undefined,
    });
  });

  it("refuses to start when another job holds any of the orders", () => {
    const { deps } = setup();
    deps.locks.tryLock(["order-2"]);
    const build = vi.fn(async () => artifact);

    const result = startBackgroundJob(jobInput({ build }), deps);

    expect(result).toEqual({ isStarted: false, busyOrderIds: ["order-2"] });
    expect(build).not.toHaveBeenCalled();
    expect(deps.registry.list()).toEqual([]);
  });

  it("keeps the orders locked until the build stops, then unlocks them", async () => {
    const { deps, finished } = setup();
    let finishBuild!: () => void;
    const build = () =>
      new Promise<JobArtifact>((resolve) => {
        finishBuild = () => resolve(artifact);
      });

    startBackgroundJob(jobInput({ build }), deps);
    expect(deps.locks.tryLock(["order-1"]).isLocked).toBe(false);

    finishBuild();
    await finished;

    expect(deps.locks.tryLock(["order-1", "order-2"]).isLocked).toBe(true);
  });

  it("fails the request, without locking, when S3 is not configured", () => {
    const { deps } = setup();
    deps.assertS3Configured.mockImplementation(() => {
      throw new Error("Missing required environment variable: AWS_BUCKET");
    });

    expect(() => startBackgroundJob(jobInput(), deps)).toThrow("AWS_BUCKET");
    expect(deps.locks.tryLock(["order-1"]).isLocked).toBe(true);
    expect(deps.registry.list()).toEqual([]);
  });
});
