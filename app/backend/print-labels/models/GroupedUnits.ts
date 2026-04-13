import type { LabelUnitDetails } from "./LabelUnitDetails";
import { LineItem } from "./LineItem";

export type GroupedUnits = {
  key: string;
  items: LineItem[];
  units: LabelUnitDetails[]; // units that share this exact items signature
};
