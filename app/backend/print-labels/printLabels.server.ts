import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { getOrdersPrintLabelsInputData } from "./getOrdersPrintLabelsInputData.server";
import { GroupedPdfComposer } from "./GroupedPdfComposer";
import { LabelUnitFactory } from "./LabelUnitFactory";
import { LabelUnitKind } from "./models/LabelUnitKind";
import JSZip from "jszip";

type PrintLabelsRequest = {
  orderIds: string[];
};

type BuildPrintLabelsArtifactResult = {
  ok: boolean;
  deliveryPdf?: Buffer;
  pickupPdf?: Buffer;
  zipBuffer?: Buffer;
  fileName?: string;
  contentType?: string;
  errors: string[];
};

export async function buildPrintLabelsArtifact(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  request: PrintLabelsRequest,
): Promise<BuildPrintLabelsArtifactResult> {
  const orders = await getOrdersPrintLabelsInputData(
    admin,
    shopUrl,
    request.orderIds,
  );

  const factory = new LabelUnitFactory();
  const composer = new GroupedPdfComposer();

  const allUnits = [];
  const orderNamesById = new Map<string, string>();

  for (const order of orders) {
    orderNamesById.set(order.id, order.name);
    const result = await factory.buildForOrder(order);
    allUnits.push(...result.units);
  }

  const deliveryUnits = allUnits.filter(
    (u) => u.kind === LabelUnitKind.DELIVERY,
  );

  const pickupUnits = allUnits.filter((u) => u.kind === LabelUnitKind.PICKUP);

  const errors: string[] = [];

  const [deliveryRes, pickupRes] = await Promise.all([
    deliveryUnits.length
      ? composer.compose(deliveryUnits, orderNamesById)
      : Promise.resolve(null),
    pickupUnits.length
      ? composer.compose(pickupUnits, orderNamesById)
      : Promise.resolve(null),
  ]);

  const deliveryPdf = deliveryRes?.pdfData;
  const pickupPdf = pickupRes?.pdfData;

  errors.push(...(deliveryRes?.errors ?? []));
  errors.push(...(pickupRes?.errors ?? []));

  if (!deliveryPdf && !pickupPdf) {
    return {
      ok: false,
      errors: errors.length ? errors : ["No labels were generated."],
    };
  }

  if (deliveryPdf && !pickupPdf) {
    return {
      ok: errors.length === 0,
      deliveryPdf,
      fileName: "labels-shipping.pdf",
      contentType: "application/pdf",
      errors,
    };
  }

  if (!deliveryPdf && pickupPdf) {
    return {
      ok: errors.length === 0,
      pickupPdf,
      fileName: "labels-pickup.pdf",
      contentType: "application/pdf",
      errors,
    };
  }

  const zip = new JSZip();
  zip.file("labels-shipping.pdf", deliveryPdf!);
  zip.file("labels-pickup.pdf", pickupPdf!);

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return {
    ok: errors.length === 0,
    deliveryPdf,
    pickupPdf,
    zipBuffer,
    fileName: "labels.zip",
    contentType: "application/zip",
    errors,
  };
}
