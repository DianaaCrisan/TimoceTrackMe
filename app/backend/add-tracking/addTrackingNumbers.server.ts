import { createPool } from "app/backend/graphql/throttle-handling/helpers/createPool";
import { createProgressLogger } from "app/backend/graphql/throttle-handling/helpers/createProgressLogger";
import { scheduleWithProgress } from "app/backend/graphql/throttle-handling/helpers/scheduleWithProgress";
import type {
  AddTrackingNumbersFailedOrder,
  AddTrackingNumbersRequest,
  AddTrackingNumbersResult,
  AddTrackingNumbersSuccessfulOrder,
} from "./addTrackingNumbers.types";
import { ADD_TRACKING_GRAPHQL_POOL_WORKERS } from "../graphql/throttle-handling/constants";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";

export async function addTrackingNumbers(
  admin: AdminApiContextWithoutRest,
  request: AddTrackingNumbersRequest,
): Promise<AddTrackingNumbersResult> {
  const successfulOrders: AddTrackingNumbersSuccessfulOrder[] = [];
  const failedOrders: AddTrackingNumbersFailedOrder[] = [];

  const pool = createPool(ADD_TRACKING_GRAPHQL_POOL_WORKERS);
  const progress = createProgressLogger(
    "AddTrackingNumbers",
    request.orderIds.length,
  );

  await Promise.all(
    request.orderIds.map((orderId) =>
      scheduleWithProgress(pool, progress, orderId, async () => {
        await processOneOrder({
          admin,
          orderId,
          successfulOrders,
          failedOrders,
        });
      }),
    ),
  );

  return {
    ok: failedOrders.length === 0,
    successfulOrders,
    failedOrders,
  };
}

async function processOneOrder({
  admin,
  orderId,
  successfulOrders,
  failedOrders,
}: {
  admin: AdminApiContextWithoutRest;
  orderId: string;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
}) {
  void admin;

  try {
    successfulOrders.push({
      id: orderId,
      name: `Mock order ${orderId}`,
      trackingNumbers: [`MOCK-TRACKING-${orderId.slice(-6)}`],
    });
  } catch (error) {
    failedOrders.push({
      id: orderId,
      name: "-",
      errors: [error instanceof Error ? error.message : String(error)],
    });
  }
}
