import type { ManualZips } from "app/commons/orders/ManualZips";
import type { ParcelWeightSettings } from "app/commons/settings/ParcelWeightSettings";
import type { ZipChange } from "./ZipRecovery.server";

export type AddTrackingNumbersRequest = {
  orderIds: string[];
  /**
   * ZIPs the admin typed, saved to the orders before any AWB is created. The
   * ZIP solver never replaces them; if Optimus rejects one, the order fails.
   */
  manualZips?: ManualZips;
  /**
   * The admin's weight limit per parcel. With auto split on, fulfillments over
   * it ship as several parcels; otherwise they are only reported. Unset: no
   * limit.
   */
  parcelWeight?: ParcelWeightSettings;
};

export type AddTrackingNumbersSuccessfulOrder = {
  id: string;
  name: string;
  /** One per parcel. */
  trackingNumbers: string[];
  /** Set when this run solved the order's ZIP, or saved one the admin typed. */
  zipChange?: ZipChange;
  /**
   * For the admin to check: parcels that shipped over the weight limit, AWBs
   * that could not be saved for the AWB report.
   */
  warnings?: string[];
};

export type AddTrackingNumbersFailedOrder = {
  id: string;
  name: string;
  errors: string[];
  /** Set when this run changed the order's ZIP, even if the order then failed. */
  zipChange?: ZipChange;
  /**
   * The order failed because of its ZIP code, so the admin has to fix it: it
   * is missing and could not be solved, or Optimus rejected it.
   */
  isZipProblem?: boolean;
};

export type AddTrackingNumbersResult = {
  ok: boolean;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
};
