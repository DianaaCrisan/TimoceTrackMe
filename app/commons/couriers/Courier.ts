/**
 * The couriers the app knows. See docs/couriers/ for how each one behaves.
 * UNKNOWN: a tracking company we don't recognise, left for the admin to check.
 */
export type Courier = "OPTIMUS" | "UNKNOWN";

/** The tracking company TrackMe puts on the fulfillments it creates. */
export const OPTIMUS_TRACKING_COMPANY = "Optimus";

/** Optimus books the AWB, GLS carries the parcel: either name means Optimus. */
const OPTIMUS_COMPANY_PATTERN = /optimus|gls/i;

/** The courier behind the tracking company typed on a Shopify fulfillment. */
export function recogniseCourier(
  trackingCompany: string | null | undefined,
): Courier {
  return trackingCompany && OPTIMUS_COMPANY_PATTERN.test(trackingCompany)
    ? "OPTIMUS"
    : "UNKNOWN";
}
