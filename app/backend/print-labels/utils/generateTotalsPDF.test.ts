import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  generateTotalsPDF,
  layoutTotalsPage,
  wrapRanges,
} from "./generateTotalsPDF";

// every character 6pt wide, so wrapping is easy to reason about
const measure = (text: string) => text.length * 6;
const counts = { delivery: 7, pickup: 2, total: 9 };

describe("layoutTotalsPage", () => {
  it("shows the counts, then the orders as ranges", () => {
    const [page, ...rest] = layoutTotalsPage({
      counts,
      orderNames: ["#5", "#6", "#7", "#9", "#10", "#11", "#12", "#16"],
      measure,
    });

    expect(rest).toEqual([]);
    expect(page.countRows.map((row) => [row.label, row.value])).toEqual([
      ["Etichete livrare", "7"],
      ["Etichete ridicare", "2"],
      ["Nr. total etichete", "9"],
    ]);
    expect(page.ordersHeader?.text).toBe("Comenzi (8)");
    expect(page.orderLines.map((line) => line.text)).toEqual([
      "#5-7, #9-12, #16",
    ]);
  });

  it("places the order list below the counts", () => {
    const [page] = layoutTotalsPage({ counts, orderNames: ["#1"], measure });

    const lastCountY = page.countRows[2].y;
    expect(page.ordersHeader!.y).toBeLessThan(lastCountY - 12);
    expect(page.orderLines[0].y).toBeLessThan(page.ordersHeader!.y);
  });

  it("counts distinct orders, not names", () => {
    const [page] = layoutTotalsPage({
      counts,
      orderNames: ["#1", "#1", "#2"],
      measure,
    });

    expect(page.ordersHeader?.text).toBe("Comenzi (2)");
  });

  it("leaves out the order list when there are no orders", () => {
    const [page] = layoutTotalsPage({ counts, orderNames: [], measure });

    expect(page.ordersHeader).toBeUndefined();
    expect(page.orderLines).toEqual([]);
  });

  it("continues a long list on 'Comenzi (cont.)' pages, above the bottom margin", () => {
    // every other order, so nothing collapses into a range
    const orderNames = Array.from(
      { length: 400 },
      (_, i) => `#${1000 + i * 2}`,
    );

    const pages = layoutTotalsPage({ counts, orderNames, measure });

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1].title).toBeUndefined();
    expect(pages[1].countRows).toEqual([]);
    expect(pages[1].ordersHeader?.text).toBe("Comenzi (cont.)");
    for (const page of pages) {
      for (const line of page.orderLines) {
        expect(line.y).toBeGreaterThanOrEqual(16);
      }
    }
    const allText = pages
      .flatMap((page) => page.orderLines.map((line) => line.text))
      .join(" ");
    expect(allText.split(", ")).toHaveLength(400);
  });
});

describe("wrapRanges", () => {
  it("breaks between ranges, keeping the comma at the end of the line", () => {
    expect(wrapRanges(["#1-5", "#9", "#12-20"], measure, 60)).toEqual([
      "#1-5, #9,",
      "#12-20",
    ]);
  });

  it("puts a range wider than the line on its own line instead of losing it", () => {
    expect(wrapRanges(["#100000-100009", "#7"], measure, 30)).toEqual([
      "#100000-100009,",
      "#7",
    ]);
  });
});

describe("generateTotalsPDF", () => {
  it("renders a 150×100mm page", async () => {
    const doc = await PDFDocument.load(
      await generateTotalsPDF(counts, ["#1201", "#1202", "#1210"]),
    );

    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getSize().width)).toBe(425);
  });
});
