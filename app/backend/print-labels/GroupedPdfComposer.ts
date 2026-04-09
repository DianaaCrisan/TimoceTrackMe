import { PDFDocument } from "pdf-lib";

import type { LabelUnitDetails } from "./models/LabelUnitDetails";
import { appendTextPagesToPDF } from "./utils/appendTextPagesToPDF";
import { appendPDFToDocument } from "./utils/appendPDFToDocument";
import { renderTwoColumnLabel } from "./utils/renderTwoColumnLabel";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { generateSummaryLabelPDF } from "./utils/generateSummaryLabelPDF";
import { GroupedUnitsUtils } from "./GroupedUnitsUtils";
import { appendOrderNamePagesToPDF } from "./utils/appendOrderNamePagesToPDF";
import { LabelUnitIdentifier } from "./models/LabelUnitIdentifier";

type LabelCounts = {
  delivery: number;
  pickup: number;
  total: number;
};

type Deps = {
  appendPDFToDocument: typeof appendPDFToDocument;
  generateSummaryLabelPDF: typeof generateSummaryLabelPDF;
  generateTotalsLabelPDF?: typeof generateTotalsLabelPDF;
  appendTextPagesToPDF: typeof appendTextPagesToPDF;
  appendOrderNamePagesToPDF: typeof appendOrderNamePagesToPDF;
  createDoc?: () => Promise<PDFDocument>;
};

/**
 * takes units, groups them, renders one summary per group and appends labels
 */
export class GroupedPdfComposer {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private deps: Deps = {
      appendPDFToDocument,
      generateSummaryLabelPDF,
      generateTotalsLabelPDF,
      appendTextPagesToPDF,
      appendOrderNamePagesToPDF,
    },
  ) {}

  async compose(
    units: LabelUnitDetails[],
    orderNamesById: Map<string, string>,
  ): Promise<{
    pdfData?: Buffer;
    errors: string[];
    appended: LabelUnitIdentifier[];
  }> {
    // filter usable + collect errors
    const errors: string[] = [];
    for (const u of units) {
      if (u.errors?.length) errors.push(...u.errors);
    }
    const usable = units.filter((u) => u.labelPDF); // skip units whose labels couldn't be generated

    const groups = GroupedUnitsUtils.groupUnitsBySummary(usable);
    const merged = this.deps.createDoc
      ? await this.deps.createDoc()
      : await PDFDocument.create();

    // 1 - totals page
    const counts = this.computeCounts(usable);
    if (counts.total > 0 && this.deps.generateTotalsLabelPDF) {
      try {
        const totalsBytes = await this.deps.generateTotalsLabelPDF(counts);
        await this.deps.appendPDFToDocument(Buffer.from(totalsBytes), merged);
      } catch (e) {
        errors.push(`Totals page render failed: ${String(e)}`);
      }
    }

    // 2 - summary + labels per group
    const appended: LabelUnitIdentifier[] = [];
    for (const g of groups) {
      try {
        const summaryBytes = await this.deps.generateSummaryLabelPDF(
          g.items,
          g.units.length,
        );
        await this.deps.appendPDFToDocument(Buffer.from(summaryBytes), merged);

        const groupOrderNames = Array.from(
          new Set(
            g.units.map((u) => orderNamesById.get(u.orderId) ?? u.orderId),
          ),
        );
        await this.deps.appendOrderNamePagesToPDF(merged, groupOrderNames);
      } catch (e) {
        errors.push(`Summary render failed for group ${g.key}: ${String(e)}`);
      }

      for (const u of g.units) {
        try {
          await this.deps.appendPDFToDocument(u.labelPDF as Buffer, merged);
          appended.push({
            orderId: u.orderId,
            unitId: u.unitId,
            displayName: u.displayName,
          });
        } catch (e) {
          errors.push(`Append failed for ${u.displayName}: ${String(e)}`);
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

async function generateTotalsLabelPDF(
  counts: LabelCounts,
): Promise<Uint8Array> {
  const leftLines = [
    { prefix: null, name: "Etichete livrare" },
    { prefix: null, name: "Etichete pickup" },
    { prefix: null, name: "Nr. total etichete" },
  ];
  const rightLines = [
    String(counts.delivery),
    String(counts.pickup),
    String(counts.total),
  ];

  return renderTwoColumnLabel({
    title: "Total etichete",
    leftLines,
    rightLines,
    layout: {
      fontSize: 12,
      titleFontSize: 14,
      lineGap: 30,
      rowSeparators: true,
    },
  });
}
