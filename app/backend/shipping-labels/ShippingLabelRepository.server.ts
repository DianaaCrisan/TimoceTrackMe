import type { Prisma, ShippingLabel } from "@prisma/client";
import prisma from "app/db.server";
import { OPTIMUS_TRACKING_COMPANY } from "app/commons/couriers/Courier";
import {
  shopMonthRange,
  type AwbReportRow,
  type AwbStatus,
  type ReportMonth,
} from "app/commons/shipping-labels/AwbReport";
import type { GeneratedLabelInput } from "./GeneratedLabelInput";
import {
  reconcileOrderLabels,
  type LabelChange,
  type OrderSnapshot,
} from "./reconcileOrderLabels";

type Tx = Prisma.TransactionClient;

/** An AWB typed in on the report page. */
export type HandAddedLabel = {
  trackingNumber: string;
  status: AwbStatus;
  issuedAt: Date;
  order: { id: string; name: string; createdAt: Date } | null;
  note: string | null;
};

/**
 * Reconciling runs in a transaction holding this Postgres advisory lock, so
 * two webhooks for the same order cannot write over each other's reading.
 * The key is an arbitrary number that only this code uses.
 */
async function withLabelsLock<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(724502)`;
    return work(tx);
  });
}

export class ShippingLabelRepository {
  /**
   * Saves an AWB Optimus just booked, before it reaches Shopify: until its
   * fulfillment exists, it counts as cancelled, never on Shopify. Saving it
   * twice keeps the first.
   */
  static async recordGenerated(
    label: GeneratedLabelInput,
    generatedAt: Date,
  ): Promise<void> {
    await prisma.shippingLabel.upsert({
      where: { trackingNumber: label.trackingNumber },
      create: {
        ...label,
        source: "TRACKME",
        courier: "OPTIMUS",
        trackingCompany: OPTIMUS_TRACKING_COMPANY,
        issuedAt: generatedAt,
        status: "CANCELLED",
        cancelReason: "NEVER_ON_SHOPIFY",
        cancelledAt: generatedAt,
      },
      update: {},
    });
  }

  /** The AWB is on the fulfillment add tracking just created. */
  static async markAddedToShopify(
    trackingNumber: string,
    fulfillmentId: string,
  ): Promise<void> {
    await withLabelsLock((tx) =>
      tx.shippingLabel.updateMany({
        where: { trackingNumber, source: { not: "IMPORT" } },
        data: {
          fulfillmentId,
          status: "USED",
          cancelReason: null,
          cancelledAt: null,
        },
      }),
    );
  }

  /** Counts one more print for each AWB the report knows. */
  static async recordPrinted(
    trackingNumbers: string[],
    printedAt: Date,
  ): Promise<void> {
    const unique = [...new Set(trackingNumbers)];
    if (unique.length === 0) return;

    await prisma.$transaction([
      prisma.shippingLabel.updateMany({
        where: { trackingNumber: { in: unique }, firstPrintedAt: null },
        data: { firstPrintedAt: printedAt },
      }),
      prisma.shippingLabel.updateMany({
        where: { trackingNumber: { in: unique } },
        data: { lastPrintedAt: printedAt, printCount: { increment: 1 } },
      }),
    ]);
  }

  /**
   * Brings the order's AWBs in line with its fulfillments as Shopify has them
   * now. Returns how many rows were created or changed.
   */
  static async reconcileOrder(
    order: OrderSnapshot,
    now: Date,
  ): Promise<number> {
    const numbers = order.fulfillments.flatMap((fulfillment) =>
      fulfillment.tracking.map((tracking) => tracking.number.trim()),
    );

    return withLabelsLock(async (tx) => {
      const known = await tx.shippingLabel.findMany({
        where: {
          OR: [{ orderId: order.id }, { trackingNumber: { in: numbers } }],
        },
      });
      const changes = reconcileOrderLabels({ order, known, now });
      for (const change of changes) await applyChange(tx, change);
      return changes.length;
    });
  }

  /** The AWBs issued in that month (shop time zone). */
  static async listIssuedIn(month: ReportMonth): Promise<AwbReportRow[]> {
    const { start, end } = shopMonthRange(month);
    const labels = await prisma.shippingLabel.findMany({
      where: { issuedAt: { gte: start, lt: end } },
    });

    return labels.map(toAwbReportRow);
  }

  /** Which of these numbers the report already has. */
  static async findExisting(trackingNumbers: string[]): Promise<string[]> {
    const rows = await prisma.shippingLabel.findMany({
      where: { trackingNumber: { in: trackingNumbers } },
      select: { trackingNumber: true },
    });
    return rows.map((row) => row.trackingNumber);
  }

  /**
   * Saves AWBs typed in on the report page. An AWB the report already has is
   * left as it is. Returns the numbers saved.
   */
  static async addByHand(labels: HandAddedLabel[]): Promise<string[]> {
    const added: string[] = [];
    await withLabelsLock(async (tx) => {
      for (const label of labels) {
        const result = await tx.shippingLabel.createMany({
          data: [
            {
              trackingNumber: label.trackingNumber,
              source: "IMPORT",
              courier: "OPTIMUS",
              orderId: label.order?.id ?? null,
              orderName: label.order?.name ?? null,
              orderCreatedAt: label.order?.createdAt ?? null,
              status: label.status,
              cancelReason: label.status === "CANCELLED" ? "SET_BY_HAND" : null,
              cancelledAt: label.status === "CANCELLED" ? label.issuedAt : null,
              issuedAt: label.issuedAt,
              note: label.note,
            },
          ],
          skipDuplicates: true,
        });
        if (result.count > 0) added.push(label.trackingNumber);
      }
    });
    return added;
  }

  /** Deletes an AWB added by hand. Returns false for any other AWB. */
  static async deleteAddedByHand(trackingNumber: string): Promise<boolean> {
    const result = await prisma.shippingLabel.deleteMany({
      where: { trackingNumber, source: "IMPORT" },
    });
    return result.count > 0;
  }

  static async getSyncedAt(month: ReportMonth): Promise<Date | null> {
    const row = await prisma.awbReportSync.findUnique({ where: { month } });
    return row?.syncedAt ?? null;
  }

  static async setSyncedAt(month: ReportMonth, syncedAt: Date): Promise<void> {
    await prisma.awbReportSync.upsert({
      where: { month },
      create: { month, syncedAt },
      update: { syncedAt },
    });
  }
}

async function applyChange(tx: Tx, change: LabelChange): Promise<void> {
  if (change.kind === "create") {
    await tx.shippingLabel.create({
      data: {
        trackingNumber: change.trackingNumber,
        source: "SHOPIFY",
        issuedAt: change.issuedAt,
        ...change.state,
      },
    });
  } else {
    await tx.shippingLabel.update({
      where: { trackingNumber: change.trackingNumber },
      data: change.state,
    });
  }
}

function toAwbReportRow(label: ShippingLabel): AwbReportRow {
  return {
    trackingNumber: label.trackingNumber,
    source: label.source,
    courier: label.courier,
    trackingCompany: label.trackingCompany,
    orderId: label.orderId,
    orderName: label.orderName,
    orderCreatedAt: label.orderCreatedAt?.toISOString() ?? null,
    parcelPosition: label.parcelPosition,
    weightKg: label.weightKg,
    issuedAt: label.issuedAt.toISOString(),
    status: label.status,
    cancelReason: label.cancelReason,
    cancelledAt: label.cancelledAt?.toISOString() ?? null,
    note: label.note,
    firstPrintedAt: label.firstPrintedAt?.toISOString() ?? null,
    printCount: label.printCount,
  };
}
