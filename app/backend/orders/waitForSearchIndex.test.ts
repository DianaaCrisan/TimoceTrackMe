import { describe, expect, it, vi } from "vitest";
import {
  searchIndexChecks,
  waitForSearchIndex,
} from "./waitForSearchIndex.server";

const admin = { graphql: vi.fn() };

describe("searchIndexChecks", () => {
  it("searches the orders by numeric ID, 50 per check", () => {
    const ids = Array.from(
      { length: 51 },
      (_, i) => `gid://shopify/Order/${i + 1}`,
    );
    const checks = searchIndexChecks("tag:cod-postal-de-corectat", ids);

    expect(checks).toHaveLength(2);
    expect(checks[1]).toEqual({
      query: "tag:cod-postal-de-corectat AND (id:51)",
      expectedCount: 1,
    });
    expect(checks[0].expectedCount).toBe(50);
    expect(checks[0].query).toMatch(/^tag:cod-postal-de-corectat AND \(id:1 OR id:2 OR /);
  });
});

describe("waitForSearchIndex", () => {
  it("waits until every check matches its orders", async () => {
    const counts = [0, 1, 2];
    const count = vi.fn(async () => counts.shift() ?? 2);
    const sleep = vi.fn(async () => {});

    expect(
      await waitForSearchIndex(
        admin,
        [{ query: "q", expectedCount: 2 }],
        { count, sleep, now: () => 0 },
      ),
    ).toEqual({ isCaughtUp: true });
    expect(count).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gives up after the timeout", async () => {
    let time = 0;
    const result = await waitForSearchIndex(
      admin,
      [{ query: "q", expectedCount: 1 }],
      {
        count: async () => 0,
        sleep: async (ms) => {
          time += ms;
        },
        now: () => time,
        timeoutMs: 5000,
        intervalMs: 1500,
      },
    );

    expect(result).toEqual({ isCaughtUp: false });
    expect(time).toBeGreaterThanOrEqual(4500);
  });

  it("finishes at once when there is nothing to wait for, or counting fails", async () => {
    const count = vi.fn(async () => {
      throw new Error("throttled");
    });

    expect(await waitForSearchIndex(admin, [], { count })).toEqual({
      isCaughtUp: true,
    });
    expect(
      await waitForSearchIndex(admin, [{ query: "q", expectedCount: 1 }], {
        count,
        sleep: async () => {},
      }),
    ).toEqual({ isCaughtUp: false });
  });
});
