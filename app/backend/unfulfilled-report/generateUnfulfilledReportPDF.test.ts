import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createTranslator } from "app/commons/i18n/translate";
import type {
  ReportSection,
  UnfulfilledReport,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { formatOrderRanges } from "../print-labels/utils/formatOrderRanges";
import {
  A4_HEIGHT,
  A4_WIDTH,
  CONTENT_BOTTOM,
  generateUnfulfilledReportPDF,
  layoutReportPdf,
  wrapText,
  type ReportPdfPage,
  type PdfTextOp,
} from "./generateUnfulfilledReportPDF";

// every character half its font size wide
const measure = (text: string, size: number) => text.length * size * 0.5;
const en = createTranslator("en");
const ro = createTranslator("ro");

const section = (rowCount: number, orderCount = 3): ReportSection => {
  const orderNames = Array.from(
    { length: orderCount },
    (_, i) => `#${1000 + i}`,
  );
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    key: `v${i}`,
    name: `Product ${i} - 1 kg`,
    quantity: i + 1,
  }));
  return {
    orderNames,
    orderRanges: formatOrderRanges(orderNames),
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
  };
};

const report = (
  delivery: ReportSection,
  pickup: ReportSection,
): UnfulfilledReport => ({
  interval: { from: null, to: null },
  generatedAt: "2026-11-14T10:00:00.000Z",
  delivery,
  pickup,
});

const layout = (value: UnfulfilledReport, t = en) =>
  layoutReportPdf({
    report: value,
    t,
    formatDate: () => "14 Nov 2026, 12:00",
    measure,
  });

const texts = (pages: ReportPdfPage[]) =>
  pages.flatMap((page) =>
    page.ops
      .filter((op): op is PdfTextOp => op.kind === "text")
      .map((op) => op.text),
  );

describe("layoutReportPdf", () => {
  it("shows the title, the scope, then a table and the orders per section", () => {
    const pages = layout(report(section(2), section(1, 1)));

    expect(pages).toHaveLength(1);
    expect(texts(pages)).toEqual([
      "Unfulfilled orders report",
      "All unfulfilled orders · Generated 14 Nov 2026, 12:00",
      "Delivery",
      "3 orders",
      "Product",
      "Quantity",
      "Product 0 - 1 kg",
      "1",
      "Product 1 - 1 kg",
      "2",
      "Total",
      "3",
      "Orders (3)",
      "#1000-1002",
      "Pickup",
      "1 order",
      "Product",
      "Quantity",
      "Product 0 - 1 kg",
      "1",
      "Total",
      "1",
      "Orders (1)",
      "#1000",
      "Unfulfilled orders report · All unfulfilled orders",
      "Page 1 of 1",
    ]);
  });

  it("is worded in Romanian for a Romanian admin", () => {
    const all = texts(layout(report(section(1), section(0, 0)), ro));

    expect(all).toContain("Raport comenzi neexecutate");
    expect(all).toContain("Livrare");
    expect(all).toContain("Ridicare personală");
    expect(all).toContain("Cantitate");
    expect(all).toContain("Nicio comandă neexecutată.");
    expect(all).toContain("Pagina 1 din 1");
  });

  it("says so when a section has no orders, without a table", () => {
    const all = texts(layout(report(section(0, 0), section(0, 0))));

    expect(
      all.filter((text) => text === "No unfulfilled orders."),
    ).toHaveLength(2);
    expect(all).not.toContain("Product");
    expect(all).not.toContain("Total");
  });

  it("continues a long table on the next page under a repeated header", () => {
    const pages = layout(report(section(80), section(0, 0)));

    expect(pages.length).toBeGreaterThan(1);
    const secondPage = texts([pages[1]]);
    expect(secondPage[0]).toBe("Delivery (cont.)");
    expect(secondPage).toContain("Product");
    expect(secondPage).toContain("Quantity");

    const rowNames = texts(pages).filter((text) => text.startsWith("Product "));
    expect(rowNames).toHaveLength(80);
    expect(texts(pages).at(-1)).toBe(`Page ${pages.length} of ${pages.length}`);
  });

  it("keeps everything but the footer above the bottom margin and on the page", () => {
    const pages = layout(report(section(120, 400), section(60, 200)));

    for (const page of pages) {
      for (const op of page.ops) {
        if (op.kind !== "text" || op.size === 8) continue;
        expect(op.y).toBeGreaterThanOrEqual(CONTENT_BOTTOM);
        expect(op.y).toBeLessThanOrEqual(A4_HEIGHT);
      }
    }
  });

  it("wraps a long product name inside its column", () => {
    const long = section(1);
    long.rows[0].name = "Pachet grătar familie ".repeat(10).trim();

    const pages = layout(report(long, section(0, 0)));
    const nameLines = texts(pages).filter((text) => text.includes("grătar"));

    expect(nameLines.length).toBeGreaterThan(1);
    expect(nameLines.join(" ")).toBe(long.rows[0].name);
  });
});

describe("wrapText", () => {
  const byChar = (text: string) => text.length;

  it("breaks between words", () => {
    expect(wrapText("aa bb cc", 5, byChar)).toEqual(["aa bb", "cc"]);
  });

  it("cuts a word wider than the line", () => {
    expect(wrapText("abcdefgh", 3, byChar)).toEqual(["abc", "def", "gh"]);
  });
});

describe("generateUnfulfilledReportPDF", () => {
  it("renders A4 pages with Romanian characters", async () => {
    const value = report(section(2), section(1, 1));
    value.delivery.rows[0].name = "Mușchi de vită țărănesc - 1 kg";

    const doc = await PDFDocument.load(
      await generateUnfulfilledReportPDF(value, {
        locale: "ro",
        timeZone: "Europe/Bucharest",
      }),
    );

    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(Math.round(A4_WIDTH));
    expect(Math.round(height)).toBe(Math.round(A4_HEIGHT));
  });
});
