import type { CostExtensions } from "../models/CostExtensions";

const MIN_RESERVE = 300;
const MAX_SLEEP_MS = 15000;

export class GraphqlLimiter {
  /**
   * The last known view of the bucket
   * It is initialized with default values that are overwritten on first response
   */
  private available = 0;
  private restoreRate = 50;
  private max = 1000;
  private initialized = false;
  private initBarrier: Promise<void> | null = null;
  private resolveInit!: () => void;

  /**
   * Remember the last requested cost per operation
   * Will be used before execution next time
   */
  private opRequestedCostCache = new Map<string, number>();

  // --- simple mutex so preflight + reservation is atomic
  private lock = Promise.resolve();
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((res) => (release = res));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private lastRefillAt = Date.now();

  private refillByElapsed() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillAt) / 1000;
    if (elapsedSec > 0 && this.restoreRate > 0) {
      this.available = Math.min(
        this.max,
        this.available + elapsedSec * this.restoreRate
      );
    }
    this.lastRefillAt = now;
  }

  private sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  private ensureInitBarrier() {
    if (!this.initBarrier) {
      this.initBarrier = new Promise<void>((res) => (this.resolveInit = res));
    }
  }

  /** Update local bucket/cost cache from a GraphQL response body */
  updateFromExtensions(opName: string, extensions?: { cost?: CostExtensions }) {
    const cost = extensions?.cost;
    if (!cost) return;

    console.log(
      `[ThrottleMonitoring] ${opName} -> currentlyAvailableCost: ${cost.throttleStatus?.currentlyAvailable}`
    );

    if (typeof cost.requestedQueryCost === "number") {
      this.opRequestedCostCache.set(opName, cost.requestedQueryCost);
    }

    const ts = cost.throttleStatus;
    if (ts) {
      this.available = ts.currentlyAvailable ?? this.available;
      this.restoreRate = ts.restoreRate ?? this.restoreRate;
      this.max = ts.maximumAvailable ?? this.max;

      if (!this.initialized) {
        this.initialized = true;
        if (this.resolveInit) this.resolveInit(); // release waiters
        this.initBarrier = null;
      }
    }
  }

  /** Estimate how many points we need pre-flight */
  private estimateRequestedCost(
    opName: string,
    expectedCostHint?: number
  ): number {
    if (typeof expectedCostHint === "number") return expectedCostHint;
    const cached = this.opRequestedCostCache.get(opName);
    if (typeof cached === "number") return cached;
    // conservative guess if unknown; tuned small so first call goes through
    return 50;
  }

  private async preflightAndReserve(requested: number) {
    await this.withLock(async () => {
      if (!this.initialized) {
        // Let exactly one request go through to fetch extensions; everybody else waits.
        if (!this.initBarrier) {
          this.ensureInitBarrier(); // I'm the first → proceed without waiting.
          return;
        }
        await this.initBarrier; // Not first → wait until extensions arrive.
      }

      const headroom = Math.max(MIN_RESERVE, 3 * this.restoreRate);
      const target = requested + headroom;

      while (true) {
        // bring local bucket up-to-date
        this.refillByElapsed();

        if (this.available >= target) break;

        // wait exactly enough to reach target
        const deficit = target - this.available;
        const waitMs = Math.ceil(
          (deficit / Math.max(this.restoreRate, 1)) * 1000
        );
        const boundedSleep = Math.min(waitMs, MAX_SLEEP_MS);

        console.log(
          `[ThrottleMonitoring] Initiating sleep for ${boundedSleep}ms`
        );
        await this.sleep(boundedSleep);
      }

      // reserve so others can’t reuse these points
      this.available = Math.max(0, this.available - requested);
    });
  }

  /** Run with throttle handling + retries/backoff */
  async run<T>(
    opName: string,
    runRaw: () => Promise<Response>,
    { expectedCost }: { expectedCost?: number } = {}
  ): Promise<{ data: T; body: any; response: Response }> {
    const requested = this.estimateRequestedCost(opName, expectedCost);
    await this.preflightAndReserve(requested);

    let resp: Response;
    try {
      resp = await runRaw(); // may return a Response or the SDK may throw
    } catch (err: any) {
      // If the SDK throws (e.g., GraphqlApiError), learn any throttle info we can, then rethrow
      try {
        const thrownBody = err?.body ?? err?.response?.body;
        this.updateFromExtensions(opName, thrownBody?.extensions);
      } catch {}
      throw err; // no retry
    }

    // Try to parse JSON body (best-effort)
    let body: any = null;
    try {
      body = await resp.clone().json();
    } catch {}

    // Sync our local bucket view from the server truth
    this.updateFromExtensions(opName, body?.extensions);

    // Immediately surface throttle or HTTP errors to the caller
    if (!resp.ok || isThrottled(resp.status, body)) {
      // throw the Response so your throwFormattedGraphqlError can format status/headers
      throw resp;
    }

    return { data: body?.data as T, body, response: resp };
  }
}

function isThrottled(status?: number, body?: any): boolean {
  if (status === 429) return true;
  const errs = Array.isArray(body?.errors) ? body.errors : [];
  return errs.some((e: any) => /throttl/i.test(String(e?.message ?? "")));
}

/** Registry — one limiter per shop */
const limiterByShop = new Map<string, GraphqlLimiter>();
export function getLimiterForShop(shopUrl: string): GraphqlLimiter {
  let limiter = limiterByShop.get(shopUrl);
  if (!limiter) {
    limiter = new GraphqlLimiter();
    limiterByShop.set(shopUrl, limiter);
  }
  return limiter;
}
