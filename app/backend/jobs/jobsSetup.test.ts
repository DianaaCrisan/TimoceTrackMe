import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDownloadUrl } from "../aws-s3/uploadToS3.server";
import { jobRegistry } from "./JobRegistry";
import {
  DOWNLOAD_LINK_EXPIRES_IN_SECONDS,
  getRecentJobsSnapshot,
} from "./jobsSetup.server";

vi.mock("../aws-s3/uploadToS3.server", () => ({
  uploadToS3: vi.fn(),
  assertS3Configured: vi.fn(),
  getDownloadUrl: vi.fn(),
}));

describe("getRecentJobsSnapshot", () => {
  beforeEach(() => {
    vi.mocked(getDownloadUrl).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("signs a one-hour download link per stored file", async () => {
    vi.mocked(getDownloadUrl).mockResolvedValue("https://s3.test/signed");
    jobRegistry.add({
      id: "with-file",
      job: "print-labels",
      title: "Print labels",
      orderCount: 3,
      startedAt: "2026-11-14T10:00:00.000Z",
      status: "succeeded",
      s3Key: "TrackMe/print-labels/2026-11-14/12-00-00_abc_labels.zip",
      fileName: "labels.zip",
    });
    jobRegistry.add({
      id: "running",
      job: "add-tracking",
      title: "Add tracking numbers",
      orderCount: 3,
      startedAt: "2026-11-14T10:01:00.000Z",
      status: "running",
    });

    const { jobs } = await getRecentJobsSnapshot();

    expect(DOWNLOAD_LINK_EXPIRES_IN_SECONDS).toBe(3600);
    expect(getDownloadUrl).toHaveBeenCalledTimes(1);
    expect(getDownloadUrl).toHaveBeenCalledWith({
      key: "TrackMe/print-labels/2026-11-14/12-00-00_abc_labels.zip",
      fileName: "labels.zip",
      expiresInSeconds: 3600,
    });
    expect(jobs.find((job) => job.id === "with-file")?.downloadUrl).toBe(
      "https://s3.test/signed",
    );
    expect(jobs.find((job) => job.id === "running")?.downloadUrl).toBeNull();
  });

  it("still lists the jobs when a link cannot be signed", async () => {
    vi.mocked(getDownloadUrl).mockRejectedValue(
      new Error("Missing required environment variable: AWS_BUCKET"),
    );

    const { jobs } = await getRecentJobsSnapshot();

    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((job) => job.downloadUrl === null)).toBe(true);
  });
});
