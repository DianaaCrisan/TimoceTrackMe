import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "app/shopify.server";
import { RequestError } from "app/backend/core/errors/RequestError";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import {
  parseOrderSelection,
  resolveOrderIds,
} from "app/backend/orders/resolveOrderSelection.server";
import { PackRepository } from "app/backend/packs/PackRepository.server";
import { PackService } from "app/backend/packs/PackService.server";
import { LOCALE_PARAM, resolveLocale } from "app/commons/i18n/Locale";
import {
  createTranslator,
  translateEn,
  type Translate,
} from "app/commons/i18n/translate";
import { formatPackName } from "app/commons/packs/FulfillmentPack";
import {
  FILLING_PACK_TARGET,
  PACK_ACTION_FIELDS,
  PACK_ACTION_INTENTS,
  type PackActionIntent,
  type PackActionResponse,
} from "app/commons/packs/PackAction";

/**
 * Every change to packs: from the Packs page (create, lock, close…) and from
 * the dashboard's selection (add, move, remove orders). Answers with a
 * message to show, in the admin's language.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  let t = translateEn;

  try {
    const formData = await request.formData();
    t = createTranslator(resolveLocale(formData.get(LOCALE_PARAM)));

    const intent = parseIntent(formData.get(PACK_ACTION_FIELDS.intent), t);
    const context = {
      shop: session.shop,
      shopUrl: ShopifyUtils.getShopAdminUrl(session.shop),
    };
    const packId = () => {
      const value = formData.get(PACK_ACTION_FIELDS.packId);
      if (typeof value !== "string" || !value) {
        throw new RequestError(400, t("pack.error.notFound"));
      }
      return value;
    };
    const orderIds = () =>
      resolveOrderIds(
        admin,
        context.shopUrl,
        parseOrderSelection(formData, t),
        t,
      );
    const packName = (pack: Parameters<typeof formatPackName>[0]) =>
      formatPackName(pack, t);

    switch (intent) {
      case "create": {
        const pack = await PackRepository.createFillingPack(t);
        return ok(
          t("pack.done.created", {
            name: packName({
              day: pack.day.toISOString().slice(0, 10),
              daySequence: pack.daySequence,
            }),
          }),
        );
      }
      case "lock":
        await PackRepository.lock(packId(), t);
        return ok(t("pack.done.locked"));
      case "close": {
        const result = await PackService.close(
          admin,
          context,
          packId(),
          formData.get(PACK_ACTION_FIELDS.moveLeftovers) === "true",
          t,
        );
        return ok(
          result.movedTo
            ? t("pack.done.closedAndMoved", {
                count: result.movedCount,
                name: packName(result.movedTo),
              })
            : t("pack.done.closed"),
        );
      }
      case "reopen":
        await PackRepository.reopen(packId(), t);
        return ok(t("pack.done.reopened"));
      case "delete":
        await PackRepository.delete(packId(), t);
        return ok(t("pack.done.deleted"));
      case "retryTagging": {
        const { orderCount } = await PackService.retryTagging(
          context,
          packId(),
          t,
        );
        return ok(t("pack.done.retryingTags", { count: orderCount }));
      }
      case "addOrders": {
        const target = formData.get(PACK_ACTION_FIELDS.target);
        const result = await PackService.addOrders(
          context,
          await orderIds(),
          target === FILLING_PACK_TARGET || typeof target !== "string"
            ? { kind: "filling" }
            : { kind: "pack", packId: target },
          t,
        );
        return ok(
          joinParts([
            t("pack.done.added", {
              count: result.addedCount + result.movedCount,
              name: packName(result.pack),
            }),
            result.movedCount > 0
              ? t("pack.done.ofWhichMoved", { count: result.movedCount })
              : null,
            result.inClosedPackCount > 0
              ? t("pack.done.skippedClosed", {
                  count: result.inClosedPackCount,
                })
              : null,
          ]),
        );
      }
      case "removeOrders": {
        const result = await PackService.removeOrders(
          context,
          await orderIds(),
        );
        return ok(
          joinParts([
            t("pack.done.removed", { count: result.removedCount }),
            result.inClosedPackCount > 0
              ? t("pack.done.skippedClosed", {
                  count: result.inClosedPackCount,
                })
              : null,
          ]),
        );
      }
    }
  } catch (error) {
    if (error instanceof RequestError) {
      return respond(error.status, { ok: false, error: error.message });
    }

    console.error("AppError[Packs] a pack action failed.", error);
    return respond(500, {
      ok: false,
      error: t("pack.error.unexpected", {
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  }
};

function parseIntent(value: unknown, t: Translate): PackActionIntent {
  const intent = PACK_ACTION_INTENTS.find((known) => known === value);
  if (!intent) throw new RequestError(400, t("pack.error.unknownAction"));
  return intent;
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

function ok(message: string): Response {
  return respond(200, { ok: true, message });
}

function respond(status: number, body: PackActionResponse): Response {
  return Response.json(body, { status });
}
