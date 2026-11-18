import { describe, expect, it } from "vitest";
import { buildRowActivities } from "./buildRowActivities";

describe("buildRowActivities", () => {
  it("gives each row its most telling reason", () => {
    const pack = { day: "2026-11-18", daySequence: 1 };

    expect(
      buildRowActivities({
        jobOwners: new Map([["in-job", "add-tracking"]]),
        pendingTags: new Map([
          ["joining", pack],
          ["leaving", null],
          ["in-job", pack],
        ]),
        staleOrderIds: ["stale", "joining", "in-job"],
      }),
    ).toEqual({
      "in-job": { kind: "inJob", job: "add-tracking" },
      joining: { kind: "joiningPack", pack },
      leaving: { kind: "leavingPack" },
      stale: { kind: "stale" },
    });
  });

  it("leaves settled rows out", () => {
    expect(
      buildRowActivities({
        jobOwners: new Map(),
        pendingTags: new Map(),
        staleOrderIds: [],
      }),
    ).toEqual({});
  });
});
