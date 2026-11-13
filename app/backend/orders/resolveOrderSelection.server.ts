import { MAX_ORDERS_PER_JOB } from "app/commons/constants";
import {
  ORDER_SELECTION_FIELDS,
  type OrderSelection,
} from "app/commons/orders/OrderSelection";
import {
  formatOrdersDashboardFilter,
  parseOrdersDashboardFilter,
  type OrdersDashboardFilter,
} from "app/commons/orders/OrdersDashboardFilter";
import type { OrderIdsForSelectionQuery } from "app/types/admin.generated";
import { RequestError } from "../core/errors/RequestError";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
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

export function parseOrderSelection(formData: FormData): OrderSelection {
  const mode = formData.get(ORDER_SELECTION_FIELDS.mode);

  if (mode === "filter") {
    const filter = formData.get(ORDER_SELECTION_FIELDS.filter);
    return {
      mode: "filter",
      filter: parseOrdersDashboardFilter(
        typeof filter === "string" ? filter : null,
      ),
    };
  }

  const orderIds = formData
    .getAll(ORDER_SELECTION_FIELDS.orderIds)
    .map(String)
    .filter(Boolean);

  const invalidIds = orderIds.filter((id) => !ORDER_GID_PATTERN.test(id));
  if (invalidIds.length > 0) {
    throw new RequestError(400, `Invalid order IDs: ${invalidIds.join(", ")}.`);
  }

  return { mode: "ids", orderIds: Array.from(new Set(orderIds)) };
}

/** The order IDs a job should run on. Refuses an empty or oversized selection. */
export async function resolveOrderIds(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  selection: OrderSelection,
): Promise<string[]> {
  const orderIds =
    selection.mode === "ids"
      ? selection.orderIds
      : await fetchOrderIdsForFilter(admin, shopUrl, selection.filter);

  if (orderIds.length === 0) {
    throw new RequestError(
      400,
      selection.mode === "ids"
        ? "No orders were selected."
        : `No orders match the "${formatOrdersDashboardFilter(selection.filter)}" tab.`,
    );
  }

  if (orderIds.length > MAX_ORDERS_PER_JOB) {
    throw new RequestError(
      422,
      `A job can take at most ${MAX_ORDERS_PER_JOB} orders. This selection has more.`,
    );
  }

  return orderIds;
}

/** Stops one order past the cap: enough to know the selection is too big. */
async function fetchOrderIdsForFilter(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  filter: OrdersDashboardFilter,
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
        {
          first: ORDERS_PAGE_SIZE,
          after,
          query: buildOrdersSearchQuery(filter),
        },
        INITIAL_EXPECTED_COST,
      );

    orderIds.push(...data.orders.nodes.map((order) => order.id));
    after = data.orders.pageInfo.hasNextPage
      ? (data.orders.pageInfo.endCursor ?? null)
      : null;
  } while (after && orderIds.length <= MAX_ORDERS_PER_JOB);

  return orderIds;
}
