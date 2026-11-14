import type {
  BulkOperationStatusQuery,
  CurrentBulkQueryOperationQuery,
  RunBulkQueryMutation,
} from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../throttle-handling/helpers/runGraphQL";

const RUN_BULK_QUERY_MUTATION = `#graphql
  mutation RunBulkQuery($query: String!) {
    bulkOperationRunQuery(query: $query, groupObjects: false) {
      bulkOperation {
        id
        status
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const BULK_OPERATION_STATUS_QUERY = `#graphql
  query BulkOperationStatus($id: ID!) {
    node(id: $id) {
      ... on BulkOperation {
        id
        status
        errorCode
        objectCount
        url
      }
    }
  }
`;

// Deprecated in 2025-10 in favour of `bulkOperations`, which this API version
// does not have yet. Only used to find the operation blocking ours.
const CURRENT_BULK_QUERY_OPERATION_QUERY = `#graphql
  query CurrentBulkQueryOperation {
    currentBulkOperation(type: QUERY) {
      id
      status
      query
    }
  }
`;

const RUNNING_STATUSES = new Set(["CREATED", "RUNNING", "CANCELING"]);

/**
 * - `notEnabled`: the app may not run bulk queries yet. Partner-created apps
 *   need "Allow bulk queries" in the Partner Dashboard, under API access
 *   requests, and again after 31 days without a bulk query.
 */
export type BulkQueryFailureReason =
  | "busy"
  | "timeout"
  | "failed"
  | "notEnabled";

export class BulkQueryError extends Error {
  constructor(
    readonly reason: BulkQueryFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "BulkQueryError";
  }
}

type Deps = {
  runGraphQL: typeof runGraphQL;
  fetchText: (url: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

const defaultDeps: Deps = {
  runGraphQL,
  fetchText: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BulkQueryError(
        "failed",
        `Could not download the bulk query result (HTTP ${response.status}).`,
      );
    }
    return response.text();
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

export type RunBulkQueryOptions = {
  /** Gives up waiting after this long; the operation itself keeps running. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 120_000;
/** Small results are ready in a second or two; bigger ones poll less often. */
const POLL_DELAYS_MS = [500, 1000, 1000, 1500];
const MAX_POLL_DELAY_MS = 2000;

/**
 * Runs `query` as a Shopify bulk operation and returns every JSONL line,
 * parsed. Bulk operations read any number of objects without the per-request
 * cost limit, which ordinary paging would hit for ~1,000 orders with items.
 *
 * In this API version only one bulk query per app and shop runs at a time.
 * When one is already running:
 * - with the same query (e.g. a second user opened the page), its result is used
 * - otherwise the call waits for it to end, then starts its own
 */
export async function runBulkQuery(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  query: string,
  options: RunBulkQueryOptions = {},
  deps: Deps = defaultDeps,
): Promise<unknown[]> {
  const deadline = deps.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const ctx = { admin, shopUrl, deps, deadline };

  let operationId = await startBulkQuery(ctx, query);
  if (!operationId) {
    const blocking = await getCurrentBulkQuery(ctx);

    if (blocking && normalizeQuery(blocking.query) === normalizeQuery(query)) {
      operationId = blocking.id;
    } else {
      if (blocking) await waitForOperation(ctx, blocking.id);
      operationId = await startBulkQuery(ctx, query);
    }

    if (!operationId) {
      throw new BulkQueryError(
        "busy",
        "Another bulk query of this app is still running.",
      );
    }
  }

  const url = await waitForOperation(ctx, operationId);
  if (!url) return [];

  return parseJsonl(await deps.fetchText(url));
}

type Ctx = {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  deps: Deps;
  deadline: number;
};

/** The new operation's ID, or `null` when another bulk query is running. */
async function startBulkQuery(ctx: Ctx, query: string): Promise<string | null> {
  let data: RunBulkQueryMutation;
  try {
    data = await ctx.deps.runGraphQL<RunBulkQueryMutation>(
      ctx.admin,
      ctx.shopUrl,
      "RunBulkQuery",
      RUN_BULK_QUERY_MUTATION,
      { query },
      10,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/access denied for bulkOperationRunQuery/i.test(message)) {
      throw new BulkQueryError("notEnabled", message);
    }
    throw error;
  }

  const result = data.bulkOperationRunQuery;
  const userErrors = result?.userErrors ?? [];

  if (userErrors.some((error) => error.code === "OPERATION_IN_PROGRESS")) {
    return null;
  }
  if (userErrors.length > 0 || !result?.bulkOperation) {
    throw new BulkQueryError(
      "failed",
      `Shopify refused the bulk query: ${userErrors.map((error) => error.message).join("; ") || "no operation returned"}`,
    );
  }

  return result.bulkOperation.id;
}

async function getCurrentBulkQuery(
  ctx: Ctx,
): Promise<{ id: string; query: string } | null> {
  const data = await ctx.deps.runGraphQL<CurrentBulkQueryOperationQuery>(
    ctx.admin,
    ctx.shopUrl,
    "CurrentBulkQueryOperation",
    CURRENT_BULK_QUERY_OPERATION_QUERY,
    {},
    1,
  );

  const operation = data.currentBulkOperation;
  return operation && RUNNING_STATUSES.has(operation.status)
    ? { id: operation.id, query: operation.query }
    : null;
}

/** Polls until the operation ends; its result URL, `null` when it is empty. */
async function waitForOperation(
  ctx: Ctx,
  operationId: string,
): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    const data = await ctx.deps.runGraphQL<BulkOperationStatusQuery>(
      ctx.admin,
      ctx.shopUrl,
      "BulkOperationStatus",
      BULK_OPERATION_STATUS_QUERY,
      { id: operationId },
      1,
    );

    const operation =
      data.node && "status" in data.node ? data.node : undefined;
    if (!operation) {
      throw new BulkQueryError(
        "failed",
        `Bulk operation ${operationId} was not found.`,
      );
    }

    if (operation.status === "COMPLETED") return operation.url ?? null;
    if (!RUNNING_STATUSES.has(operation.status)) {
      throw new BulkQueryError(
        "failed",
        `Bulk operation ended as ${operation.status}${operation.errorCode ? ` (${operation.errorCode})` : ""}.`,
      );
    }

    const delay = POLL_DELAYS_MS[attempt] ?? MAX_POLL_DELAY_MS;
    if (ctx.deps.now() + delay > ctx.deadline) {
      throw new BulkQueryError(
        "timeout",
        `Bulk operation ${operationId} did not finish in time.`,
      );
    }
    await ctx.deps.sleep(delay);
  }
}

export function parseJsonl(text: string): unknown[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}
