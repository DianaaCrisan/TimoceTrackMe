import { BadgeTone } from "../components/Badge";

export enum OrderDisplayFinancialStatusDTO {
  AUTHORIZED = "AUTHORIZED",
  EXPIRED = "EXPIRED",
  PAID = "PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  PENDING = "PENDING",
  REFUNDED = "REFUNDED",
  VOIDED = "VOIDED",
}

export function formatFinancialStatus(status?: string | null): string {
  if (!status) return "";
  const formatted = status.toLowerCase().replace(/_/g, " ");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function financialStatusToTone(status?: string | null): BadgeTone {
  if (!status) return "neutral";

  switch (status) {
    case OrderDisplayFinancialStatusDTO.AUTHORIZED:
    case OrderDisplayFinancialStatusDTO.PENDING:
    case OrderDisplayFinancialStatusDTO.PARTIALLY_PAID:
      return "warning";

    case OrderDisplayFinancialStatusDTO.PAID:
    case OrderDisplayFinancialStatusDTO.PARTIALLY_REFUNDED:
    case OrderDisplayFinancialStatusDTO.REFUNDED:
    case OrderDisplayFinancialStatusDTO.VOIDED:
      return "neutral";

    case OrderDisplayFinancialStatusDTO.EXPIRED:
      return "info";

    default:
      return "neutral";
  }
}

export function formatFinancialStatusWithTone(status?: string | null) {
  return {
    label: formatFinancialStatus(status),
    tone: financialStatusToTone(status),
  };
}
