import { describe, expect, it, vi } from "vitest";
import { formatFileSize } from "app/commons/documents/Documents";
import { listDocuments, readStoredFileName } from "./listDocuments.server";
import { encodeOrderListMetadata } from "./orderListMetadata";

vi.mock("../aws-s3/uploadToS3.server", () => ({
  listS3Objects: vi.fn(),
  getDownloadUrl: vi.fn(),
  readS3Metadata: vi.fn(),
}));

const object = (key: string, day: number, sizeBytes = 1000) => ({
  key,
  lastModified: new Date(Date.UTC(2026, 10, day, 12)),
  sizeBytes,
});

function deps(objects: ReturnType<typeof object>[]) {
  return {
    list: vi.fn(async () => objects),
    sign: vi.fn(async (key: string) => `https://s3.test/${key}`),
    readMetadata: vi.fn(
      async (key: string): Promise<Record<string, string>> =>
        key.includes("18.11")
          ? encodeOrderListMetadata(["#1201", "#1202", "#1203", "#1209"])
          : {},
    ),
    appFolderKey: "TrackMe/",
  };
}

describe("listDocuments", () => {
  it("lists the label zips newest first, without failed jobs' files", async () => {
    const d = deps([
      object(
        "TrackMe/print-labels/2026-11-10/09-00-00_aaaa1111_labels_10.11.zip",
        10,
      ),
      object(
        "TrackMe/print-labels/2026-11-12/09-00-00_bbbb2222_ESUAT_printare-etichete.txt",
        12,
      ),
      object(
        "TrackMe/print-labels/2026-11-18/16-07-02_cccc3333_labels_18.11.zip",
        18,
        2048,
      ),
    ]);

    const [labels] = await listDocuments({}, d);

    expect(d.list).toHaveBeenCalledWith("TrackMe/print-labels/");
    expect(labels.id).toBe("labels");
    expect(labels.documents.map((doc) => doc.fileName)).toEqual([
      "labels_18.11.zip",
      "labels_10.11.zip",
    ]);
    expect(labels.documents[0]).toMatchObject({
      sizeBytes: 2048,
      storedAt: "2026-11-18T12:00:00.000Z",
      downloadUrl:
        "https://s3.test/TrackMe/print-labels/2026-11-18/16-07-02_cccc3333_labels_18.11.zip",
      orders: { ranges: "#1201-1203, #1209", count: 4 },
    });
    // saved before the order list was recorded
    expect(labels.documents[1].orders).toBeNull();
    expect(labels.total).toBe(2);
  });

  it("pages by 50 and signs only the page shown", async () => {
    const objects = Array.from({ length: 120 }, (_, i) =>
      object(
        `TrackMe/print-labels/d/00-00-00_id${i}_labels_${i}.zip`,
        1 + (i % 28),
      ),
    );
    const d = deps(objects);

    const [labels] = await listDocuments({ labels: 3 }, d);

    expect(labels).toMatchObject({ page: 3, pageCount: 3, total: 120 });
    expect(labels.documents).toHaveLength(20);
    expect(d.sign).toHaveBeenCalledTimes(20);
    expect(d.readMetadata).toHaveBeenCalledTimes(20);
  });

  it("keeps the page within range", async () => {
    const [labels] = await listDocuments(
      { labels: 99 },
      deps([object("TrackMe/print-labels/d/00-00-00_a_labels.zip", 1)]),
    );
    expect(labels).toMatchObject({ page: 1, pageCount: 1 });
  });

  it("says why when S3 cannot be read, e.g. without list permission", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps([]);
    d.list.mockRejectedValueOnce(
      Object.assign(new Error("not authorized to perform: s3:ListBucket"), {
        name: "AccessDenied",
      }),
    );
    d.list.mockRejectedValueOnce(new Error("socket hang up"));

    const [denied] = await listDocuments({}, d);
    const [failed] = await listDocuments({}, d);

    expect(denied).toMatchObject({
      documents: [],
      error: { kind: "accessDenied" },
    });
    expect(failed.error).toEqual({ kind: "other", message: "socket hang up" });
  });

  it("still lists a document whose order list could not be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps([
      object("TrackMe/print-labels/d/00-00-00_a_labels_18.11.zip", 1),
    ]);
    d.readMetadata.mockRejectedValueOnce(new Error("Forbidden"));

    const [labels] = await listDocuments({}, d);

    expect(labels.documents[0]).toMatchObject({ orders: null });
    expect(labels.documents[0].downloadUrl).not.toBeNull();
  });

  it("still lists a document whose link could not be signed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps([object("TrackMe/print-labels/d/00-00-00_a_labels.zip", 1)]);
    d.sign.mockRejectedValueOnce(new Error("no credentials"));

    const [labels] = await listDocuments({}, d);

    expect(labels.documents[0].downloadUrl).toBeNull();
  });
});

describe("readStoredFileName", () => {
  it("drops the time and run id the job put in front", () => {
    expect(
      readStoredFileName(
        "App/print-labels/2026-11-18/16-07-02_a1b2c3d4_etichete_18.11.2026.zip",
      ),
    ).toBe("etichete_18.11.2026.zip");
  });

  it("keeps a name without that prefix as it is", () => {
    expect(readStoredFileName("App/print-labels/2026-11-18/other.zip")).toBe(
      "other.zip",
    );
  });
});

describe("formatFileSize", () => {
  it("reads like a download size", () => {
    expect(formatFileSize(512, "en")).toBe("512 B");
    expect(formatFileSize(820 * 1024, "en")).toBe("820 KB");
    expect(formatFileSize(1.4 * 1024 * 1024, "ro")).toBe("1,4 MB");
  });
});
