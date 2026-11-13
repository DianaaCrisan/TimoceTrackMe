import type {
  AddPrintedOrderTagMutation,
  MarkFulfillmentLabelPrintedMutation,
} from "app/types/admin.generated";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { createPool } from "../graphql/throttle-handling/helpers/createPool";
import { runGraphQL } from "../graphql/throttle-handling/helpers/runGraphQL";
import type { PrintedLabelUnit } from "./GroupedPdfComposer";
import { LabelUnitKind } from "./models/LabelUnitKind";

export const PRINTED_ORDER_TAG = "eticheta-printata";
export const LABEL_PRINTED_EVENT_MESSAGE = "Etichetă printată (TrackMe)";

const MARK_PRINTED_POOL_WORKERS = 4;
const INITIAL_EXPECTED_COST = 10;

const MARK_FULFILLMENT_LABEL_PRINTED_MUTATION = `#graphql
  mutation MarkFulfillmentLabelPrinted(
    $fulfillmentEvent: FulfillmentEventInput!
  ) {
    fulfillmentEventCreate(fulfillmentEvent: $fulfillmentEvent) {
      fulfillmentEvent {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ADD_PRINTED_ORDER_TAG_MUTATION = `#graphql
  mutation AddPrintedOrderTag($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        field
        message
      }
    }
  }
`;

type Deps = {
  addLabelPrintedEvent: (
    fulfillmentId: string,
    happenedAt: Date,
  ) => Promise<void>;
  addPrintedTag: (orderId: string) => Promise<void>;
  now: () => Date;
};

/**
 * Leaves a trace on every order whose label went into the PDF. Shopify's API
 * cannot write timeline comments, so instead:
 * - each delivery fulfillment gets a `LABEL_PRINTED` fulfillment event
 * - each order (delivery and pickup) gets the `eticheta-printata` tag, which
 *   the orders list can filter on
 *
 * Never throws: a label that printed stays printed, so failures are returned
 * per order for the report instead of failing the job.
 */
export async function markLabelsPrinted(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  printedUnits: PrintedLabelUnit[],
  deps: Deps = createDefaultDeps(admin, shopUrl),
): Promise<{ failuresByOrderId: Map<string, string[]> }> {
  const failuresByOrderId = new Map<string, string[]>();
  const recordFailure = (orderId: string, message: string) => {
    failuresByOrderId.set(orderId, [
      ...(failuresByOrderId.get(orderId) ?? []),
      message,
    ]);
  };

  const happenedAt = deps.now();
  const pool = createPool(MARK_PRINTED_POOL_WORKERS);

  const deliveryUnits = printedUnits.filter(
    (unit) => unit.kind === LabelUnitKind.DELIVERY,
  );
  const orderIds = Array.from(new Set(printedUnits.map((u) => u.orderId)));

  await Promise.all([
    ...deliveryUnits.map((unit) =>
      pool.schedule(async () => {
        try {
          await deps.addLabelPrintedEvent(unit.unitId, happenedAt);
        } catch (error) {
          recordFailure(
            unit.orderId,
            `Could not mark ${unit.displayName} as printed: ${errorMessage(error)}`,
          );
        }
      }),
    ),
    ...orderIds.map((orderId) =>
      pool.schedule(async () => {
        try {
          await deps.addPrintedTag(orderId);
        } catch (error) {
          recordFailure(
            orderId,
            `Could not add the "${PRINTED_ORDER_TAG}" tag: ${errorMessage(error)}`,
          );
        }
      }),
    ),
  ]);

  return { failuresByOrderId };
}

function createDefaultDeps(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
): Deps {
  return {
    now: () => new Date(),

    addLabelPrintedEvent: async (fulfillmentId, happenedAt) => {
      const data = await runGraphQL<MarkFulfillmentLabelPrintedMutation>(
        admin,
        shopUrl,
        "MarkFulfillmentLabelPrinted",
        MARK_FULFILLMENT_LABEL_PRINTED_MUTATION,
        {
          fulfillmentEvent: {
            fulfillmentId,
            status: "LABEL_PRINTED",
            message: LABEL_PRINTED_EVENT_MESSAGE,
            happenedAt: happenedAt.toISOString(),
          },
        },
        INITIAL_EXPECTED_COST,
      );
      throwOnUserErrors(data.fulfillmentEventCreate?.userErrors);
    },

    addPrintedTag: async (orderId) => {
      const data = await runGraphQL<AddPrintedOrderTagMutation>(
        admin,
        shopUrl,
        "AddPrintedOrderTag",
        ADD_PRINTED_ORDER_TAG_MUTATION,
        { id: orderId, tags: [PRINTED_ORDER_TAG] },
        INITIAL_EXPECTED_COST,
      );
      throwOnUserErrors(data.tagsAdd?.userErrors);
    },
  };
}

function throwOnUserErrors(
  userErrors: { message: string }[] | null | undefined,
): void {
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
