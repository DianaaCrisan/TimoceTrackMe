import { LabelUnitIdentifier } from "./LabelUnitIdentifier";
import type { LabelUnitKind } from "./LabelUnitKind";
import { LineItem } from "./LineItem";

export type LabelUnitDetails = LabelUnitIdentifier & {
  kind: LabelUnitKind;

  // content
  labelPDF: Buffer | null;
  lineItems: LineItem[];

  // delivery-only metadata
  trackingNumber?: string;

  // per-unit errors (don’t fail the whole order)
  errors: string[];
};
