/**
 * Shopify's delivery method for an order picked up in store. Every other
 * method (shipping, local delivery, pickup point...) is a delivery.
 *
 * The one rule for "pickup" across the app: the dashboard column, the labels
 * PDF and the unfulfilled report all use it.
 */
export const PICK_UP_METHOD_TYPE = "PICK_UP";

export function isPickupDeliveryMethod(
  methodType: string | null | undefined,
): boolean {
  return methodType === PICK_UP_METHOD_TYPE;
}
