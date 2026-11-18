import { MAX_ORDERS_PER_JOB } from "app/commons/constants";
import {
  ORDER_SELECTION_FIELDS,
  type OrderSelection,
} from "app/commons/orders/OrderSelection";
import {
  formatOrdersDashboardFilter,
  parseOrdersDashboardFilter,
} from "app/commons/orders/OrdersDashboardFilter";
import { translateEn, type Translate } from "app/commons/i18n/translate";
import type { OrderIdsForSelectionQuery } from "app/types/admin.generated";
import { RequestError } from "../core/errors/RequestError";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import { PackRepository } from "../packs/PackRepository.server";
import { buildOrdersSearchQuery } from "./buildOrdersSearchQuery";

const ORDER_GID_PATTERN = /^gid:\/\/shopify\/Order\/\d+$/;
const ORDERS_PAGE_SIZE = 250;
const INITIAL_EXPECTED_COST = 10;

const ORDER_IDS_FOR_SELECTION_QUERY = `#graphql
  query OrderIdsForSelection($first: Int!, $after: String, $query: String) {
    orders(
      first: $first
      after: $after
      query: $query
      sortKey: CREATED_AT
      reverse: true
    ) {
      nodes {
        id
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export function parseOrderSelection(
  formData: FormData,
  t: Translate = translateEn,
): OrderSelection {
  const mode = formData.get(ORDER_SELECTION_FIELDS.mode);
  const packIdValue = formData.get(ORDER_SELECTION_FIELDS.packId);
  const inPack =
    typeof packIdValue === "string" && packIdValue
      ? { packId: packIdValue }
      : {};

  if (mode === "filter") {
    const filter = formData.get(ORDER_SELECTION_FIELDS.filter);
    const excludedOrderIds = readOrderIds(
      formData,
      ORDER_SELECTION_FIELDS.excludedOrderIds,
      t,
    );
    return {
      mode: "filter",
      filter: parseOrdersDashboardFilter(
        typeof filter === "string" ? filter : null,
      ),
      ...(excludedOrderIds.length > 0 ? { excludedOrderIds } : {}),
      ...inPack,
    };
  }

  return {
    mode: "ids",
    orderIds: readOrderIds(formData, ORDER_SELECTION_FIELDS.orderIds, t),
    ...inPack,
  };
}

/** Order GIDs from a form field, without duplicates. Refuses anything else. */
function readOrderIds(
  formData: FormData,
  field: string,
  t: Translate,
): string[] {
  const orderIds = formData.getAll(field).map(String).filter(Boolean);

  const invalidIds = orderIds.filter((id) => !ORDER_GID_PATTERN.test(id));
  if (invalidIds.length > 0) {
    throw new RequestError(
      400,
      t("startJob.invalidOrderIds", { ids: invalidIds.join(", ") }),
    );
  }
  return Array.from(new Set(orderIds));
}

/** The order IDs a job should run on. Refuses an empty or oversized selection. */
export async function resolveOrderIds(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  selection: OrderSelection,
  t: Translate = translateEn,
): Promise<string[]> {
  if (selection.mode === "ids" && selection.packId) {
    await refuseOrdersOutsidePack(selection.orderIds, selection.packId, t);
  }

  const orderIds =
    selection.mode === "ids"
      ? selection.orderIds
      : await fetchOrderIdsMatching(
          admin,
          shopUrl,
          buildOrdersSearchQuery(
            selection.filter,
            selection.packId
              ? (await PackRepository.getOrThrow(selection.packId, t)).orderTag
              : null,
          ),
          MAX_ORDERS_PER_JOB,
        );

  if (orderIds.length === 0) {
    throw new RequestError(
      400,
      selection.mode === "ids"
        ? t("startJob.noOrdersSelected")
        : t("startJob.noOrdersInTab", {
            tab: formatOrdersDashboardFilter(selection.filter, t),
          }),
    );
  }

  if (orderIds.length > MAX_ORDERS_PER_JOB) {
    throw new RequestError(
      422,
      t("startJob.tooManyOrders", { max: MAX_ORDERS_PER_JOB }),
    );
  }

  if (selection.mode === "ids") return orderIds;

  const excluded = new Set(selection.excludedOrderIds);
  const keptIds = orderIds.filter((orderId) => !excluded.has(orderId));
  if (keptIds.length === 0) {
    throw new RequestError(400, t("startJob.noOrdersSelected"));
  }

  // Shopify search lags behind pack changes, so "all in this tab" can list
  // orders that already left it, or whose tags are still being updated
  const settledIds = await PackRepository.filterSettledOrders(
    keptIds,
    selection.packId ?? null,
  );
  if (settledIds.length === 0) {
    throw new RequestError(409, t("startJob.allOrdersUpdating"));
  }
  return settledIds;
}

/**
 * Ticked inside a pack, so they must all still be in it: one moved out
 * meanwhile (from another tab, or by another user) would otherwise run as
 * if it were part of the pack.
 */
async function refuseOrdersOutsidePack(
  orderIds: string[],
  packId: string,
  t: Translate,
): Promise<void> {
  await PackRepository.getOrThrow(packId, t);
  const inPack = new Set(await PackRepository.getOrderIds(packId));
  const outside = orderIds.filter((orderId) => !inPack.has(orderId));
  if (outside.length > 0) {
    throw new RequestError(
      409,
      t("startJob.ordersNotInPack", { count: outside.length }),
    );
  }
}

/**
 * Every order ID a Shopify search query matches. With `stopPast`, stops once
 * past that many: enough to know a selection is too big.
 */
export async function fetchOrderIdsMatching(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  query: string | null,
  stopPast = Infinity,
): Promise<string[]> {
  const orderIds: string[] = [];
  let after: string | null = null;

  do {
    const data: OrderIdsForSelectionQuery =
      await runGraphQL<OrderIdsForSelectionQuery>(
        admin,
        shopUrl,
        "OrderIdsForSelection",
        ORDER_IDS_FOR_SELECTION_QUERY,
        { first: ORDERS_PAGE_SIZE, after, query },
        INITIAL_EXPECTED_COST,
      );

    orderIds.push(...data.orders.nodes.map((order) => order.id));
    after = data.orders.pageInfo.hasNextPage
      ? (data.orders.pageInfo.endCursor ?? null)
      : null;
  } while (after && orderIds.length <= stopPast);

  return orderIds;
}
