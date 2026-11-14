import { PDFDocument } from "pdf-lib";

import type { LabelUnitDetails } from "./models/LabelUnitDetails";
import { appendPDFToDocument } from "./utils/appendPDFToDocument";
import { generateTotalsPDF, type LabelCounts } from "./utils/generateTotalsPDF";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { generateGroupHeaderPDF } from "./utils/generateGroupHeaderPDF";
import { GroupedUnitsUtils } from "./GroupedUnitsUtils";
import type { LabelUnitIdentifier } from "./models/LabelUnitIdentifier";

/** A label that made it into the PDF. */
export type PrintedLabelUnit = LabelUnitIdentifier & { kind: LabelUnitKind };

/** `orderIds` is empty for problems that belong to no order (the totals page). */
export type ComposeError = {
  orderIds: string[];
  message: string;
};

type Deps = {
  appendPDFToDocument: typeof appendPDFToDocument;
  generateGroupHeaderPDF: typeof generateGroupHeaderPDF;
  generateTotalsPDF?: typeof generateTotalsPDF;
  createDoc?: () => Promise<PDFDocument>;
};

/**
 * Builds one labels PDF:
 * 1. a totals page: label counts and every order in the PDF, as ranges
 * 2. per group of units with identical items: a header page (items, then the
 *    group's order numbers), followed by the group's labels
 */
export class GroupedPdfComposer {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private deps: Deps = {
      appendPDFToDocument,
      generateGroupHeaderPDF,
      generateTotalsPDF,
    },
  ) {}

  async compose(
    units: LabelUnitDetails[],
    orderNamesById: Map<string, string>,
  ): Promise<{
    pdfData?: Buffer;
    errors: ComposeError[];
    appended: PrintedLabelUnit[];
  }> {
    const errors: ComposeError[] = [];
    for (const u of units) {
      for (const message of u.errors ?? []) {
        errors.push({ orderIds: [u.orderId], message });
      }
    }
    const usable = units.filter((u) => u.labelPDF); // skip units whose labels couldn't be generated

    const groups = GroupedUnitsUtils.groupUnitsBySummary(usable);
    const merged = this.deps.createDoc
      ? await this.deps.createDoc()
      : await PDFDocument.create();

    // 1 - totals page
    const counts = this.computeCounts(usable);
    if (counts.total > 0 && this.deps.generateTotalsPDF) {
      try {
        const usableOrderNames = Array.from(
          new Set(
            usable.map((u) => orderNamesById.get(u.orderId) ?? u.orderId),
          ),
        );
        const totalsBytes = await this.deps.generateTotalsPDF(
          counts,
          usableOrderNames,
        );
        await this.deps.appendPDFToDocument(Buffer.from(totalsBytes), merged);
      } catch (e) {
        errors.push({
          orderIds: [],
          message: `Totals page render failed: ${String(e)}`,
        });
      }
    }

    // 2 - header + labels per group
    const appended: PrintedLabelUnit[] = [];
    for (const g of groups) {
      const groupOrderIds = Array.from(new Set(g.units.map((u) => u.orderId)));

      try {
        const headerBytes = await this.deps.generateGroupHeaderPDF(
          g.items,
          g.units.length,
          groupOrderIds.map((id) => orderNamesById.get(id) ?? id),
        );
        await this.deps.appendPDFToDocument(Buffer.from(headerBytes), merged);
      } catch (e) {
        // the labels still print; only their header page is missing
        errors.push({
          orderIds: groupOrderIds,
          message: `Items page failed to render: ${String(e)}`,
        });
      }

      for (const u of g.units) {
        try {
          await this.deps.appendPDFToDocument(u.labelPDF as Buffer, merged);
          appended.push({
            orderId: u.orderId,
            unitId: u.unitId,
            displayName: u.displayName,
            kind: u.kind,
          });
        } catch (e) {
          errors.push({
            orderIds: [u.orderId],
            message: `Label ${u.displayName} could not be added to the PDF: ${String(e)}`,
          });
        }
      }
    }

    if (appended.length === 0) {
      return {
        errors,
        appended,
      };
    }

    const mergedBytes = await merged.save();
    return { pdfData: Buffer.from(mergedBytes), errors, appended };
  }

  private computeCounts(units: LabelUnitDetails[]): LabelCounts {
    let delivery = 0;
    let pickup = 0;
    for (const u of units) {
      if (u.kind === LabelUnitKind.DELIVERY) delivery++;
      else if (u.kind === LabelUnitKind.PICKUP) pickup++;
    }
    return { delivery, pickup, total: delivery + pickup };
  }
}
