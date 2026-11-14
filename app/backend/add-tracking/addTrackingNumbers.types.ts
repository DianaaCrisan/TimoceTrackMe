import type { ManualZips } from "app/commons/orders/ManualZips";
import type { ZipChange } from "./ZipRecovery.server";

export type AddTrackingNumbersRequest = {
  orderIds: string[];
  /**
   * ZIPs the admin typed, saved to the orders before any AWB is created. The
   * ZIP solver never replaces them; if Optimus rejects one, the order fails.
   */
  manualZips?: ManualZips;
};

export type AddTrackingNumbersSuccessfulOrder = {
  id: string;
  name: string;
  trackingNumbers: string[];
  /** Set when this run solved the order's ZIP, or saved one the admin typed. */
  zipChange?: ZipChange;
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
