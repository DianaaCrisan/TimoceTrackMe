/**
 * Orders that a running job is working on.
 *
 * Two add-tracking jobs over the same order would each create an Optimus AWB,
 * because both read the order as unfulfilled before either fulfills it. A job
 * therefore takes all its orders up front, or none of them.
 *
 * In memory: correct for a single app instance only.
 */
export class OrderJobLocks {
  private lockedOrderIds = new Set<string>();

  tryLock(
    orderIds: string[],
  ): { isLocked: true } | { isLocked: false; busyOrderIds: string[] } {
    const busyOrderIds = orderIds.filter((id) => this.lockedOrderIds.has(id));

    if (busyOrderIds.length > 0) {
      return { isLocked: false, busyOrderIds };
    }

    orderIds.forEach((id) => this.lockedOrderIds.add(id));
    return { isLocked: true };
  }

  release(orderIds: string[]): void {
    orderIds.forEach((id) => this.lockedOrderIds.delete(id));
  }
}

export const orderJobLocks = new OrderJobLocks();
