import { getOptimusLabelPDF } from "../optimus/getOptimusLabelPDF.server";
import type { PrintLabelsOrder } from "./getOrdersPrintLabelsInputData.server";
import { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { LineItem } from "./models/LineItem";
import { generatePickupLabelPDF } from "./utils/generatePickupLabelPDF";

type Deps = {
  getCarrierLabelPDF: (trackingNumber: string) => Promise<Buffer>;
  generatePickupLabelPDF: typeof generatePickupLabelPDF;
};

export class LabelUnitFactory {
  constructor(
    private deps: Deps = {
      getCarrierLabelPDF: async (trackingNumber: string) =>
        (await getOptimusLabelPDF(trackingNumber)).pdfBuffer,
      generatePickupLabelPDF,
    },
  ) {}

  async buildForOrder(
    order: PrintLabelsOrder,
  ): Promise<{ units: LabelUnitDetails[]; labelUnitKind: LabelUnitKind }> {
    if (order.isPickup) {
      return {
        units: await this.buildPickupUnits(order),
        labelUnitKind: LabelUnitKind.PICKUP,
      };
    }

    return {
      units: await this.buildDeliveryUnits(order),
      labelUnitKind: LabelUnitKind.DELIVERY,
    };
  }

  private async buildPickupUnits(
    order: PrintLabelsOrder,
  ): Promise<LabelUnitDetails[]> {
    const pdfBytes = await this.deps.generatePickupLabelPDF({
      orderName: order.name,
      createdAt: order.createdAt,
      confirmationNumber: order.pickupData?.confirmationNumber,
      customer: {
        firstName: order.pickupData?.billingFirstName,
        lastName: order.pickupData?.billingLastName,
        email: order.pickupData?.email,
        phone: order.pickupData?.phone,
      },
    });

    const pickupPdf = Buffer.from(pdfBytes);
    const pickupUnits = order.pickupFulfillmentOrders
      .filter((fulfillmentOrder) => fulfillmentOrder.lineItems.length > 0)
      .map((fulfillmentOrder) => {
        const lineItems = fulfillmentOrder.lineItems.map((item) => {
          if (!item.variantId) {
            throw new Error(
              `Variant id missing for pickup item "${item.name}" in order ${order.id}.`,
            );
          }

          return new LineItem(
            item.variantId,
            item.quantity,
            item.name,
            item.sku,
          );
        });

        return {
          kind: LabelUnitKind.PICKUP,
          orderId: order.id,
          unitId: fulfillmentOrder.fulfillmentOrderId,
          displayName: LineItem.buildLineItemsDisplayName(lineItems),
          labelPDF: pickupPdf,
          lineItems,
          errors: [],
        } satisfies LabelUnitDetails;
      });

    return pickupUnits;
  }

  private async buildDeliveryUnits(
    order: PrintLabelsOrder,
  ): Promise<LabelUnitDetails[]> {
    const results: LabelUnitDetails[] = [];

    for (const fulfillment of order.deliveryFulfillments) {
      let labelPDF: Buffer | null = null;
      const errors: string[] = [];

      try {
        labelPDF = await this.deps.getCarrierLabelPDF(
          fulfillment.trackingNumber,
        );
      } catch (error) {
        errors.push(
          `Order ${order.name}: Label for tracking number '${fulfillment.trackingNumber}' failed to load: ${String(error)}`,
        );
      }

      const lineItems = fulfillment.lineItems.map((item) => {
        if (!item.variantId) {
          throw new Error(
            `Variant id missing for fulfillment ${fulfillment.fulfillmentId} in order ${order.name}.`,
          );
        }

        return new LineItem(
          item.variantId,
          item.quantity,
          item.name,
          item.sku ?? undefined,
        );
      });

      results.push({
        kind: LabelUnitKind.DELIVERY,
        orderId: order.id,
        unitId: fulfillment.fulfillmentId,
        displayName: fulfillment.fulfillmentName,
        labelPDF,
        lineItems,
        trackingNumber: fulfillment.trackingNumber,
        errors,
      });
    }

    return results;
  }
}
