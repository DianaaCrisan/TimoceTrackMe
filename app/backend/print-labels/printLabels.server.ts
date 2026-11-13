import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getOrdersPrintLabelsInputData } from "./getOrdersPrintLabelsInputData.server";
import { GroupedPdfComposer } from "./GroupedPdfComposer";
import { LabelUnitFactory } from "./LabelUnitFactory";
import type { LabelUnitDetails } from "./models/LabelUnitDetails";
import type { LabelUnitIdentifier } from "./models/LabelUnitIdentifier";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { formatLabelsFileTimestamp } from "./utils/formatLabelsFileTimestamp";

type PrintLabelsRequest = {
  orderIds: string[];
  /** IANA time zone of the user, used to stamp the file names in local time */
  timeZone?: string | null;
};

export type PrintLabelsFile = {
  fileName: string;
  buf: Buffer;
};

export type PrintLabelsResult = {
  /** The shipping and/or pickup labels PDF; empty when no label could be made. */
  files: PrintLabelsFile[];
  /** The labels that made it into a PDF. */
  printedUnits: LabelUnitIdentifier[];
  /** Orders Shopify returned, by ID, so the caller can name every order. */
  orderNamesById: Map<string, string>;
  errors: string[];
  timestamp: string;
};

export async function buildPrintLabels(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  request: PrintLabelsRequest,
): Promise<PrintLabelsResult> {
  const orders = await getOrdersPrintLabelsInputData(
    admin,
    shopUrl,
    request.orderIds,
  );

  const factory = new LabelUnitFactory();
  const composer = new GroupedPdfComposer();

  const allUnits: LabelUnitDetails[] = [];
  const orderNamesById = new Map<string, string>();
  const errors: string[] = [];

  for (const order of orders) {
    orderNamesById.set(order.id, order.name);
    try {
      const result = await factory.buildForOrder(order);
      allUnits.push(...result.units);
    } catch (error) {
      errors.push(
        `Order ${order.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const deliveryUnits = allUnits.filter(
    (u) => u.kind === LabelUnitKind.DELIVERY,
  );
  const pickupUnits = allUnits.filter((u) => u.kind === LabelUnitKind.PICKUP);

  const [deliveryRes, pickupRes] = await Promise.all([
    deliveryUnits.length
      ? composer.compose(deliveryUnits, orderNamesById)
      : Promise.resolve(null),
    pickupUnits.length
      ? composer.compose(pickupUnits, orderNamesById)
      : Promise.resolve(null),
  ]);

  errors.push(...(deliveryRes?.errors ?? []));
  errors.push(...(pickupRes?.errors ?? []));

  const timestamp = formatLabelsFileTimestamp(new Date(), request.timeZone);
  const files: PrintLabelsFile[] = [];

  if (deliveryRes?.pdfData) {
    files.push({
      fileName: `shipping-labels_${timestamp}.pdf`,
      buf: deliveryRes.pdfData,
    });
  }
  if (pickupRes?.pdfData) {
    files.push({
      fileName: `pickup-labels_${timestamp}.pdf`,
      buf: pickupRes.pdfData,
    });
  }

  return {
    files,
    printedUnits: [
      ...(deliveryRes?.appended ?? []),
      ...(pickupRes?.appended ?? []),
    ],
    orderNamesById,
    errors,
    timestamp,
  };
}
