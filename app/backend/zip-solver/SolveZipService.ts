import { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { addZipCodeToOrderMutation } from "./addZipCodeToOrderMutation";
import {
  getOrdersShippingInfoInBatches,
  ShopifyOrderShippingInfo,
} from "./getOrdersShippingInfoBatch";
import { getZipCodeSuggestions } from "./getZipCodeSuggestions";
import { AddressInput } from "./models/AddressInput";
import { ProcessedOrderSolvedZip } from "./models/ProcessedOrderSolvedZip";
import { ProcessedOrderUnsolvedZip } from "./models/ProcessedOrderUnsolvedZip";
import { SolvedOrdersResponse } from "./models/SolvedOrdersResponse";
import {
  addUnsupportedOrder,
  UnsupportedOrder,
} from "./models/UnsupportedOrder";
import { ZipCodeSuggestionResponse } from "./models/ZipCodeSuggestionResponse";

export class SolveZipService {
  static async solveMissingZipCodesWithOrderIds(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    orderIds: string[],
    solveAllZips: boolean = false,
  ): Promise<SolvedOrdersResponse> {
    // throw new Error("");
    const unsupportedByOrder = new Map<string, UnsupportedOrder>();

    const fetchedOrders = await getOrdersShippingInfoInBatches(admin, orderIds);
    const fetchedOrderIds = new Set(fetchedOrders.map((order) => order.id));

    for (const orderId of orderIds) {
      if (!fetchedOrderIds.has(orderId)) {
        addUnsupportedOrder(unsupportedByOrder, orderId, undefined, [
          "Order not found in Shopify response.",
        ]);
      }
    }

    const shippableOrders = getValidShippableOrders(
      fetchedOrders,
      unsupportedByOrder,
    );

    const toBeSolvedOrders = solveAllZips
      ? shippableOrders
      : shippableOrders.filter((order) => !order.shippingAddress?.zip);

    return this.solveInBulk(
      admin,
      shopUrl,
      toBeSolvedOrders,
      unsupportedByOrder,
    );
  }

  static async solveInBulk(
    admin: AdminApiContextWithoutRest,
    shopUrl: string,
    toBeSolvedOrders: ShopifyOrderShippingInfo[],
    unsupportedByOrder: Map<string, UnsupportedOrder>,
  ): Promise<SolvedOrdersResponse> {
    const mappedAddresses = mapOrdersToAddressInputs(toBeSolvedOrders);
    const addressSuggestions = await getZipCodeSuggestions(mappedAddresses);

    const { solved, unsolved } = categorizeSuggestionResults(
      addressSuggestions,
      toBeSolvedOrders,
    );

    for (const solvedOrder of solved) {
      try {
        await addZipCodeToOrderMutation(admin, shopUrl, {
          id: solvedOrder.id,
          shippingAddress: {
            zip: solvedOrder.zipCode,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error ?? "Unknown error");

        addUnsupportedOrder(
          unsupportedByOrder,
          solvedOrder.id,
          solvedOrder.name,
          [message],
        );
      }
    }

    return {
      processedOrdersSolvedZip: solved,
      processedOrdersUnsolvedZip: unsolved,
      unsupportedOrders: Array.from(unsupportedByOrder.values()),
    };
  }
}

function getValidShippableOrders(
  orders: ShopifyOrderShippingInfo[],
  unsupportedByOrder: Map<string, UnsupportedOrder>,
): ShopifyOrderShippingInfo[] {
  const shippableOrders: ShopifyOrderShippingInfo[] = [];

  for (const order of orders) {
    try {
      if (!isPickupOrder(order)) {
        shippableOrders.push(order);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Unknown error");

      addUnsupportedOrder(unsupportedByOrder, order.id, order.name, [message]);
    }
  }

  return shippableOrders;
}

/**
 * Assumption: only one delivery method per order.
 * If pickup - no need for ZIP.
 * If not pickup - returns false.
 */
function isPickupOrder(order: ShopifyOrderShippingInfo): boolean {
  const shippingLines = order.shippingLines?.edges ?? [];

  if (shippingLines.length === 0) {
    throw new Error(`Shipping lines not found for order ${order.id}.`);
  }

  const taxLines = shippingLines[0]?.node?.taxLines ?? [];

  return taxLines.length === 0;
}

function mapOrderToAddressInput(
  order: ShopifyOrderShippingInfo,
): AddressInput | undefined {
  if (!order.shippingAddress) {
    return undefined;
  }

  return {
    orderId: order.id,
    addressLine: order.shippingAddress.address1,
    city: order.shippingAddress.city,
    county: order.shippingAddress.provinceCode,
  };
}

function mapOrdersToAddressInputs(
  orders: ShopifyOrderShippingInfo[],
): AddressInput[] {
  return orders.flatMap((order) => {
    const addressInput = mapOrderToAddressInput(order);
    return addressInput ? [addressInput] : [];
  });
}

function categorizeSuggestionResults(
  suggestions: ZipCodeSuggestionResponse[],
  originalOrders: ShopifyOrderShippingInfo[],
): {
  solved: ProcessedOrderSolvedZip[];
  unsolved: ProcessedOrderUnsolvedZip[];
} {
  const orderMap = new Map(originalOrders.map((order) => [order.id, order]));

  const solved: ProcessedOrderSolvedZip[] = [];
  const unsolved: ProcessedOrderUnsolvedZip[] = [];

  for (const suggestion of suggestions) {
    const order = orderMap.get(suggestion.orderId);

    if (!order) {
      continue;
    }

    if (checkIsSolved(suggestion)) {
      solved.push(mapToProcessedOrderSolvedZip(order, suggestion));
    } else {
      unsolved.push({
        id: order.id,
        name: order.name,
        confidenceLevel: suggestion.confidence,
        error: suggestion.error,
        address1: order.shippingAddress?.address1,
        city: order.shippingAddress?.city,
        provinceCode: order.shippingAddress?.provinceCode,
      });
    }
  }

  return { solved, unsolved };
}

function mapToProcessedOrderSolvedZip(
  order: ShopifyOrderShippingInfo,
  suggestion: ZipCodeSuggestionResponse,
): ProcessedOrderSolvedZip {
  return {
    id: order.id,
    name: order.name,
    confidenceLevel: suggestion.confidence,
    error: suggestion.error,
    address1: order.shippingAddress?.address1,
    city: order.shippingAddress?.city,
    provinceCode: order.shippingAddress?.provinceCode,
    zipCode: suggestion.suggestions[0].postal_code!,
  };
}

function checkIsSolved(suggestion: ZipCodeSuggestionResponse): boolean {
  return Boolean(
    (suggestion.confidence === "high" || suggestion.confidence === "medium") &&
    suggestion.suggestions.length > 0 &&
    suggestion.suggestions[0]?.postal_code,
  );
}
