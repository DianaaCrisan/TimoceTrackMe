import type { Locale } from "app/commons/i18n/Locale";
import { createTranslator } from "app/commons/i18n/translate";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { buildOrderRangesFileName } from "../exports/buildOrderRangesFileName";
import { formatFileTimestamp } from "../exports/formatFileTimestamp";
import { createPool } from "../graphql/throttle-handling/helpers/createPool";
import { getOrdersPrintLabelsInputData } from "./getOrdersPrintLabelsInputData.server";
import {
  GroupedPdfComposer,
  type ComposeError,
  type PrintedLabelUnit,
} from "./GroupedPdfComposer";
import { LabelUnitFactory } from "./LabelUnitFactory";
import type { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LabelUnitKind } from "./models/LabelUnitKind";

/** Orders whose Optimus label PDFs are fetched at the same time. */
const LABEL_FETCH_POOL_WORKERS = 4;

type PrintLabelsRequest = {
  orderIds: string[];
  /** IANA time zone of the user, used to stamp the file names in local time */
  timeZone?: string | null;
  /** The user's language: the PDFs' own pages and the file names use it. */
  locale: Locale;
};

export type PrintLabelsFile = {
  fileName: string;
  buf: Buffer;
};

export type PrintLabelsResult = {
  /** The shipping and/or pickup labels PDF; empty when no label could be made. */
  files: PrintLabelsFile[];
  /** The labels that made it into a PDF. */
  printedUnits: PrintedLabelUnit[];
  /** Orders Shopify returned, by ID, so the caller can name every order. */
  orderNamesById: Map<string, string>;
  /** Labels that failed, by the order they belong to. */
  errorsByOrderId: Map<string, string[]>;
  /** Problems that belong to no single order, e.g. the totals page. */
  generalErrors: string[];
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

  const t = createTranslator(request.locale);
  const factory = new LabelUnitFactory();
  const composer = new GroupedPdfComposer();

  const allUnits: LabelUnitDetails[] = [];
  const orderNamesById = new Map<string, string>();
  const errors: ComposeError[] = [];

  // Each order fetches its labels from Optimus one by one; a pool of orders
  // keeps several requests in flight without flooding Optimus.
  const pool = createPool(LABEL_FETCH_POOL_WORKERS);
  await Promise.all(
    orders.map((order) =>
      pool.schedule(async () => {
        orderNamesById.set(order.id, order.name);
        try {
          const result = await factory.buildForOrder(order, request.locale);
          allUnits.push(...result.units);
        } catch (error) {
          errors.push({
            orderIds: [order.id],
            message: `Order ${order.name}: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }),
    ),
  );

  const deliveryUnits = allUnits.filter(
    (u) => u.kind === LabelUnitKind.DELIVERY,
  );
  const pickupUnits = allUnits.filter((u) => u.kind === LabelUnitKind.PICKUP);

  const [deliveryRes, pickupRes] = await Promise.all([
    deliveryUnits.length
      ? composer.compose(deliveryUnits, orderNamesById, t)
      : Promise.resolve(null),
    pickupUnits.length
      ? composer.compose(pickupUnits, orderNamesById, t)
      : Promise.resolve(null),
  ]);

  errors.push(...(deliveryRes?.errors ?? []));
  errors.push(...(pickupRes?.errors ?? []));

  const timestamp = formatFileTimestamp(
    new Date(),
    request.timeZone,
    request.locale,
  );
  const files: PrintLabelsFile[] = [];

  // named after the orders inside, like the list on the PDF's first page
  const fileNameFor = (
    baseName: string,
    appended: PrintedLabelUnit[],
  ): string =>
    buildOrderRangesFileName({
      baseName,
      orderNames: appended.map(
        (unit) => orderNamesById.get(unit.orderId) ?? unit.orderId,
      ),
      timestamp,
      extension: "pdf",
    });

  if (deliveryRes?.pdfData) {
    files.push({
      fileName: fileNameFor(t("fileName.shippingLabels"), deliveryRes.appended),
      buf: deliveryRes.pdfData,
    });
  }
  if (pickupRes?.pdfData) {
    files.push({
      fileName: fileNameFor(t("fileName.pickupLabels"), pickupRes.appended),
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
    ...splitErrors(errors),
    timestamp,
  };
}

function splitErrors(errors: ComposeError[]): {
  errorsByOrderId: Map<string, string[]>;
  generalErrors: string[];
} {
  const errorsByOrderId = new Map<string, string[]>();
  const generalErrors: string[] = [];

  for (const error of errors) {
    if (error.orderIds.length === 0) {
      generalErrors.push(error.message);
      continue;
    }
    for (const orderId of error.orderIds) {
      errorsByOrderId.set(orderId, [
        ...(errorsByOrderId.get(orderId) ?? []),
        error.message,
      ]);
    }
  }

  return { errorsByOrderId, generalErrors };
}
