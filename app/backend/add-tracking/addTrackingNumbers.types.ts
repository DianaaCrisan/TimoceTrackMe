export type AddTrackingNumbersRequest = {
  orderIds: string[];
};

export type AddTrackingNumbersSuccessfulOrder = {
  id: string;
  name: string;
  trackingNumbers: string[];
};

export type AddTrackingNumbersFailedOrder = {
  id: string;
  name: string;
  errors: string[];
};

export type AddTrackingNumbersResult = {
  ok: boolean;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
};
