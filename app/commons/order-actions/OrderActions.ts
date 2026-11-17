import type { CustomerAttribute } from "../orders/CustomerNote";

/**
 * The routes behind TrackMe's buttons on the Shopify order page. See
 * docs/order-page-extensions-plan.md. The extensions in `extensions/` call
 * them with `fetch`, which Shopify signs with an ID token.
 *
 * Not under `/extensions/`: Shopify CLI's dev server keeps that path for
 * serving the extensions' own files, and answers it before the app does.
 */
export const ORDER_ACTIONS_PATHS = {
  summary: "/api/order-actions/summary",
  addTracking: "/api/order-actions/add-tracking",
  label: "/api/order-actions/label",
} as const;

/** Query and form fields. */
export const ORDER_ACTIONS_PARAMS = {
  orderId: "orderId",
  locale: "locale",
} as const;

/** What add tracking would do for one order, before it runs. */
export type OrderTrackingSummary = {
  orderName: string;
  /** Units still to ship by courier; add tracking makes AWBs for them. */
  unitsToShip: number;
  /** The order is picked up in store: add tracking skips it. */
  isPickup: boolean;
  isCancelled: boolean;
  /** The shipping ZIP; null when missing (add tracking tries to solve it). */
  zip: string | null;
  /** AWBs already on the order's active fulfillments. */
  existingAwbs: string[];
  note: string | null;
  attributes: CustomerAttribute[];
  weightKg: number | null;
  /** Over the limit with auto split off: it would ship as one heavy parcel. */
  shipsOverWeightLimit: boolean;
  parcelWeightLimitKg: number | null;
  /** A running job is working on this order. */
  isBusy: boolean;
};

export type OrderSummaryResponse =
  | { ok: true; summary: OrderTrackingSummary }
  | { ok: false; error: string };

export type OrderAddTrackingResponse =
  | {
      ok: true;
      /** One per parcel. */
      trackingNumbers: string[];
      /** Weight warnings, ZIP solved automatically, report problems. */
      notices: string[];
    }
  | {
      ok: false;
      error: string;
      /** The ZIP is missing or Optimus refused it: fix it in Shopify. */
      isZipProblem?: boolean;
    };
