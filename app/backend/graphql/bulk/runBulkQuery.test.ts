import { describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../../core/types/AdminApiContextWithoutRest";
import {
  BulkQueryError,
  parseJsonl,
  runBulkQuery,
} from "./runBulkQuery.server";

const admin = {} as AdminApiContextWithoutRest;
const SHOP = "https://admin.shopify.com/store/timoce";
const QUERY = "{ fulfillmentOrders { edges { node { id } } } }";

type Responses = Record<string, unknown[]>;

/** Answers each operation with its next response, in order. */
function setup(responses: Responses, fileText = "") {
  let clock = 0;
  const calls: string[] = [];
  const runGraphQL = vi.fn(async (_admin, _shop, opName: string) => {
    calls.push(opName);
    const queue = responses[opName];
    if (!queue?.length) throw new Error(`No response left for ${opName}`);
    return queue.length > 1 ? queue.shift() : queue[0];
  });

  return {
    calls,
    deps: {
      runGraphQL: runGraphQL as never,
      fetchText: vi.fn(async () => fileText),
      sleep: vi.fn(async (ms: number) => {
        clock += ms;
      }),
      now: () => clock,
    },
  };
}

const started = (id: string) => ({
  bulkOperationRunQuery: {
    bulkOperation: { id, status: "CREATED" },
    userErrors: [],
  },
});
const inProgress = {
  bulkOperationRunQuery: {
    bulkOperation: null,
    userErrors: [
      {
        code: "OPERATION_IN_PROGRESS",
        field: null,
        message:
          "A bulk query operation for this app and shop is already in progress",
      },
    ],
  },
};
const status = (id: string, value: string, url: string | null = null) => ({
  node: { id, status: value, errorCode: null, objectCount: "2", url },
});

describe("runBulkQuery", () => {
  it("starts the query, waits for it and returns the parsed lines", async () => {
    const { deps, calls } = setup(
      {
        RunBulkQuery: [started("op1")],
        BulkOperationStatus: [
          status("op1", "RUNNING"),
          status("op1", "COMPLETED", "https://files/op1.jsonl"),
        ],
      },
      '{"id":"a"}\n{"id":"b","__parentId":"a"}\n',
    );

    await expect(runBulkQuery(admin, SHOP, QUERY, {}, deps)).resolves.toEqual([
      { id: "a" },
      { id: "b", __parentId: "a" },
    ]);
    expect(calls).toEqual([
      "RunBulkQuery",
      "BulkOperationStatus",
      "BulkOperationStatus",
    ]);
    expect(deps.fetchText).toHaveBeenCalledWith("https://files/op1.jsonl");
  });

  it("returns nothing when the result is empty", async () => {
    const { deps } = setup({
      RunBulkQuery: [started("op1")],
      BulkOperationStatus: [status("op1", "COMPLETED", null)],
    });

    await expect(runBulkQuery(admin, SHOP, QUERY, {}, deps)).resolves.toEqual(
      [],
    );
    expect(deps.fetchText).not.toHaveBeenCalled();
  });

  it("uses the running operation when it is the same query", async () => {
    const { deps, calls } = setup(
      {
        RunBulkQuery: [inProgress],
        CurrentBulkQueryOperation: [
          {
            currentBulkOperation: {
              id: "theirs",
              status: "RUNNING",
              query: `  ${QUERY.replace(/ /g, "\n ")}  `,
            },
          },
        ],
        BulkOperationStatus: [
          status("theirs", "COMPLETED", "https://files/theirs.jsonl"),
        ],
      },
      '{"id":"a"}',
    );

    await expect(runBulkQuery(admin, SHOP, QUERY, {}, deps)).resolves.toEqual([
      { id: "a" },
    ]);
    expect(calls).toEqual([
      "RunBulkQuery",
      "CurrentBulkQueryOperation",
      "BulkOperationStatus",
    ]);
  });

  it("waits for a different running query, then starts its own", async () => {
    const { deps, calls } = setup(
      {
        RunBulkQuery: [inProgress, started("mine")],
        CurrentBulkQueryOperation: [
          {
            currentBulkOperation: {
              id: "other",
              status: "RUNNING",
              query: "{ products { edges { node { id } } } }",
            },
          },
        ],
        BulkOperationStatus: [
          status("other", "COMPLETED", "https://files/other.jsonl"),
          status("mine", "COMPLETED", "https://files/mine.jsonl"),
        ],
      },
      '{"id":"mine"}',
    );

    await runBulkQuery(admin, SHOP, QUERY, {}, deps);

    expect(calls).toEqual([
      "RunBulkQuery",
      "CurrentBulkQueryOperation",
      "BulkOperationStatus",
      "RunBulkQuery",
      "BulkOperationStatus",
    ]);
    expect(deps.fetchText).toHaveBeenCalledWith("https://files/mine.jsonl");
  });

  it("reports a busy shop when the second start is refused too", async () => {
    const { deps } = setup({
      RunBulkQuery: [inProgress],
      CurrentBulkQueryOperation: [{ currentBulkOperation: null }],
    });

    await expect(
      runBulkQuery(admin, SHOP, QUERY, {}, deps),
    ).rejects.toMatchObject({ reason: "busy" });
  });

  it("fails when the operation fails", async () => {
    const { deps } = setup({
      RunBulkQuery: [started("op1")],
      BulkOperationStatus: [
        { node: { ...status("op1", "FAILED").node, errorCode: "TIMEOUT" } },
      ],
    });

    const error = await runBulkQuery(admin, SHOP, QUERY, {}, deps).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(BulkQueryError);
    expect(error).toMatchObject({
      reason: "failed",
      message: "Bulk operation ended as FAILED (TIMEOUT).",
    });
  });

  it("gives up waiting after the timeout", async () => {
    const { deps } = setup({
      RunBulkQuery: [started("op1")],
      BulkOperationStatus: [status("op1", "RUNNING")],
    });

    await expect(
      runBulkQuery(admin, SHOP, QUERY, { timeoutMs: 5000 }, deps),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("fails on other user errors", async () => {
    const { deps } = setup({
      RunBulkQuery: [
        {
          bulkOperationRunQuery: {
            bulkOperation: null,
            userErrors: [
              { code: "INVALID", field: ["query"], message: "Bad query" },
            ],
          },
        },
      ],
    });

    await expect(runBulkQuery(admin, SHOP, QUERY, {}, deps)).rejects.toThrow(
      "Shopify refused the bulk query: Bad query",
    );
  });
});

describe("runBulkQuery access", () => {
  it("says so when the app may not run bulk queries yet", async () => {
    const { deps } = setup({});
    deps.runGraphQL = vi.fn(async () => {
      throw new Error(
        "GraphQLBusinessError for request 'RunBulkQuery': Access denied for bulkOperationRunQuery field. Required access: Only accessible by supported access tokens.",
      );
    }) as never;

    await expect(
      runBulkQuery(admin, SHOP, QUERY, {}, deps),
    ).rejects.toMatchObject({ reason: "notEnabled" });
  });
});

describe("parseJsonl", () => {
  it("skips blank lines", () => {
    expect(parseJsonl('{"a":1}\n\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
