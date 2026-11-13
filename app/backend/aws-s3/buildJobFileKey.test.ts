import { describe, expect, it } from "vitest";
import {
  buildAppFolderKey,
  buildJobFileKey,
  buildJobFolderKey,
  safeObjectName,
} from "./buildJobFileKey";

describe("buildJobFileKey", () => {
  it("files the object under app, job and day, named by start time", () => {
    expect(
      buildJobFileKey({
        job: "print-labels",
        startedAt: new Date("2026-11-13T12:35:02Z"),
        id: "a1b2c3d4-e5f6-7890",
        fileName: "labels.zip",
        appName: "TrackMeDev",
      }),
    ).toBe("TrackMeDev/print-labels/2026-11-13/14-35-02_a1b2c3d4_labels.zip");
  });

  it("uses the shop's day and time, not UTC", () => {
    // 23:30 UTC on the 12th is 01:30 on the 13th in Bucharest
    expect(
      buildJobFileKey({
        job: "add-tracking",
        startedAt: new Date("2026-11-12T23:30:00Z"),
        id: "abc",
        fileName: "report.xlsx",
        appName: "TrackMe",
      }),
    ).toBe("TrackMe/add-tracking/2026-11-13/01-30-00_abc_report.xlsx");
  });

  it("leaves out the app folder when there is no app name", () => {
    expect(
      buildJobFolderKey("test", new Date("2026-11-13T10:00:00Z"), ""),
    ).toBe("test/2026-11-13/");
    expect(buildAppFolderKey("")).toBe("");
    expect(buildAppFolderKey("TrackMe/")).toBe("TrackMe/");
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
