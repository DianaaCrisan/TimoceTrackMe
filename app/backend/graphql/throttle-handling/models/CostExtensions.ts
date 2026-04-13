import type { ThrottleStatus } from "./ThrottleStatus";

export type CostExtensions = {
  requestedQueryCost?: number;
  actualQueryCost?: number;
  throttleStatus?: ThrottleStatus;
};
