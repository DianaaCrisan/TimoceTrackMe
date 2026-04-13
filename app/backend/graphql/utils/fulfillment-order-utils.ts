export enum FulfillmentOrderStatusDTO {
  CANCELLED = "CANCELLED",
  CLOSED = "CLOSED",
  IN_PROGRESS = "IN_PROGRESS",
  INCOMPLETE = "INCOMPLETE",
  ON_HOLD = "ON_HOLD",
  OPEN = "OPEN",
  SCHEDULED = "SCHEDULED",
}

export function isEligibleForFulfillment(
  fulfillmentOrderStatus: string,
): boolean {
  return [
    FulfillmentOrderStatusDTO.IN_PROGRESS,
    FulfillmentOrderStatusDTO.OPEN,
  ].includes(fulfillmentOrderStatus as FulfillmentOrderStatusDTO);
}
