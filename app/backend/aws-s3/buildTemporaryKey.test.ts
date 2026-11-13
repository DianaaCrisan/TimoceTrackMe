import { describe, expect, it } from "vitest";
import { buildTemporaryKey, safeObjectName } from "./buildTemporaryKey";

describe("buildTemporaryKey", () => {
  it("prefixes the app name and files the object under the job and day", () => {
    expect(
      buildTemporaryKey({
        job: "print-labels",
        createdAt: new Date("2026-11-13T10:00:00Z"),
        id: "abc",
        fileName: "labels.zip",
        appName: "TrackMeDev",
      }),
    ).toBe("TrackMeDev/temporary-files/print-labels/2026/11/13/abc-labels.zip");
  });

  it("uses the shop's day, not the UTC day", () => {
    // 23:30 UTC on the 12th is 01:30 on the 13th in Bucharest
    expect(
      buildTemporaryKey({
        job: "add-tracking",
        createdAt: new Date("2026-11-12T23:30:00Z"),
        id: "abc",
        fileName: "report.xlsx",
        appName: "TrackMe",
      }),
    ).toBe("TrackMe/temporary-files/add-tracking/2026/11/13/abc-report.xlsx");
  });

  it("leaves out the prefix when there is no app name", () => {
    expect(
      buildTemporaryKey({
        job: "test",
        createdAt: new Date("2026-11-13T10:00:00Z"),
        id: "abc",
        fileName: "a.txt",
        appName: "",
      }),
    ).toBe("temporary-files/test/2026/11/13/abc-a.txt");
  });
});

describe("safeObjectName", () => {
  it("replaces characters that are unsafe in keys and keeps the extension", () => {
    expect(safeObjectName("etichete 13 nov/2026 #1.pdf")).toBe(
      "etichete_13_nov_2026__1.pdf",
    );
  });

  it("never returns an empty or hidden name", () => {
    expect(safeObjectName("")).toBe("file");
    expect(safeObjectName("..pdf")).toBe("pdf");
  });
});
