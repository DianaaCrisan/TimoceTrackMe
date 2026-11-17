import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { countOrdersMatching } from "./getOrdersCount.server";

/** A Shopify order search that should match `expectedCount` orders. */
export type SearchIndexCheck = { query: string; expectedCount: number };

/** IDs per check: one search query must not grow too long. */
const IDS_PER_CHECK = 50;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_INTERVAL_MS = 1_500;

/**
 * Checks that these orders match `condition` in Shopify's order search, e.g.
 * `tag:cod-postal-de-corectat`. One check per 50 orders.
 */
export function searchIndexChecks(
  condition: string,
  orderIds: string[],
): SearchIndexCheck[] {
  const numericIds = [...new Set(orderIds)]
    .map((id) => id.split("/").pop() ?? "")
    .filter((id) => /^\d+$/.test(id));
  const checks: SearchIndexCheck[] = [];

  for (let i = 0; i < numericIds.length; i += IDS_PER_CHECK) {
    const ids = numericIds.slice(i, i + IDS_PER_CHECK);
    checks.push({
      query: `${condition} AND (${ids.map((id) => `id:${id}`).join(" OR ")})`,
      expectedCount: ids.length,
    });
  }
  return checks;
}

/**
 * Waits until Shopify's order search shows what a job just changed. Search
 * lags a few seconds (sometimes more) behind a fulfillment or a tag, so a
 * job that reports "finished" straight away makes the dashboard reload a
 * list that still shows the old state.
 *
 * Never throws: after `timeoutMs`, or if counting fails, the job finishes
 * anyway and the dashboard's own later reload catches up.
 */
export async function waitForSearchIndex(
  admin: AdminApiContextWithoutRest,
  checks: SearchIndexCheck[],
  deps: {
    count?: (query: string) => Promise<number | null>;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<{ isCaughtUp: boolean }> {
  const count =
    deps.count ??
    (async (query: string) =>
      (await countOrdersMatching(admin, query))?.count ?? null);
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let pending = checks.filter((check) => check.expectedCount > 0);

  try {
    while (pending.length > 0) {
      const counts = await Promise.all(
        pending.map((check) => count(check.query)),
      );
      pending = pending.filter(
        (check, i) => (counts[i] ?? -1) < check.expectedCount,
      );
      if (pending.length === 0) break;
      if (now() >= deadline) return { isCaughtUp: false };
      await sleep(deps.intervalMs ?? DEFAULT_INTERVAL_MS);
    }
  } catch (error) {
    console.error(
      "AppError[SearchIndex] could not check Shopify search; finishing anyway.",
      error,
    );
    return { isCaughtUp: false };
  }

  return { isCaughtUp: true };
}
