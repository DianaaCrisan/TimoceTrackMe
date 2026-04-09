import type { ProcessedOrderUnsolvedZip } from "./ProcessedOrderUnsolvedZip";
import type { ProcessedOrderSolvedZip } from "./ProcessedOrderSolvedZip";
import { UnsupportedOrder } from "./UnsupportedOrder";

export type SolvedOrdersResponse = {
  processedOrdersSolvedZip: ProcessedOrderSolvedZip[];
  processedOrdersUnsolvedZip: ProcessedOrderUnsolvedZip[];
  unsupportedOrders: UnsupportedOrder[];
};
