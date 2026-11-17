import type { AwbReportRow } from "./AwbReport";

/** A used TrackMe AWB; tests override what they need. */
export function awbReportRow(
  overrides: Partial<AwbReportRow> = {},
): AwbReportRow {
  return {
    trackingNumber: "6256000001",
    source: "TRACKME",
    courier: "OPTIMUS",
    trackingCompany: "Optimus",
    orderId: "gid://shopify/Order/1",
    orderName: "#1001",
    orderCreatedAt: "2026-11-01T00:00:00.000Z",
    parcelPosition: null,
    weightKg: 1,
    issuedAt: "2026-11-02T10:00:00.000Z",
    status: "USED",
    cancelReason: null,
    cancelledAt: null,
    note: null,
    firstPrintedAt: null,
    printCount: 0,
    ...overrides,
  };
}
