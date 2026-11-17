import { recogniseCourier, type Courier } from "app/commons/couriers/Courier";
import type {
  AwbCancelReason,
  AwbSource,
  AwbStatus,
} from "app/commons/shipping-labels/AwbReport";

/** One fulfillment of an order, as read from Shopify. */
export type FulfillmentSnapshot = {
  id: string;
  /** Shopify's `FulfillmentStatus`: SUCCESS, CANCELLED, ERROR, … */
  status: string;
  createdAt: Date;
  updatedAt: Date;
  tracking: { number: string; company: string | null }[];
};

/** An order and its fulfillments, as read from Shopify. */
export type OrderSnapshot = {
  id: string;
  name: string;
  createdAt: Date;
  fulfillments: FulfillmentSnapshot[];
};

/** What the database knows about an AWB, as far as reconciling goes. */
export type KnownLabel = {
  trackingNumber: string;
  source: AwbSource;
  courier: Courier;
  trackingCompany: string | null;
  orderId: string | null;
  orderName: string | null;
  orderCreatedAt: Date | null;
  fulfillmentId: string | null;
  status: AwbStatus;
  cancelReason: AwbCancelReason | null;
  cancelledAt: Date | null;
};

export type LabelState = Omit<KnownLabel, "trackingNumber" | "source">;

export type LabelChange =
  | {
      kind: "create";
      trackingNumber: string;
      issuedAt: Date;
      state: LabelState;
    }
  | { kind: "update"; trackingNumber: string; state: LabelState };

/** Fulfillments in these states carry nothing: their AWBs are cancelled. */
const INACTIVE_FULFILLMENT_STATUSES = new Set([
  "CANCELLED",
  "ERROR",
  "FAILURE",
]);

type Placement = { fulfillment: FulfillmentSnapshot; company: string | null };

/**
 * The rule of the AWB report: an AWB is USED while it is on an active
 * fulfillment, CANCELLED otherwise. Given an order as Shopify has it now and
 * what the database knows about its AWBs, returns the rows to create or
 * change. See docs/awb-report-plan.md.
 *
 * - Pass every known row whose `orderId` is this order, plus any known row
 *   for a number found on this order's fulfillments.
 * - Rows added by hand (IMPORT) keep the status they were given.
 * - A number unknown so far becomes a SHOPIFY row, issued when its
 *   fulfillment was created. That covers AWBs pasted by hand and, through the
 *   month refresh, AWBs from before the report existed.
 */
export function reconcileOrderLabels(args: {
  order: OrderSnapshot;
  known: KnownLabel[];
  now: Date;
}): LabelChange[] {
  const { order, now } = args;
  const knownByNumber = new Map(
    args.known.map((label) => [label.trackingNumber, label]),
  );
  const active = new Map<string, Placement>();
  const onCancelled = new Map<string, Placement>();

  for (const fulfillment of order.fulfillments) {
    const isActive = !INACTIVE_FULFILLMENT_STATUSES.has(fulfillment.status);
    for (const tracking of fulfillment.tracking) {
      const number = tracking.number.trim();
      if (!number) continue;
      const placements = isActive ? active : onCancelled;
      if (!placements.has(number)) {
        placements.set(number, { fulfillment, company: tracking.company });
      }
    }
  }

  const numbers = new Set([
    ...args.known
      .filter((label) => label.orderId === order.id)
      .map((label) => label.trackingNumber),
    ...active.keys(),
    ...onCancelled.keys(),
  ]);
  const orderFields = {
    orderId: order.id,
    orderName: order.name,
    orderCreatedAt: order.createdAt,
  };
  const changes: LabelChange[] = [];

  for (const trackingNumber of numbers) {
    const known = knownByNumber.get(trackingNumber);
    if (known?.source === "IMPORT") continue;

    const placement = active.get(trackingNumber);
    if (placement) {
      const state: LabelState = {
        ...orderFields,
        // TrackMe booked it at Optimus, whatever the fulfillment says now
        courier:
          known?.source === "TRACKME"
            ? "OPTIMUS"
            : recogniseCourier(placement.company),
        trackingCompany: placement.company,
        fulfillmentId: placement.fulfillment.id,
        status: "USED",
        cancelReason: null,
        cancelledAt: null,
      };
      pushChange(changes, trackingNumber, known, state, placement);
      continue;
    }

    // Not on an active fulfillment of this order. A row that belongs to
    // another order is that order's to decide.
    if (known?.orderId && known.orderId !== order.id) continue;

    const cancelledOn = onCancelled.get(trackingNumber);
    const cancelReason: AwbCancelReason = cancelledOn
      ? "FULFILLMENT_CANCELLED"
      : known?.fulfillmentId
        ? "TRACKING_REMOVED"
        : "NEVER_ON_SHOPIFY";

    if (!known) {
      // only reachable through a cancelled fulfillment
      const placement = cancelledOn!;
      changes.push({
        kind: "create",
        trackingNumber,
        issuedAt: placement.fulfillment.createdAt,
        state: {
          ...orderFields,
          courier: recogniseCourier(placement.company),
          trackingCompany: placement.company,
          fulfillmentId: placement.fulfillment.id,
          status: "CANCELLED",
          cancelReason,
          cancelledAt: placement.fulfillment.updatedAt,
        },
      });
      continue;
    }

    const state: LabelState = {
      ...orderFields,
      courier: known.courier,
      trackingCompany: known.trackingCompany,
      fulfillmentId: cancelledOn?.fulfillment.id ?? known.fulfillmentId,
      status: "CANCELLED",
      cancelReason,
      cancelledAt:
        known.status === "CANCELLED" && known.cancelledAt
          ? known.cancelledAt
          : now,
    };
    pushChange(changes, trackingNumber, known, state, null);
  }

  return changes;
}

function pushChange(
  changes: LabelChange[],
  trackingNumber: string,
  known: KnownLabel | undefined,
  state: LabelState,
  placement: Placement | null,
) {
  if (!known) {
    changes.push({
      kind: "create",
      trackingNumber,
      issuedAt: placement!.fulfillment.createdAt,
      state,
    });
  } else if (!isSameState(known, state)) {
    changes.push({ kind: "update", trackingNumber, state });
  }
}

function isSameState(known: KnownLabel, state: LabelState): boolean {
  return (Object.keys(state) as (keyof LabelState)[]).every((key) => {
    const a = known[key];
    const b = state[key];
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    return a === b;
  });
}
