import {
  isValidZip,
  MANUAL_ZIPS_FIELD,
  normalizeZip,
  type ManualZips,
} from "app/commons/orders/ManualZips";
import { translateEn, type Translate } from "app/commons/i18n/translate";
import { RequestError } from "../core/errors/RequestError";

/**
 * The ZIPs the admin typed, from the add tracking form. Unset when the form
 * has none. Refuses ZIPs for orders outside the job and ZIPs that are not six
 * digits, so nothing wrong is ever written to an order.
 */
export function parseManualZips(
  formData: FormData,
  orderIds: string[],
  t: Translate = translateEn,
): ManualZips | undefined {
  const raw = formData.get(MANUAL_ZIPS_FIELD);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RequestError(400, t("startJob.unreadableManualZips"));
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RequestError(400, t("startJob.unreadableManualZips"));
  }

  const jobOrderIds = new Set(orderIds);
  const manualZips: ManualZips = {};

  for (const [orderId, zip] of Object.entries(parsed)) {
    if (!jobOrderIds.has(orderId) || typeof zip !== "string") {
      throw new RequestError(400, t("startJob.unreadableManualZips"));
    }
    if (!isValidZip(zip)) {
      throw new RequestError(400, t("startJob.invalidManualZip", { zip }));
    }
    manualZips[orderId] = normalizeZip(zip);
  }

  return Object.keys(manualZips).length > 0 ? manualZips : undefined;
}
