import type { ProcessedOrderUnsolvedZip } from "./ProcessedOrderUnsolvedZip";

export type ProcessedOrderSolvedZip = ProcessedOrderUnsolvedZip & {
  zipCode: string;
};
