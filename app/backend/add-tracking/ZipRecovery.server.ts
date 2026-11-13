import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type { SolvedOrdersResponse } from "../zip-solver/models/SolvedOrdersResponse";
import { SolveZipService } from "../zip-solver/SolveZipService";

/** A ZIP this run wrote to an order, for the report. */
export type ZipChange = {
  previousZip: string | null;
  newZip: string;
  confidence: string;
};

/** The part of an order ZipRecovery reads and patches. */
export type OrderWithZip = {
  id: string;
  shippingAddress?: { zip?: string | null } | null;
};

export type RetryDecision =
  | { shouldRetry: true }
  | { shouldRetry: false; reason: string };

type SolveOutcome =
  | { isSolved: true; zip: string; confidence: string }
  | { isSolved: false; reason: string };

type SolveZips = (
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  orderIds: string[],
  solveAllZips: boolean,
) => Promise<SolvedOrdersResponse>;

const solveZipsWithService: SolveZips = (admin, shopUrl, orderIds, solveAll) =>
  SolveZipService.solveMissingZipCodesWithOrderIds(
    admin,
    shopUrl,
    orderIds,
    solveAll,
  );

/**
 * Solves ZIP codes during one add-tracking run, at most once per order:
 * - `fillMissingZips`: before any Optimus call, one solver call for every
 *   order without a ZIP
 * - `retryAfterRejection`: after Optimus rejects an order's ZIP
 *
 * Once per order because an order has one AWB call per shipping fulfillment,
 * and a bad ZIP fails all of them. Without the limit, each call would solve
 * and rewrite the Shopify address again. So a ZIP this run already solved is
 * not solved a second time when Optimus still rejects it.
 *
 * The solver writes the ZIP to the order in Shopify. This class patches the
 * in-memory order too, so the next AWB call uses it.
 */
export class ZipRecovery {
  private attemptedOrderIds = new Set<string>();
  private failureReasonsByOrderId = new Map<string, string>();
  private changesByOrderId = new Map<string, ZipChange>();

  constructor(
    private readonly admin: AdminApiContextWithoutRest,
    private readonly shopUrl: string,
    private readonly solveZips: SolveZips = solveZipsWithService,
  ) {}

  async fillMissingZips(orders: OrderWithZip[]): Promise<void> {
    const ordersWithoutZip = orders.filter(
      (order) =>
        !order.shippingAddress?.zip && !this.attemptedOrderIds.has(order.id),
    );
    if (ordersWithoutZip.length === 0) return;

    const outcomes = await this.solve(
      ordersWithoutZip.map((order) => order.id),
      false,
    );

    for (const order of ordersWithoutZip) {
      this.apply(order, outcomes.get(order.id) ?? skippedBySolver());
    }
  }

  /** Why `fillMissingZips` left this order without a ZIP, if it tried. */
  getMissingZipReason(orderId: string): string | undefined {
    return this.failureReasonsByOrderId.get(orderId);
  }

  async retryAfterRejection(order: OrderWithZip): Promise<RetryDecision> {
    const currentZip = order.shippingAddress?.zip ?? null;

    if (this.attemptedOrderIds.has(order.id)) {
      return {
        shouldRetry: false,
        reason:
          this.failureReasonsByOrderId.get(order.id) ??
          `ZIP ${currentZip} was already solved automatically in this run`,
      };
    }

    const outcomes = await this.solve([order.id], true);
    const outcome = outcomes.get(order.id) ?? skippedBySolver();

    if (outcome.isSolved && outcome.zip === currentZip) {
      this.attemptedOrderIds.add(order.id);
      const reason = `the ZIP solver suggests the same ZIP (${currentZip})`;
      this.failureReasonsByOrderId.set(order.id, reason);
      return { shouldRetry: false, reason };
    }

    this.apply(order, outcome);
    return outcome.isSolved
      ? { shouldRetry: true }
      : { shouldRetry: false, reason: outcome.reason };
  }

  getChange(orderId: string): ZipChange | undefined {
    return this.changesByOrderId.get(orderId);
  }

  private apply(order: OrderWithZip, outcome: SolveOutcome): void {
    this.attemptedOrderIds.add(order.id);

    if (!outcome.isSolved) {
      this.failureReasonsByOrderId.set(order.id, outcome.reason);
      return;
    }

    // the solver only solves orders that have an address
    if (!order.shippingAddress) return;

    this.changesByOrderId.set(order.id, {
      previousZip: order.shippingAddress.zip ?? null,
      newZip: outcome.zip,
      confidence: outcome.confidence,
    });
    order.shippingAddress.zip = outcome.zip;
  }

  private async solve(
    orderIds: string[],
    solveAllZips: boolean,
  ): Promise<Map<string, SolveOutcome>> {
    try {
      const result = await this.solveZips(
        this.admin,
        this.shopUrl,
        orderIds,
        solveAllZips,
      );
      return mapSolverResult(result);
    } catch (error) {
      const reason = `the ZIP solver failed: ${error instanceof Error ? error.message : String(error)}`;
      return new Map(
        orderIds.map((id) => [id, { isSolved: false, reason } as const]),
      );
    }
  }
}

function mapSolverResult(
  result: SolvedOrdersResponse,
): Map<string, SolveOutcome> {
  const byId = new Map<string, SolveOutcome>();

  for (const order of result.processedOrdersSolvedZip) {
    byId.set(order.id, {
      isSolved: true,
      zip: order.zipCode,
      confidence: order.confidenceLevel ?? "unknown",
    });
  }

  for (const order of result.processedOrdersUnsolvedZip) {
    byId.set(order.id, {
      isSolved: false,
      reason:
        order.error ??
        `no confident suggestion (confidence: ${order.confidenceLevel ?? "unknown"})`,
    });
  }

  // Also orders whose ZIP was found but could not be saved to Shopify: using
  // that ZIP would put an address on the AWB that the order does not have.
  for (const order of result.unsupportedOrders) {
    byId.set(order.id, {
      isSolved: false,
      reason: order.errorStack.join("; "),
    });
  }

  return byId;
}

function skippedBySolver(): SolveOutcome {
  return {
    isSolved: false,
    reason: "the ZIP solver skipped this order (it looks like a pickup order)",
  };
}
