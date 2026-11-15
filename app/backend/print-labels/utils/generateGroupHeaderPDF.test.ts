import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createTranslator } from "app/commons/i18n/translate";
import { LineItem } from "../models/LineItem";
import {
  formatGroupTitle,
  generateGroupHeaderPDF,
  layoutGroupHeader,
  toItemRows,
  type ItemRow,
} from "./generateGroupHeaderPDF";

const itemRows = (count: number): ItemRow[] =>
  Array.from({ length: count }, (_, i) => ({
    sku: `SKU${i}`,
    name: `Item ${i}`,
    quantity: 1,
  }));

const ro = createTranslator("ro");
const en = createTranslator("en");

const orderNames = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `#${1000 + i}`);

describe("layoutGroupHeader", () => {
  it("puts items and order numbers on one page when they fit", () => {
    const pages = layoutGroupHeader({
      title: "3 etichete -> 3 tipuri de produse",
      itemRows: itemRows(3),
      orderNames: orderNames(12),
      t: ro,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].title?.text).toBe("3 etichete -> 3 tipuri de produse");
    expect(pages[0].itemRows).toHaveLength(3);
    expect(pages[0].ordersHeader).toMatchObject({
      text: "Comenzi (12)",
      hasDivider: true,
    });
    expect(pages[0].orderRows.map((row) => row.names.length)).toEqual([
      5, 5, 2,
    ]);
  });

  it("places the order numbers below the last item", () => {
    const [page] = layoutGroupHeader({
      title: "t",
      itemRows: itemRows(3),
      orderNames: orderNames(1),
      t: ro,
    });

    const lastItemY = page.itemRows[2].y;
    expect(page.ordersHeader!.y).toBeLessThan(lastItemY);
    expect(page.orderRows[0].y).toBeLessThan(page.ordersHeader!.y);
  });

  it("continues order numbers on 'Comenzi (cont.)' pages", () => {
    const pages = layoutGroupHeader({
      title: "t",
      itemRows: itemRows(3),
      orderNames: orderNames(120),
      t: ro,
    });

    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1].title).toBeUndefined();
    expect(pages[1].itemRows).toEqual([]);
    expect(pages[1].ordersHeader?.text).toBe("Comenzi (cont.)");

    const placedNames = pages.flatMap((page) =>
      page.orderRows.flatMap((row) => row.names),
    );
    expect(placedNames).toEqual(orderNames(120));
  });

  it("keeps every row above the bottom margin", () => {
    const pages = layoutGroupHeader({
      title: "t",
      itemRows: itemRows(14),
      orderNames: orderNames(200),
      t: ro,
    });

    for (const page of pages) {
      for (const row of [...page.itemRows, ...page.orderRows]) {
        expect(row.y).toBeGreaterThanOrEqual(16);
      }
    }
  });

  it("moves the order numbers to a new page when not even one row fits under the items", () => {
    // 9 item rows on the first page, 11 on a continuation page fills it
    const pages = layoutGroupHeader({
      title: "t",
      itemRows: itemRows(20),
      orderNames: orderNames(3),
      t: ro,
    });

    expect(pages).toHaveLength(3);
    expect(pages[1].itemRows).toHaveLength(11);
    expect(pages[1].ordersHeader).toBeUndefined();
    expect(pages[2].ordersHeader).toMatchObject({
      text: "Comenzi (3)",
      hasDivider: false,
    });
  });

  it("continues long item lists before the order numbers", () => {
    const pages = layoutGroupHeader({
      title: "t",
      itemRows: itemRows(12),
      orderNames: orderNames(2),
      t: ro,
    });

    expect(pages[0].itemRows).toHaveLength(9);
    expect(pages[1].itemRows).toHaveLength(3);
    expect(pages[1].ordersHeader?.text).toBe("Comenzi (2)");
  });

  it("sorts order numbers numerically and drops duplicates", () => {
    const [page] = layoutGroupHeader({
      title: "t",
      itemRows: itemRows(1),
      orderNames: ["#1010", "#999", "#1002", "#999"],
      t: ro,
    });

    expect(page.orderRows[0].names).toEqual(["#999", "#1002", "#1010"]);
  });
});

describe("toItemRows", () => {
  it("sums quantities per variant and sorts by name", () => {
    expect(
      toItemRows([
        new LineItem("v2", 1, "Pulpă porc", "P1"),
        new LineItem("v1", 2, "Antricot", "A1"),
        new LineItem("v2", 3, "Pulpă porc", "P1"),
      ]),
    ).toEqual([
      { sku: "A1", name: "Antricot", quantity: 2 },
      { sku: "P1", name: "Pulpă porc", quantity: 4 },
    ]);
  });
});

describe("generateGroupHeaderPDF", () => {
  it("renders a 150×100mm page with Romanian characters", async () => {
    const bytes = await generateGroupHeaderPDF(
      [new LineItem("v1", 2, "Mușchi de vită țărănesc", "M1")],
      2,
      ["#1001", "#1002"],
      ro,
    );

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(425);
    expect(Math.round(height)).toBe(283);
  });
});

describe("formatGroupTitle", () => {
  it("uses Romanian singular, plural and 'de' from 20 up", () => {
    expect(formatGroupTitle(1, 1, ro)).toBe("1 etichetă -> 1 tip de produs");
    expect(formatGroupTitle(3, 2, ro)).toBe(
      "3 etichete -> 2 tipuri de produse",
    );
    expect(formatGroupTitle(21, 20, ro)).toBe(
      "21 de etichete -> 20 de tipuri de produse",
    );
  });

  it("is worded in English for an English admin", () => {
    expect(formatGroupTitle(1, 1, en)).toBe("1 label -> 1 product type");
    expect(formatGroupTitle(3, 2, en)).toBe("3 labels -> 2 product types");
  });
});
