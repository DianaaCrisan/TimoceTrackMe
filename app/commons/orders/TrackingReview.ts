import type { CustomerNote } from "./CustomerNote";

/**
 * An order the admin should look at before add tracking: it has a customer
 * note, or it would ship as one parcel over the weight limit.
 */
export type OrderToReview = CustomerNote & {
  id: string;
  name: string;
  customerName: string;
  weightKg: number | null;
  /**
   * Over the weight limit while auto split is off, so add tracking would ship
   * it as one heavy parcel.
   */
  shipsOverWeightLimit: boolean;
};

/** What the dashboard asks before add tracking: the orders it would run on. */
export type TrackingReviewResponse =
  | {
      ok: true;
      /** Every order in the selection, so some can be left out by ID. */
      orderIds: string[];
      /** Only the orders the admin should look at. */
      ordersToReview: OrderToReview[];
      parcelWeightLimitKg: number | null;
    }
  | { ok: false; error: string };
