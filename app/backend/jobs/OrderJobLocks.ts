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
  /** Locked order → what holds it, e.g. the job kind "add-tracking". */
  private ownerByOrderId = new Map<string, string>();

  /** `owner` says what is working on the orders, for the dashboard rows. */
  tryLock(
    orderIds: string[],
    owner = "other",
  ): { isLocked: true } | { isLocked: false; busyOrderIds: string[] } {
    const busyOrderIds = this.findBusy(orderIds);

    if (busyOrderIds.length > 0) {
      return { isLocked: false, busyOrderIds };
    }

    orderIds.forEach((id) => this.ownerByOrderId.set(id, owner));
    return { isLocked: true };
  }

  /** The orders among these that a running job is working on. */
  findBusy(orderIds: string[]): string[] {
    return orderIds.filter((id) => this.ownerByOrderId.has(id));
  }

  /** What holds each of these orders, for those that are locked. */
  findOwners(orderIds: string[]): Map<string, string> {
    const owners = new Map<string, string>();
    for (const id of orderIds) {
      const owner = this.ownerByOrderId.get(id);
      if (owner) owners.set(id, owner);
    }
    return owners;
  }

  release(orderIds: string[]): void {
    orderIds.forEach((id) => this.ownerByOrderId.delete(id));
  }
}

export const orderJobLocks = new OrderJobLocks();
