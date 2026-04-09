import { describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { GroupedPdfComposer } from "./GroupedPdfComposer";
import { LineItem } from "app/commons/models/LineItem";

describe("GroupedPdfComposer", () => {
  it("prints one summary per identical items group, then all labels in that group", async () => {
    // Group 1 signature: { Dragon Fruit - 2kg(Spain)(2), Tropical Mix - 4kg(Spain,Ecuador)(1) }
    const u1: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/1",
      unitId: "gid://shopify/Fulfillment/1",
      displayName: "#1203-F1",
      labelPDF: Buffer.from("LA1"),
      lineItems: [
        new LineItem("vA", 1, "Dragon Fruit - 2kg", ["Spain"], "10"),
        new LineItem("vA", 1, "Dragon Fruit - 2kg", ["Spain"], "10"),
        new LineItem("vB", 1, "Tropical Mix - 4kg", ["Spain", "Ecuador"], "11"),
      ],
      trackingNumber: "TN1",
      errors: [],
    };

    // Group 2 signature: same as the one for group 1
    const u2: LabelUnitDetails = {
      kind: LabelUnitKind.PICKUP,
      orderId: "gid://shopify/Order/2",
      unitId: "pickup:gid://shopify/Order/2",
      displayName: "Pickup",
      labelPDF: Buffer.from("LA2"),
      lineItems: [
        new LineItem("vB", 1, "Tropical Mix - 4kg", ["Spain", "Ecuador"], "12"),
        new LineItem("vA", 2, "Dragon Fruit - 2kg", ["Spain"], "13"),
      ],
      errors: [],
    };

    // Group 3 signature: { Papaya - 2kg(Spain)(5) }
    const u3: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/3",
      unitId: "gid://shopify/Fulfillment/3",
      displayName: "#1204-F1",
      labelPDF: Buffer.from("LB1"),
      lineItems: [new LineItem("vD", 5, "Papaya - 2kg", ["Spain"], "14")],
      errors: [],
    };

    const events: string[] = [];

    const appendPDFToDocument = vi
      .fn()
      .mockImplementation(async (bytes: Buffer, _doc: PDFDocument) => {
        // record whether it's a summary or which label we appended
        const s = bytes.toString();
        if (s === "TOT") events.push("TOTALS");
        else if (s.startsWith("S")) events.push("SUMMARY");
        else events.push(s); // "LA1", "LA2", "LB1"
      });

    const generateSummaryLabelPDF = vi.fn().mockResolvedValue(Buffer.from("S")); // sentinel for summaries
    const generateTotalsLabelPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("TOT"));
    const appendTextPagesToPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("errors"));
    const appendOrderNamePagesToPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("orders"));

    const createDoc = async () => PDFDocument.create();

    const composer = new GroupedPdfComposer("ro-RO", {
      appendPDFToDocument,
      generateSummaryLabelPDF,
      generateTotalsLabelPDF,
      appendTextPagesToPDF,
      appendOrderNamePagesToPDF,
      createDoc,
    });

    const { pdfData, errors } = await composer.compose(
      [u1, u2, u3],
      new Map([
        ["#1", "gid://shopify/Order/1"],
        ["#2", "gid://shopify/Order/2"],
        ["#3", "gid://shopify/Order/3"],
      ]),
    );

    // basic assertions
    expect(errors).toEqual([]);
    expect(pdfData).toBeInstanceOf(Buffer);

    // order: Summary(Group A), LA1, LA2, Summary(Group B), LB1
    // (units inside group sorted by displayName)
    expect(events).toEqual([
      "TOTALS",
      "SUMMARY",
      "LA1",
      "LA2",
      "SUMMARY",
      "LB1",
    ]);

    expect(generateTotalsLabelPDF).toHaveBeenCalledTimes(1);

    // summaries called twice with correct labelCount per group
    // (Group A has 2 labels, Group B has 1)
    expect(generateSummaryLabelPDF).toHaveBeenCalledTimes(2);
    const counts = generateSummaryLabelPDF.mock.calls.map(
      ([, , labelCount]) => labelCount,
    );
    expect(counts.sort()).toEqual([1, 2]);
  });

  it("bubbles up an error when no labels could be appended", async () => {
    const badUnit: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/3",
      unitId: "gid://shopify/Fulfillment/3",
      displayName: "#1204-F1",
      labelPDF: null,
      lineItems: [],
      errors: ["some error"],
    };

    const composer = new GroupedPdfComposer("ro-RO", {
      appendPDFToDocument: vi.fn(),
      generateSummaryLabelPDF: vi.fn(),
      generateTotalsLabelPDF: vi.fn(),
      appendTextPagesToPDF: vi.fn(),
      appendOrderNamePagesToPDF: vi.fn(),
      createDoc: async () => PDFDocument.create(),
    });

    await expect(
      composer.compose([badUnit], new Map([["#3", "gid://shopify/Order/3"]])),
    ).resolves.toMatchObject({
      appended: [],
      errors: ["some error"],
    });

    expect(composer["deps"].generateTotalsLabelPDF).toHaveBeenCalledTimes(0);
  });

  it("prints two separate summaries for the same variant with different quantities, each followed by its label", async () => {
    // Same variantId, different quantities per fulfillment
    const variantId = "gid://shopify/ProductVariant/KEITT";

    const uQty4: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/999",
      displayName: "#F1",
      unitId: "gid://shopify/Fulfillment/1",
      labelPDF: Buffer.from("L4"),
      lineItems: [
        new LineItem(variantId, 4, "Mango Keitt - 4kg", ["Spain"], "17"),
      ],
      errors: [],
    };

    const uQty1: LabelUnitDetails = {
      kind: LabelUnitKind.DELIVERY,
      orderId: "gid://shopify/Order/999",
      displayName: "#F2",
      unitId: "gid://shopify/Fulfillment/2",
      labelPDF: Buffer.from("L1"),
      lineItems: [
        new LineItem(variantId, 1, "Mango Keitt - 4kg", ["Spain"], "17"),
      ],
      errors: [],
    };

    // capture append order; we’ll tag summaries by the quantity they were rendered with
    const events: string[] = [];

    const appendPDFToDocument = vi
      .fn()
      .mockImplementation(async (bytes: Buffer, _doc: PDFDocument) => {
        const s = bytes.toString();
        events.push(s); // "TOT", "SUMMARY:4", "L4", ...
      });

    // return a tiny PDF buffer that encodes which summary we rendered ("SUMMARY:4" / "SUMMARY:1")
    const generateSummaryLabelPDF = vi
      .fn()
      .mockImplementation(
        async (items: LineItem[], _locale: any, _count: number) => {
          const qty = items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
          return Buffer.from(`SUMMARY:${qty}`);
        },
      );

    const generateTotalsLabelPDF = vi
      .fn()
      .mockResolvedValue(Buffer.from("TOT"));

    const composer = new GroupedPdfComposer("ro-RO", {
      appendPDFToDocument,
      generateSummaryLabelPDF,
      generateTotalsLabelPDF,
      createDoc: async () => PDFDocument.create(),
      // we don't use appendTextPagesToPDF in this test path
      appendTextPagesToPDF: vi.fn(),
      appendOrderNamePagesToPDF: vi.fn(),
    });

    const { pdfData, errors } = await composer.compose(
      [uQty4, uQty1],
      new Map([["#999", "gid://shopify/Order/999"]]),
    );

    expect(pdfData).toBeInstanceOf(Buffer);
    expect(errors).toEqual([]);

    // 1) ensure we generated two summaries, one for qty 4 and one for qty 1
    expect(generateSummaryLabelPDF).toHaveBeenCalledTimes(2);
    const seenQtys = generateSummaryLabelPDF.mock.calls
      .map(([items]) =>
        (items as LineItem[]).reduce((a, b) => a + b.quantity, 0),
      )
      .sort((a, b) => a - b);
    expect(seenQtys).toEqual([1, 4]);

    // 2) ensure each summary is immediately followed by its label
    // events could be either ["SUMMARY:4","L4","SUMMARY:1","L1"] or ["SUMMARY:1","L1","SUMMARY:4","L4"]
    const joined = events.join("|");
    const patternA = "TOT|SUMMARY:4|L4|SUMMARY:1|L1";
    const patternB = "TOT|SUMMARY:1|L1|SUMMARY:4|L4";
    expect([patternA, patternB]).toContain(joined);

    expect(generateTotalsLabelPDF).toHaveBeenCalledTimes(1);
  });
});
