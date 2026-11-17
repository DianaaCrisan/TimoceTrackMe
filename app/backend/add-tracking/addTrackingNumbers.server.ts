import { createPool } from "app/backend/graphql/throttle-handling/helpers/createPool";
import { createProgressLogger } from "app/backend/graphql/throttle-handling/helpers/createProgressLogger";
import { scheduleWithProgress } from "app/backend/graphql/throttle-handling/helpers/scheduleWithProgress";
import {
  getOrdersTrackingInputDataInBatches,
  type TrackingInputFulfillmentOrder,
  type TrackingInputOrder,
} from "./getOrdersTrackingInputData.server";
import { addTrackingNumberToFulfillment } from "./addTrackingNumberToFulfillment.server";
import type {
  AddTrackingNumbersFailedOrder,
  AddTrackingNumbersRequest,
  AddTrackingNumbersResult,
  AddTrackingNumbersSuccessfulOrder,
} from "./addTrackingNumbers.types";
import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { ADD_TRACKING_GRAPHQL_POOL_WORKERS } from "../graphql/throttle-handling/constants";
import { createOptimusTrackingNumber } from "../optimus/createOptimusTrackingNumber.server";
import { isEligibleForFulfillment } from "../graphql/utils/fulfillment-order-utils";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";
import { isOptimusInvalidZipError } from "../optimus/isOptimusInvalidZipError";
import { addZipCodeToOrderMutation } from "../zip-solver/addZipCodeToOrder.server";
import { ZIP_TO_FIX_ORDER_TAG } from "app/commons/constants";
import { normalizeZip, type ManualZips } from "app/commons/orders/ManualZips";
import { addZipToFixTag, removeZipToFixTag } from "./zipToFixTag.server";
import { ZipRecovery, type ZipChange } from "./ZipRecovery.server";
import {
  packIntoParcels,
  type PackableItem,
  type PackedParcel,
} from "./packIntoParcels";
import {
  getSplitLimitKg,
  type ParcelWeightSettings,
} from "app/commons/settings/ParcelWeightSettings";
import { formatKilogramsForAwb } from "app/commons/shipping/Weight";
import { ShippingLabelRepository } from "../shipping-labels/ShippingLabelRepository.server";
import type { GeneratedLabelInput } from "../shipping-labels/GeneratedLabelInput";

type AddTrackingDeps = {
  getOrders: typeof getOrdersTrackingInputDataInBatches;
  createAwb: typeof createOptimusTrackingNumber;
  addTrackingToFulfillment: typeof addTrackingNumberToFulfillment;
  createZipRecovery: (
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
  ) => ZipRecovery;
  saveZip: (
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderId: string,
    zip: string,
  ) => Promise<void>;
  addZipToFixTag: typeof addZipToFixTag;
  removeZipToFixTag: typeof removeZipToFixTag;
  /** For the AWB report. */
  recordGeneratedLabel: (
    label: GeneratedLabelInput,
    generatedAt: Date,
  ) => Promise<void>;
  markLabelAddedToShopify: (
    trackingNumber: string,
    fulfillmentId: string,
  ) => Promise<void>;
};

const defaultDeps: AddTrackingDeps = {
  getOrders: getOrdersTrackingInputDataInBatches,
  createAwb: createOptimusTrackingNumber,
  addTrackingToFulfillment: addTrackingNumberToFulfillment,
  createZipRecovery: (admin, shopUrl) => new ZipRecovery(admin, shopUrl),
  saveZip: async (admin, shopUrl, orderId, zip) => {
    await addZipCodeToOrderMutation(admin, shopUrl, {
      id: orderId,
      shippingAddress: { zip },
    });
  },
  addZipToFixTag,
  removeZipToFixTag,
  recordGeneratedLabel: (label, generatedAt) =>
    ShippingLabelRepository.recordGenerated(label, generatedAt),
  markLabelAddedToShopify: (trackingNumber, fulfillmentId) =>
    ShippingLabelRepository.markAddedToShopify(trackingNumber, fulfillmentId),
};

/** Optimus refused the order's ZIP and it could not be fixed in this run. */
class ZipProblemError extends Error {}

/**
 * Creates an Optimus AWB for every parcel of the shipping fulfillment orders
 * that still have items to ship, and fulfills each parcel in Shopify with its
 * tracking number.
 *
 * Parcels: a fulfillment order is one parcel, unless auto split is on and it
 * weighs more than the limit (`request.parcelWeight`). Then it is packed into
 * several parcels, each its own AWB and its own Shopify fulfillment. An order
 * with several parcels numbers them ("2/3") on the AWB.
 *
 * ZIPs the admin typed (`request.manualZips`) are saved to the orders first.
 * Every other ZIP is solved automatically (see `ZipRecovery`):
 * - orders without a ZIP are solved in one batch before any AWB is created
 * - when Optimus rejects a ZIP, the order is solved once more and the AWB
 *   retried once. Optimus keeps the rejected AWB; it is never fulfilled.
 *
 * Orders that still fail on their ZIP get the `ZIP_TO_FIX_ORDER_TAG`, so the
 * admin finds them on the "ZIP to fix" tab; every other order processed here
 * loses it.
 *
 * Every AWB is saved for the AWB report as soon as Optimus returns it, and
 * marked once it is on its Shopify fulfillment. Saving never stops shipping:
 * a failure only adds a warning to the order.
 */
export async function addTrackingNumbers(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  request: AddTrackingNumbersRequest,
  deps: AddTrackingDeps = defaultDeps,
): Promise<AddTrackingNumbersResult> {
  const successfulOrders: AddTrackingNumbersSuccessfulOrder[] = [];
  const failedOrders: AddTrackingNumbersFailedOrder[] = [];

  const orders = await deps.getOrders(admin, request.orderIds);
  const ordersById = new Map(orders.map((order) => [order.id, order]));

  const manualZipResults = await saveManualZips({
    admin,
    shopUrl,
    orders,
    manualZips: request.manualZips ?? {},
    deps,
    failedOrders,
  });

  const zipRecovery = deps.createZipRecovery(admin, shopUrl);
  await zipRecovery.fillMissingZips(
    orders.filter(
      (order) =>
        !manualZipResults.has(order.id) &&
        getEligibleShippingFulfillmentOrders(order).length > 0,
    ),
  );

  const pool = createPool(ADD_TRACKING_GRAPHQL_POOL_WORKERS);
  const progress = createProgressLogger(
    "AddTrackingNumbers",
    request.orderIds.length,
  );

  await Promise.all(
    request.orderIds.map((orderId) =>
      scheduleWithProgress(pool, progress, orderId, async () => {
        const manualZip = manualZipResults.get(orderId);
        // the ZIP could not be saved, so the order already failed
        if (manualZip?.isSaveFailed) return;

        await processOneOrder({
          admin,
          shopUrl,
          orderId,
          order: ordersById.get(orderId),
          zipRecovery,
          manualZip,
          parcelWeight: request.parcelWeight,
          deps,
          successfulOrders,
          failedOrders,
        });
      }),
    ),
  );

  await syncZipToFixTags({
    admin,
    shopUrl,
    ordersById,
    successfulOrders,
    failedOrders,
    deps,
  });

  return {
    ok: failedOrders.length === 0,
    successfulOrders,
    failedOrders,
  };
}

async function processOneOrder({
  admin,
  shopUrl,
  orderId,
  order,
  zipRecovery,
  manualZip,
  parcelWeight,
  deps,
  successfulOrders,
  failedOrders,
}: {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  orderId: string;
  order?: TrackingInputOrder;
  zipRecovery: ZipRecovery;
  /** Set when the admin typed this order's ZIP. */
  manualZip?: ManualZipResult;
  parcelWeight?: ParcelWeightSettings;
  deps: AddTrackingDeps;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
}) {
  try {
    if (!order) {
      failedOrders.push({
        id: orderId,
        name: "-",
        errors: ["Order was not returned by Shopify."],
      });
      return;
    }

    const shippingFulfillmentOrders =
      getEligibleShippingFulfillmentOrders(order);

    if (shippingFulfillmentOrders.length === 0) {
      return;
    }

    if (!order.shippingAddress?.zip) {
      const reason = zipRecovery.getMissingZipReason(order.id);
      failedOrders.push({
        id: order.id,
        name: order.name,
        errors: [
          reason
            ? `Missing shipping ZIP code, and it could not be solved automatically: ${reason}.`
            : "Missing shipping ZIP code.",
        ],
        isZipProblem: true,
      });
      return;
    }

    const parcels = planOrderParcels(
      shippingFulfillmentOrders,
      parcelWeight ? getSplitLimitKg(parcelWeight) : null,
    );
    const limitKg = parcelWeight?.parcelWeightLimitKg ?? null;

    const createdTrackingNumbers: string[] = [];
    const warnings: string[] = [];
    const saveForReport = async (save: () => Promise<void>) => {
      try {
        await save();
      } catch (error) {
        warnings.push(
          `Could not save the AWB for the AWB report: ${errorMessage(error)}`,
        );
      }
    };
    let failure: { error: string; isZipProblem: boolean } | undefined;

    for (const [index, parcel] of parcels.entries()) {
      const parcelPosition =
        parcels.length > 1 ? `${index + 1}/${parcels.length}` : undefined;
      const parcelLabel = describeParcel(parcel, parcelPosition);

      try {
        const awbResponse = await createAwbWithZipRetry(
          order,
          { weightKg: parcel.weightKg, parcelPosition },
          zipRecovery,
          deps,
          manualZip !== undefined,
        );

        const { trackingNumber } = awbResponse;

        // before Shopify: Optimus has the AWB even if the next step fails
        await saveForReport(() =>
          deps.recordGeneratedLabel(
            {
              trackingNumber,
              orderId: order.id,
              orderName: order.name,
              orderCreatedAt: new Date(order.createdAt),
              fulfillmentOrderId: parcel.fulfillmentOrderId,
              weightKg: parcel.weightKg,
              parcelPosition: parcelPosition ?? null,
            },
            new Date(),
          ),
        );

        const fulfillmentId = await deps.addTrackingToFulfillment(
          admin,
          shopUrl,
          {
            fulfillmentOrderId: parcel.fulfillmentOrderId,
            fulfillmentOrderLineItems: parcel.items.map(({ id, quantity }) => ({
              id,
              quantity,
            })),
            trackingNumber,
          },
        );

        createdTrackingNumbers.push(trackingNumber);
        await saveForReport(() =>
          deps.markLabelAddedToShopify(trackingNumber, fulfillmentId),
        );
        const weightWarning = describeWeightWarning(
          parcel,
          parcelLabel,
          limitKg,
        );
        if (weightWarning) warnings.push(weightWarning);
      } catch (parcelError) {
        // Stop at the first failure: the parcels left would carry numbers from
        // a set that is no longer complete. Adding tracking again ships them.
        failure = {
          error: `${parcelLabel}: ${errorMessage(parcelError)}`,
          isZipProblem: parcelError instanceof ZipProblemError,
        };
        break;
      }
    }

    const zipChange = manualZip?.change ?? zipRecovery.getChange(order.id);

    if (!failure && createdTrackingNumbers.length > 0) {
      successfulOrders.push({
        id: order.id,
        name: order.name,
        trackingNumbers: createdTrackingNumbers,
        zipChange,
        ...(warnings.length > 0 ? { warnings } : {}),
      });
      return;
    }

    const errors = [
      ...(createdTrackingNumbers.length > 0
        ? [
            `${createdTrackingNumbers.length} of ${parcels.length} parcels were shipped (${createdTrackingNumbers.join(", ")}). Add tracking again to ship the rest.`,
          ]
        : []),
      failure?.error ?? "No tracking numbers were created for this order.",
      ...warnings,
    ];

    failedOrders.push({
      id: order.id,
      name: order.name,
      errors,
      zipChange,
      isZipProblem: failure?.isZipProblem ?? false,
    });
  } catch (error) {
    failedOrders.push({
      id: orderId,
      name: order?.name ?? "-",
      errors: [error instanceof Error ? error.message : String(error)],
    });
  }
}

/**
 * Creates the AWB; if Optimus rejects the ZIP, solves it and retries once.
 * The order is patched in place, so its later fulfillment orders use the new
 * ZIP from the start. A ZIP the admin typed is never solved again.
 *
 * Throws `ZipProblemError` when the order ends up without a ZIP Optimus takes.
 */
async function createAwbWithZipRetry(
  order: TrackingInputOrder,
  parcel: AwbParcel,
  zipRecovery: ZipRecovery,
  deps: AddTrackingDeps,
  isZipEnteredByHand: boolean,
): Promise<{ trackingNumber: string }> {
  try {
    return await deps.createAwb(buildAwbRequest(order, parcel));
  } catch (error) {
    if (!isOptimusInvalidZipError(error)) throw error;

    const rejectedZip = order.shippingAddress?.zip ?? "";
    if (isZipEnteredByHand) {
      throw new ZipProblemError(
        `Optimus rejected ZIP ${rejectedZip}, which was entered by hand. ${errorMessage(error)}`,
      );
    }

    const decision = await zipRecovery.retryAfterRejection(order);
    if (!decision.shouldRetry) {
      throw new ZipProblemError(
        `Optimus rejected ZIP ${rejectedZip}, and it could not be solved automatically: ${decision.reason}. ${errorMessage(error)}`,
      );
    }

    try {
      return await deps.createAwb(buildAwbRequest(order, parcel));
    } catch (retryError) {
      if (isOptimusInvalidZipError(retryError)) {
        throw new ZipProblemError(errorMessage(retryError));
      }
      throw retryError;
    }
  }
}

type ManualZipResult = {
  /** Unset when the typed ZIP is the one the order already had. */
  change?: ZipChange;
  isSaveFailed?: boolean;
};

/**
 * Saves the ZIPs the admin typed to the orders in Shopify and patches the
 * in-memory orders, so the AWBs use them. An order whose ZIP cannot be saved
 * fails here and gets no AWB: the label would not match the order.
 */
async function saveManualZips({
  admin,
  shopUrl,
  orders,
  manualZips,
  deps,
  failedOrders,
}: {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  orders: TrackingInputOrder[];
  manualZips: ManualZips;
  deps: AddTrackingDeps;
  failedOrders: AddTrackingNumbersFailedOrder[];
}): Promise<Map<string, ManualZipResult>> {
  const results = new Map<string, ManualZipResult>();
  const pool = createPool(ADD_TRACKING_GRAPHQL_POOL_WORKERS);

  await Promise.all(
    orders.map((order) => {
      const typedZip = manualZips[order.id];
      if (typedZip === undefined) return undefined;

      return pool.schedule(async () => {
        const zip = normalizeZip(typedZip);
        const address = order.shippingAddress;

        if (!address) {
          results.set(order.id, { isSaveFailed: true });
          failedOrders.push({
            id: order.id,
            name: order.name,
            errors: [
              `ZIP ${zip} was not saved: the order has no shipping address.`,
            ],
          });
          return;
        }

        const previousZip = address.zip ?? null;
        if (zip === previousZip) {
          results.set(order.id, {});
          return;
        }

        try {
          await deps.saveZip(admin, shopUrl, order.id, zip);
          address.zip = zip;
          results.set(order.id, {
            change: { previousZip, newZip: zip, isEnteredByHand: true },
          });
        } catch (error) {
          results.set(order.id, { isSaveFailed: true });
          failedOrders.push({
            id: order.id,
            name: order.name,
            errors: [
              `Could not save ZIP ${zip} to the order: ${errorMessage(error)}`,
            ],
            isZipProblem: true,
          });
        }
      });
    }),
  );

  return results;
}

/**
 * Puts the orders that failed on their ZIP on the "ZIP to fix" tab, and takes
 * every other processed order off it. Tags only orders that do not have the
 * tag yet (and untags only those that do), so a normal run costs no calls.
 */
async function syncZipToFixTags({
  admin,
  shopUrl,
  ordersById,
  successfulOrders,
  failedOrders,
  deps,
}: {
  admin: AdminApiContextWithoutRest;
  shopUrl: string;
  ordersById: Map<string, TrackingInputOrder>;
  successfulOrders: AddTrackingNumbersSuccessfulOrder[];
  failedOrders: AddTrackingNumbersFailedOrder[];
  deps: AddTrackingDeps;
}): Promise<void> {
  const hasTag = (orderId: string) =>
    ordersById.get(orderId)?.tags.includes(ZIP_TO_FIX_ORDER_TAG) ?? false;
  const pool = createPool(ADD_TRACKING_GRAPHQL_POOL_WORKERS);

  const toTag = failedOrders.filter(
    (order) =>
      order.isZipProblem && ordersById.has(order.id) && !hasTag(order.id),
  );
  const toUntag = [
    ...successfulOrders,
    ...failedOrders.filter((order) => !order.isZipProblem),
  ].filter((order) => hasTag(order.id));

  await Promise.all([
    ...toTag.map((order) =>
      pool.schedule(async () => {
        try {
          await deps.addZipToFixTag(admin, shopUrl, order.id);
        } catch (error) {
          order.errors.push(
            `Could not add the "${ZIP_TO_FIX_ORDER_TAG}" tag, so the order is not on the "ZIP to fix" tab: ${errorMessage(error)}`,
          );
        }
      }),
    ),
    ...toUntag.map((order) =>
      pool.schedule(async () => {
        try {
          await deps.removeZipToFixTag(admin, shopUrl, order.id);
        } catch (error) {
          // a fulfilled order leaves the tab anyway; only a failed one stays
          console.error(
            `AppError[AddTracking] could not remove the "${ZIP_TO_FIX_ORDER_TAG}" tag from ${order.id}.`,
            error,
          );
          if ("errors" in order) {
            order.errors.push(
              `Could not remove the "${ZIP_TO_FIX_ORDER_TAG}" tag: ${errorMessage(error)}`,
            );
          }
        }
      }),
    ),
  ]);
}

type AwbParcel = { weightKg: number; parcelPosition?: string };

function buildAwbRequest(order: TrackingInputOrder, parcel: AwbParcel) {
  return {
    orderName: order.name,
    email: order.email ?? undefined,
    name: order.shippingAddress?.name ?? order.name,
    phoneNumber: order.shippingAddress?.phone ?? order.phone ?? "",
    createdAt: order.createdAt,
    address: buildFullAddress(order),
    province: order.shippingAddress?.province ?? "",
    city: order.shippingAddress?.city ?? "",
    country: order.shippingAddress?.country ?? "",
    zip: order.shippingAddress?.zip ?? "",
    invoiceDetails: parcel.parcelPosition
      ? `Comanda ${order.name} (colet ${parcel.parcelPosition})`
      : `Comanda ${order.name}`,
    weightKg: parcel.weightKg,
    parcelPosition: parcel.parcelPosition,
    formatted: order.shippingAddress?.formatted.join(", ") ?? "",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getEligibleShippingFulfillmentOrders(
  order: TrackingInputOrder,
): TrackingInputFulfillmentOrder[] {
  return order.fulfillmentOrders.filter((fulfillmentOrder) => {
    if (fulfillmentOrder.deliveryMethod !== "SHIPPING") {
      return false;
    }

    if (!isEligibleForFulfillment(fulfillmentOrder.status)) {
      return false;
    }

    return fulfillmentOrder.lineItems.some(
      (lineItem) => lineItem.remainingQuantity > 0,
    );
  });
}

type OrderParcel = PackedParcel & { fulfillmentOrderId: string };

/**
 * The order's parcels, in the order they are numbered. A parcel never mixes
 * fulfillment orders, because each parcel becomes one Shopify fulfillment.
 * Throws before any AWB exists when an item has no usable weight.
 */
function planOrderParcels(
  fulfillmentOrders: TrackingInputFulfillmentOrder[],
  splitLimitKg: number | null,
): OrderParcel[] {
  return fulfillmentOrders.flatMap((fulfillmentOrder) =>
    packIntoParcels(toPackableItems(fulfillmentOrder), splitLimitKg).map(
      (parcel) => ({ ...parcel, fulfillmentOrderId: fulfillmentOrder.id }),
    ),
  );
}

function toPackableItems(
  fulfillmentOrder: TrackingInputFulfillmentOrder,
): PackableItem[] {
  return fulfillmentOrder.lineItems
    .filter((lineItem) => lineItem.remainingQuantity > 0)
    .map((lineItem) => {
      const unitWeightKg = lineItem.weightKg;
      if (
        unitWeightKg == null ||
        !Number.isFinite(unitWeightKg) ||
        unitWeightKg <= 0
      ) {
        throw new Error(
          `Fulfillment ${ShopifyUtils.extractShopifyId(fulfillmentOrder.id)}: missing or invalid weight for item "${lineItem.name}".`,
        );
      }

      return {
        id: lineItem.fulfillmentOrderLineItemId,
        name: lineItem.name,
        quantity: lineItem.remainingQuantity,
        unitWeightKg,
      };
    });
}

function describeParcel(parcel: OrderParcel, parcelPosition?: string): string {
  const fulfillmentId = ShopifyUtils.extractShopifyId(
    parcel.fulfillmentOrderId,
  );
  return parcelPosition
    ? `Parcel ${parcelPosition} (fulfillment ${fulfillmentId})`
    : `Fulfillment ${fulfillmentId}`;
}

/** Set when the parcel shipped heavier than the admin's limit. */
function describeWeightWarning(
  parcel: PackedParcel,
  parcelLabel: string,
  limitKg: number | null,
): string | undefined {
  if (limitKg === null || parcel.weightKg <= limitKg) return undefined;

  const weight = `${formatKilogramsForAwb(parcel.weightKg)} kg`;
  const limit = `${formatKilogramsForAwb(limitKg)} kg`;

  return parcel.isOverLimit
    ? `${parcelLabel}: "${parcel.items[0].name}" alone weighs ${weight}, over the ${limit} limit, so it ships in a parcel of its own.`
    : `${parcelLabel} weighs ${weight}, over the ${limit} limit. Auto split is off, so it ships as one parcel.`;
}

function buildFullAddress(order: TrackingInputOrder): string {
  const addressParts = [
    order.shippingAddress?.address1,
    order.shippingAddress?.address2,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const fullAddress = addressParts.join(", ");

  if (!fullAddress) {
    throw new Error("Missing shipping address.");
  }

  if (!order.shippingAddress?.city) {
    throw new Error("Missing shipping city.");
  }

  if (!order.shippingAddress?.province) {
    throw new Error("Missing shipping province.");
  }

  if (!order.shippingAddress?.country) {
    throw new Error("Missing shipping country.");
  }

  if (!order.shippingAddress?.zip) {
    throw new Error("Missing shipping ZIP/postal code.");
  }

  const phoneNumber = order.shippingAddress.phone ?? order.phone;
  if (!phoneNumber) {
    throw new Error("Missing recipient phone number.");
  }

  return fullAddress;
}
