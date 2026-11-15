import type { Translate } from "app/commons/i18n/translate";
import { RequestError } from "../core/errors/RequestError";
import { PackRepository } from "../packs/PackRepository.server";
import type { ReportPackScope } from "./buildUnfulfilledReport";

/**
 * The pack a report covers, with its orders from the database rather than
 * by its tag: an order just added is in the report even before Shopify
 * search shows its tag.
 */
export async function loadReportPackScope(
  packId: string,
  t: Translate,
): Promise<ReportPackScope> {
  const pack = await PackRepository.get(packId);
  if (!pack) throw new RequestError(400, t("pack.error.notFound"));

  return {
    pack: { id: pack.id, day: pack.day, daySequence: pack.daySequence },
    orderIds: new Set(await PackRepository.getOrderIds(packId)),
  };
}
