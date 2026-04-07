import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import type {
  AddTrackingNumbersRequest,
  AddTrackingNumbersResult,
} from "./addTrackingNumbers.types";

export async function addTrackingNumbers(
  admin: AdminApiContextWithoutRest,
  request: AddTrackingNumbersRequest,
): Promise<AddTrackingNumbersResult> {
  void admin;

  return {
    ok: true,
    successfulOrders: request.orderIds.map((orderId) => ({
      id: orderId,
      name: `Mock order ${orderId}`,
      trackingNumbers: ["MOCK-TRACKING-123"],
    })),
    failedOrders: [],
  };
}
