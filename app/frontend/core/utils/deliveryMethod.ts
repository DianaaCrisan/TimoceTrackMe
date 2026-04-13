export enum DeliveryMethodTypeDTO {
  LOCAL = "LOCAL",
  NONE = "NONE",
  PICK_UP = "PICK_UP",
  PICKUP_POINT = "PICKUP_POINT",
  RETAIL = "RETAIL",
  SHIPPING = "SHIPPING",
}

export function formatDeliveryMethodType(methodType?: string | null): string {
  if (!methodType) return "—";
  const formatted = methodType.toLowerCase().replace(/_/g, " ");
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
