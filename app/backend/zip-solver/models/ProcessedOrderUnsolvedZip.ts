export type ProcessedOrderUnsolvedZip = {
  name: string;
  id: string;
  confidenceLevel: string;
  error: string | null;
  address1?: string | null;
  city?: string | null;
  provinceCode?: string | null;
};
