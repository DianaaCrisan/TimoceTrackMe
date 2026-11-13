import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderJobLocks } from "./OrderJobLocks";
import {
  startEmailJob,
  type EmailJobArtifact,
  type StartEmailJobInput,
} from "./startEmailJob.server";

// The real S3 and ZeptoMail clients are replaced through `deps`. Mocked here
// only so the AWS SDK is not loaded: Vitest resolves its ESM build, whose
// extensionless imports fail outside a bundler.
vi.mock("../aws-s3/uploadAndGetDownloadLink.server", () => ({
  uploadAndGetDownloadLink: vi.fn(),
}));
vi.mock("../zepto-mail/sendEmailViaZeptoMail.server", () => ({
  sendEmailViaZeptoMail: vi.fn(),
}));

const RECIPIENT = "jobs@example.com";

const artifact: EmailJobArtifact = {
  buf: Buffer.from("file"),
  fileName: "labels.zip",
  contentType: "application/zip",
  subject: "Labels ready",
};

function setup() {
  let markFinished!: () => void;
  const finished = new Promise<void>((resolve) => (markFinished = resolve));

  const deps = {
    uploadAndGetDownloadLink: vi.fn(async () => "https://s3.test/link?sig=1"),
    sendEmail: vi.fn(async () => undefined),
    locks: new OrderJobLocks(),
    now: () => new Date("2026-11-13T10:00:00Z"),
    newId: () => "id-1",
    onFinished: markFinished,
  };

  return { deps, finished };
}

function jobInput(
  overrides: Partial<StartEmailJobInput> = {},
): StartEmailJobInput {
  return {
    job: "print-labels",
    title: "Print labels",
    orderIds: ["order-1", "order-2"],
    build: async () => artifact,
    ...overrides,
  };
}

describe("startEmailJob", () => {
  beforeEach(() => {
    vi.stubEnv("JOB_RESULT_EMAIL", RECIPIENT);
    vi.stubEnv("APP_NAME", "TrackMeTest");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uploads the file and emails the download link", async () => {
    const { deps, finished } = setup();

    const result = startEmailJob(jobInput(), deps);
    expect(result).toEqual({ isStarted: true, recipient: RECIPIENT });
    await finished;

    expect(deps.uploadAndGetDownloadLink).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "TrackMeTest/temporary-files/print-labels/2026/11/13/id-1-labels.zip",
        fileName: "labels.zip",
        contentType: "application/zip",
        expiresInSeconds: 24 * 60 * 60,
      }),
    );
    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [RECIPIENT],
        subject: "Labels ready",
        htmlBody: expect.stringContaining('href="https://s3.test/link?sig=1"'),
      }),
    );
  });

  it("adds the summary and an error warning when the result has errors", async () => {
    const { deps, finished } = setup();

    startEmailJob(
      jobInput({
        build: async () => ({
          ...artifact,
          summaryHtml: "<p>2 orders</p>",
          hasErrors: true,
        }),
      }),
      deps,
    );
    await finished;

    const [{ htmlBody }] = deps.sendEmail.mock.calls[0] as unknown as [
      { htmlBody: string },
    ];
    expect(htmlBody).toContain("<p>2 orders</p>");
    expect(htmlBody).toContain("Some orders had errors");
  });

  it("emails the error when the build fails, escaping it", async () => {
    const { deps, finished } = setup();

    startEmailJob(
      jobInput({
        build: async () => {
          throw new Error("Optimus said <nope>");
        },
      }),
      deps,
    );
    await finished;

    expect(deps.uploadAndGetDownloadLink).not.toHaveBeenCalled();
    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "[Failed] Print labels",
        htmlBody: expect.stringContaining("Optimus said &lt;nope&gt;"),
      }),
    );
  });

  it("refuses to start when another job holds any of the orders", () => {
    const { deps } = setup();
    deps.locks.tryLock(["order-2"]);
    const build = vi.fn(async () => artifact);

    const result = startEmailJob(jobInput({ build }), deps);

    expect(result).toEqual({ isStarted: false, busyOrderIds: ["order-2"] });
    expect(build).not.toHaveBeenCalled();
  });

  it("unlocks the orders once the job is over", async () => {
    const { deps, finished } = setup();

    startEmailJob(jobInput(), deps);
    expect(deps.locks.tryLock(["order-1"]).isLocked).toBe(false);
    await finished;

    expect(deps.locks.tryLock(["order-1", "order-2"]).isLocked).toBe(true);
  });

  it("fails the request, without locking, when no recipient is configured", () => {
    vi.stubEnv("JOB_RESULT_EMAIL", "");
    const { deps } = setup();

    expect(() => startEmailJob(jobInput(), deps)).toThrow("JOB_RESULT_EMAIL");
    expect(deps.locks.tryLock(["order-1"]).isLocked).toBe(true);
  });

  it("on timeout sends only the failure email and keeps the orders locked until the build stops", async () => {
    const { deps, finished } = setup();
    let finishBuild!: () => void;
    const build = () =>
      new Promise<EmailJobArtifact>((resolve) => {
        finishBuild = () => resolve(artifact);
      });

    startEmailJob(jobInput({ build, timeoutMs: 5 }), deps);

    await vi.waitFor(() => expect(deps.sendEmail).toHaveBeenCalledTimes(1));
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "[Failed] Print labels" }),
    );
    expect(deps.locks.tryLock(["order-1"]).isLocked).toBe(false);

    finishBuild();
    await finished;

    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
    expect(deps.locks.tryLock(["order-1"]).isLocked).toBe(true);
  });

  it("does not send a second email when the success email itself fails", async () => {
    const { deps, finished } = setup();
    deps.sendEmail.mockRejectedValueOnce(new Error("ZeptoMail down"));

    startEmailJob(jobInput(), deps);
    await finished;

    expect(deps.sendEmail).toHaveBeenCalledTimes(1);
  });
});
