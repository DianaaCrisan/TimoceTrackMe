import { BadgeTone } from "../components/Badge";

export enum OrderDisplayFulfillmentStatusDTO {
  FULFILLED = "FULFILLED",
  IN_PROGRESS = "IN_PROGRESS",
  ON_HOLD = "ON_HOLD",
  OPEN = "OPEN",
  PARTIALLY_FULFILLED = "PARTIALLY_FULFILLED",
  PENDING_FULFILLMENT = "PENDING_FULFILLMENT",
  REQUEST_DECLINED = "REQUEST_DECLINED",
  RESTOCKED = "RESTOCKED",
  SCHEDULED = "SCHEDULED",
  UNFULFILLED = "UNFULFILLED",
}

export function formatFulfillmentStatus(status?: string | null): string {
  if (!status) return "";
  const formatted = status.toLowerCase().replace(/_/g, " ");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function fulfillmentStatusToTone(status?: string | null): BadgeTone {
  if (!status) return "neutral";

  switch (status) {
    case OrderDisplayFulfillmentStatusDTO.FULFILLED:
      return "neutral";
    case OrderDisplayFulfillmentStatusDTO.UNFULFILLED:
      return "attention";
    case OrderDisplayFulfillmentStatusDTO.IN_PROGRESS:
    case OrderDisplayFulfillmentStatusDTO.SCHEDULED:
    case OrderDisplayFulfillmentStatusDTO.PENDING_FULFILLMENT:
    case OrderDisplayFulfillmentStatusDTO.OPEN:
    case OrderDisplayFulfillmentStatusDTO.RESTOCKED:
      return "info";
    case OrderDisplayFulfillmentStatusDTO.PARTIALLY_FULFILLED:
    case OrderDisplayFulfillmentStatusDTO.ON_HOLD:
      return "warning";
    case OrderDisplayFulfillmentStatusDTO.REQUEST_DECLINED:
      return "critical";
    default:
      return "neutral";
  }
}

export function formatFulfillmentStatusWithTone(status?: string | null): {
  label: string;
  tone: BadgeTone;
} {
  return {
    label: formatFulfillmentStatus(status),
    tone: fulfillmentStatusToTone(status),
  };
}
