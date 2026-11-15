import type { FulfillmentPackStatus } from "app/commons/packs/FulfillmentPack";

/** Where an order is now. */
export type CurrentMembership = {
  orderId: string;
  packId: string;
  packStatus: FulfillmentPackStatus;
  packTag: string;
};

/** An order leaving a pack, with the tag to take off it. */
export type OrderLeavingPack = { orderId: string; fromTag: string };

export type AddToPackPlan = {
  /** In no pack yet. */
  orderIdsToInsert: string[];
  /** In another open or locked pack. */
  ordersToMove: OrderLeavingPack[];
  /** Already in the target pack: nothing to do. */
  alreadyInTarget: string[];
  /** In a closed pack: left there, a closed pack does not change. */
  inClosedPack: string[];
};

/** Which of `orderIds` go into the target pack, and how. */
export function planAddToPack(
  orderIds: string[],
  current: CurrentMembership[],
  targetPackId: string,
): AddToPackPlan {
  const currentByOrderId = new Map(current.map((m) => [m.orderId, m]));
  const plan: AddToPackPlan = {
    orderIdsToInsert: [],
    ordersToMove: [],
    alreadyInTarget: [],
    inClosedPack: [],
  };

  for (const orderId of new Set(orderIds)) {
    const membership = currentByOrderId.get(orderId);
    if (!membership) {
      plan.orderIdsToInsert.push(orderId);
    } else if (membership.packId === targetPackId) {
      plan.alreadyInTarget.push(orderId);
    } else if (membership.packStatus === "CLOSED") {
      plan.inClosedPack.push(orderId);
    } else {
      plan.ordersToMove.push({ orderId, fromTag: membership.packTag });
    }
  }

  return plan;
}

export type RemoveFromPackPlan = {
  ordersToRemove: OrderLeavingPack[];
  /** In no pack: nothing to do. */
  notInPack: string[];
  inClosedPack: string[];
};

/** Which of `orderIds` leave their pack. */
export function planRemoveFromPack(
  orderIds: string[],
  current: CurrentMembership[],
): RemoveFromPackPlan {
  const currentByOrderId = new Map(current.map((m) => [m.orderId, m]));
  const plan: RemoveFromPackPlan = {
    ordersToRemove: [],
    notInPack: [],
    inClosedPack: [],
  };

  for (const orderId of new Set(orderIds)) {
    const membership = currentByOrderId.get(orderId);
    if (!membership) {
      plan.notInPack.push(orderId);
    } else if (membership.packStatus === "CLOSED") {
      plan.inClosedPack.push(orderId);
    } else {
      plan.ordersToRemove.push({ orderId, fromTag: membership.packTag });
    }
  }

  return plan;
}
