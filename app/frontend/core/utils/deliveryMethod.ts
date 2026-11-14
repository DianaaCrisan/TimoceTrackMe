import {
  translateEn,
  translateShopifyEnum,
  type Translate,
} from "app/commons/i18n/translate";

export enum DeliveryMethodTypeDTO {
  LOCAL = "LOCAL",
  NONE = "NONE",
  PICK_UP = "PICK_UP",
  PICKUP_POINT = "PICKUP_POINT",
  RETAIL = "RETAIL",
  SHIPPING = "SHIPPING",
}

export function formatDeliveryMethodType(
  methodType?: string | null,
  t: Translate = translateEn,
): string {
  if (!methodType) return "—";
  return translateShopifyEnum(t, "deliveryMethod", methodType);
}
