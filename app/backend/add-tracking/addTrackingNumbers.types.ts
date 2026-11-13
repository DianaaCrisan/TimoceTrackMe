import type { ZipChange } from "./ZipRecovery.server";

export type AddTrackingNumbersRequest = {
  orderIds: string[];
};

export type AddTrackingNumbersSuccessfulOrder = {
  id: string;
  name: string;
  trackingNumbers: string[];
  /** Set when this run solved the order's ZIP. */
  zipChange?: ZipChange;
};

export type AddTrackingNumbersFailedOrder = {
  id: string;
  name: string;
  errors: string[];
  /** Set when this run solved the order's ZIP, even if the order then failed. */
  zipChange?: ZipChange;
};

export type AddTrackingNumbersResult = {
  ok: boolean;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
};
