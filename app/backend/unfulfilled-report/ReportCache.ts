import { randomUUID } from "node:crypto";
import type { UnfulfilledReport } from "app/commons/unfulfilled-report/UnfulfilledReport";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 50;

type Entry = {
  shop: string;
  report: UnfulfilledReport;
  storedAt: number;
};

/**
 * Keeps the report shown on the page for a while, so "Download PDF"
 * prints exactly what the user is looking at, without reading every order
 * from Shopify again. In memory, like the jobs list: a restart only means
 * the PDF is built from fresh data instead.
 */
export class ReportCache {
  private entries = new Map<string, Entry>();

  constructor(private now: () => number = () => Date.now()) {}

  store(shop: string, report: UnfulfilledReport): string {
    this.prune();

    const id = randomUUID();
    this.entries.set(id, { shop, report, storedAt: this.now() });

    // oldest first, as a Map keeps insertion order
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }

    return id;
  }

  /** Only to the shop that stored it, and only while it is fresh. */
  get(shop: string, id: string): UnfulfilledReport | null {
    const entry = this.entries.get(id);
    if (!entry || entry.shop !== shop || this.isExpired(entry)) return null;
    return entry.report;
  }

  private prune(): void {
    for (const [id, entry] of this.entries) {
      if (this.isExpired(entry)) this.entries.delete(id);
    }
  }

  private isExpired(entry: Entry): boolean {
    return this.now() - entry.storedAt > TTL_MS;
  }
}

export const reportCache = new ReportCache();
