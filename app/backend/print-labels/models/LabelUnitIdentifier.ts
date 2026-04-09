export type LabelUnitIdentifier = {
  orderId: string;
  unitId: string; // delivery: fulfillment GID; pickup: fulfillment order GID
  displayName: string; // e.g., "#1203-F1" for delivery; "item A(Spain)(2), item B(Ecuador)(3)..." for pickup
};
