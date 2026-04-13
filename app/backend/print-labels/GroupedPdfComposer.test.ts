import { describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { GroupedPdfComposer } from "./GroupedPdfComposer";
import { LineItem } from "./models/LineItem";

describe("GroupedPdfComposer", () => {
  it("prints one totals page, one summary per identical items group, one order-names page per group, then all labels in that group", async () => {
    const u1: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/1",
      unitId: "gid://shopify/Fulfillment/1",
      displayName: "#1203-F1",
      labelPDF: Buffer.from("LA1"),
      lineItems: [
        new LineItem("vA", 1, "Dragon Fruit - 2kg", "10"),
        new LineItem("vA", 1, "Dragon Fruit - 2kg", "10"),
        new LineItem("vB", 1, "Tropical Mix - 4kg", "11"),
      ],
      trackingNumber: "TN1",
      errors: [],
    };

    const u2: LabelUnitDetails = {
      kind: LabelUnitKind.PICKUP,
      orderId: "gid://shopify/Order/2",
      unitId: "pickup:gid://shopify/Order/2",
      displayName: "Pickup",
      labelPDF: Buffer.from("LA2"),
      lineItems: [
        new LineItem("vB", 1, "Tropical Mix - 4kg", "12"),
        new LineItem("vA", 2, "Dragon Fruit - 2kg", "13"),
      ],
      errors: [],
    };

    const u3: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/3",
      unitId: "gid://shopify/Fulfillment/3",
      displayName: "#1204-F1",
      labelPDF: Buffer.from("LB1"),
      lineItems: [new LineItem("vD", 5, "Papaya - 2kg", "14")],
      errors: [],
    };

    const events: string[] = [];

    const appendPDFToDocument = vi
      .fn()
      .mockImplementation(async (bytes: Buffer, _doc: PDFDocument) => {
        const s = bytes.toString();
        if (s === "TOT") events.push("TOTALS");
        else if (s.startsWith("S")) events.push("SUMMARY");
        else events.push(s);
      });

    const generateSummaryLabelPDF = vi.fn().mockResolvedValue(Buffer.from("S"));
    const generateTotalsLabelPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("TOT"));
    const appendTextPagesToPDF = vi.fn().mockResolvedValue(undefined);
    const appendOrderNamePagesToPDF = vi.fn().mockResolvedValue(undefined);

    const composer = new GroupedPdfComposer({
      appendPDFToDocument,
      generateSummaryLabelPDF,
      generateTotalsLabelPDF,
      appendTextPagesToPDF,
      appendOrderNamePagesToPDF,
      createDoc: async () => PDFDocument.create(),
    });

    const { pdfData, errors, appended } = await composer.compose(
      [u1, u2, u3],
      new Map([
        ["gid://shopify/Order/1", "#1"],
        ["gid://shopify/Order/2", "#2"],
        ["gid://shopify/Order/3", "#3"],
      ]),
    );

    expect(errors).toEqual([]);
    expect(pdfData).toBeInstanceOf(Buffer);
    expect(appended).toEqual([
      {
        orderId: "gid://shopify/Order/1",
        unitId: "gid://shopify/Fulfillment/1",
        displayName: "#1203-F1",
      },
      {
        orderId: "gid://shopify/Order/2",
        unitId: "pickup:gid://shopify/Order/2",
        displayName: "Pickup",
      },
      {
        orderId: "gid://shopify/Order/3",
        unitId: "gid://shopify/Fulfillment/3",
        displayName: "#1204-F1",
      },
    ]);

    expect(events).toEqual([
      "TOTALS",
      "SUMMARY",
      "LA1",
      "LA2",
      "SUMMARY",
      "LB1",
    ]);

    expect(generateTotalsLabelPDF).toHaveBeenCalledTimes(1);

    expect(generateSummaryLabelPDF).toHaveBeenCalledTimes(2);
    const counts = generateSummaryLabelPDF.mock.calls
      .map(([, labelCount]) => labelCount)
      .sort((a, b) => a - b);
    expect(counts).toEqual([1, 2]);

    expect(appendOrderNamePagesToPDF).toHaveBeenCalledTimes(2);
    const orderNameCalls = appendOrderNamePagesToPDF.mock.calls.map(
      ([, orderNames]) => orderNames,
    );
    expect(orderNameCalls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(["#1", "#2"]),
        expect.arrayContaining(["#3"]),
      ]),
    );
  });

  it("returns collected errors and no pdfData when no labels could be appended", async () => {
    const badUnit: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/3",
      unitId: "gid://shopify/Fulfillment/3",
      displayName: "#1204-F1",
      labelPDF: null,
      lineItems: [],
      errors: ["some error"],
    };

    const generateTotalsLabelPDF = vi.fn();

    const composer = new GroupedPdfComposer({
      appendPDFToDocument: vi.fn(),
      generateSummaryLabelPDF: vi.fn(),
      generateTotalsLabelPDF,
      appendTextPagesToPDF: vi.fn(),
      appendOrderNamePagesToPDF: vi.fn(),
      createDoc: async () => PDFDocument.create(),
    });

    await expect(
      composer.compose([badUnit], new Map([["gid://shopify/Order/3", "#3"]])),
    ).resolves.toMatchObject({
      appended: [],
      errors: ["some error"],
    });

    expect(generateTotalsLabelPDF).toHaveBeenCalledTimes(0);
  });

  it("prints two separate summaries for the same variant with different quantities, each followed by order names and its label", async () => {
    const variantId = "gid://shopify/ProductVariant/KEITT";

    const uQty4: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/999",
      displayName: "#F1",
      unitId: "gid://shopify/Fulfillment/1",
      labelPDF: Buffer.from("L4"),
      lineItems: [new LineItem(variantId, 4, "Mango Keitt - 4kg", "17")],
      errors: [],
    };

    const uQty1: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/999",
      displayName: "#F2",
      unitId: "gid://shopify/Fulfillment/2",
      labelPDF: Buffer.from("L1"),
      lineItems: [new LineItem(variantId, 1, "Mango Keitt - 4kg", "17")],
      errors: [],
    };

    const events: string[] = [];

    const appendPDFToDocument = vi
      .fn()
      .mockImplementation(async (bytes: Buffer, _doc: PDFDocument) => {
        events.push(bytes.toString());
      });

    const generateSummaryLabelPDF = vi
      .fn()
      .mockImplementation(async (items: LineItem[], _count: number) => {
        const qty = items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
        return Buffer.from(`SUMMARY:${qty}`);
      });

    const generateTotalsLabelPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("TOT"));
    const appendOrderNamePagesToPDF = vi.fn().mockResolvedValue(undefined);

    const composer = new GroupedPdfComposer({
      appendPDFToDocument,
      generateSummaryLabelPDF,
      generateTotalsLabelPDF,
      createDoc: async () => PDFDocument.create(),
      appendTextPagesToPDF: vi.fn(),
      appendOrderNamePagesToPDF,
    });

    const { pdfData, errors } = await composer.compose(
      [uQty4, uQty1],
      new Map([["gid://shopify/Order/999", "#999"]]),
    );

    expect(pdfData).toBeInstanceOf(Buffer);
    expect(errors).toEqual([]);

    expect(generateSummaryLabelPDF).toHaveBeenCalledTimes(2);
    const seenQtys = generateSummaryLabelPDF.mock.calls
      .map(([items]) =>
        (items as LineItem[]).reduce((a, b) => a + b.quantity, 0),
      )
      .sort((a, b) => a - b);
    expect(seenQtys).toEqual([1, 4]);

    const joined = events.join("|");
    const patternA = "TOT|SUMMARY:4|L4|SUMMARY:1|L1";
    const patternB = "TOT|SUMMARY:1|L1|SUMMARY:4|L4";
    expect([patternA, patternB]).toContain(joined);

    expect(generateTotalsLabelPDF).toHaveBeenCalledTimes(1);
    expect(appendOrderNamePagesToPDF).toHaveBeenCalledTimes(2);
    expect(appendOrderNamePagesToPDF).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      ["#999"],
    );
    expect(appendOrderNamePagesToPDF).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      ["#999"],
    );
  });
});
