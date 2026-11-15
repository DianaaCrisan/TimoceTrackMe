import { isPickupDeliveryMethod } from "app/commons/orders/isPickupDeliveryMethod";
import {
  getOrderNumber,
  isOrderInInterval,
  type OrderInterval,
} from "app/commons/unfulfilled-report/OrderInterval";
import type {
  ReportPack,
  ReportRow,
  ReportSection,
  UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { formatOrderRanges } from "../print-labels/utils/formatOrderRanges";
import type { OpenFulfillmentOrder } from "./fetchOpenFulfillmentOrders.server";

/** Limits a report to one pack's orders. */
export type ReportPackScope = {
  pack: ReportPack;
  orderIds: ReadonlySet<string>;
};

/**
 * Adds up what is left to fulfil, per product variant, separately for
 * delivery and pickup (by Shopify's delivery method, per fulfillment order).
 *
 * - Only orders in `interval` count, and with `packScope`, only that pack's.
 * - An order split into a delivery and a pickup fulfillment order shows up in
 *   both sections, each with its own items.
 * - Items without a variant (custom items) are grouped by name.
 */
export function buildUnfulfilledReport(
  fulfillmentOrders: OpenFulfillmentOrder[],
  interval: OrderInterval,
  generatedAt: Date,
  packScope: ReportPackScope | null = null,
): UnfulfilledReport {
  const delivery = new SectionBuilder();
  const pickup = new SectionBuilder();

  for (const fulfillmentOrder of fulfillmentOrders) {
    if (fulfillmentOrder.lineItems.length === 0) continue;
    if (!isOrderInInterval(fulfillmentOrder.orderName, interval)) continue;
    if (packScope && !packScope.orderIds.has(fulfillmentOrder.orderId)) {
      continue;
    }

    const section = isPickupDeliveryMethod(fulfillmentOrder.methodType)
      ? pickup
      : delivery;
    section.add(
      fulfillmentOrder.orderName,
      fulfillmentOrder.lineItems.map((item) => ({
        variantId: item.variantId,
        name: item.name,
        quantity: item.remainingQuantity,
      })),
    );
  }

  return {
    kind: "unfulfilled",
    interval,
    pack: packScope?.pack ?? null,
    generatedAt: generatedAt.toISOString(),
    delivery: delivery.build(),
    pickup: pickup.build(),
  };
}

/** An item counted in a report: what is left, or what was sold. */
export type ReportItem = {
  variantId: string | null;
  name: string;
  quantity: number;
};

/**
 * One section of a report: quantities added up per variant (items without
 * a variant by name), and the orders they came from.
 */
export class SectionBuilder {
  private orderNames = new Set<string>();
  private rowsByKey = new Map<string, ReportRow>();

  add(orderName: string, items: ReportItem[]): void {
    this.orderNames.add(orderName);

    for (const item of items) {
      const key = item.variantId ?? `name:${item.name}`;
      const row = this.rowsByKey.get(key);

      if (row) {
        row.quantity += item.quantity;
      } else {
        this.rowsByKey.set(key, {
          key,
          name: item.name,
          quantity: item.quantity,
        });
      }
    }
  }

  build(): ReportSection {
    const orderNames = [...this.orderNames].sort(compareOrderNames);
    const rows = [...this.rowsByKey.values()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }) || a.key.localeCompare(b.key),
    );

    return {
      orderNames,
      orderRanges: formatOrderRanges(orderNames),
      rows,
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    };
  }
}

/** "#999" before "#1002"; names without a number last, alphabetically. */
function compareOrderNames(a: string, b: string): number {
  const numberA = getOrderNumber(a);
  const numberB = getOrderNumber(b);

  if (numberA !== null && numberB !== null && numberA !== numberB) {
    return numberA - numberB;
  }
  if (numberA === null && numberB !== null) return 1;
  if (numberA !== null && numberB === null) return -1;
  return a.localeCompare(b);
}
