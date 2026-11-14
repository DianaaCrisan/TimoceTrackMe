import { describe, it, expect, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LabelUnitKind } from "./models/LabelUnitKind";
import { GroupedPdfComposer } from "./GroupedPdfComposer";
import { LineItem } from "./models/LineItem";

describe("GroupedPdfComposer", () => {
  it("prints one totals page, then per identical items group one header page (items and order numbers) followed by its labels", async () => {
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
        else if (s.startsWith("H")) events.push("HEADER");
        else events.push(s);
      });

    const generateGroupHeaderPDF = vi.fn().mockResolvedValue(Buffer.from("H"));
    const generateTotalsPDF = vi.fn().mockResolvedValue(Buffer.from("TOT"));

    const composer = new GroupedPdfComposer({
      appendPDFToDocument,
      generateGroupHeaderPDF,
      generateTotalsPDF,
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
        kind: LabelUnitKind.DELIVERY,
      },
      {
        orderId: "gid://shopify/Order/2",
        unitId: "pickup:gid://shopify/Order/2",
        displayName: "Pickup",
        kind: LabelUnitKind.PICKUP,
      },
      {
        orderId: "gid://shopify/Order/3",
        unitId: "gid://shopify/Fulfillment/3",
        displayName: "#1204-F1",
        kind: LabelUnitKind.DELIVERY,
      },
    ]);

    expect(events).toEqual(["TOTALS", "HEADER", "LA1", "LA2", "HEADER", "LB1"]);

    expect(generateTotalsPDF).toHaveBeenCalledTimes(1);
    expect(generateTotalsPDF).toHaveBeenCalledWith(
      { delivery: 2, pickup: 1, total: 3 },
      expect.arrayContaining(["#1", "#2", "#3"]),
    );

    expect(generateGroupHeaderPDF).toHaveBeenCalledTimes(2);
    const headerCalls = generateGroupHeaderPDF.mock.calls.map(
      ([, labelCount, orderNames]) => ({ labelCount, orderNames }),
    );
    expect(headerCalls).toEqual(
      expect.arrayContaining([
        { labelCount: 2, orderNames: expect.arrayContaining(["#1", "#2"]) },
        { labelCount: 1, orderNames: ["#3"] },
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

    const generateTotalsPDF = vi.fn();

    const composer = new GroupedPdfComposer({
      appendPDFToDocument: vi.fn(),
      generateGroupHeaderPDF: vi.fn(),
      generateTotalsPDF,
      createDoc: async () => PDFDocument.create(),
    });

    await expect(
      composer.compose([badUnit], new Map([["gid://shopify/Order/3", "#3"]])),
    ).resolves.toMatchObject({
      appended: [],
      errors: [{ orderIds: ["gid://shopify/Order/3"], message: "some error" }],
    });

    expect(generateTotalsPDF).toHaveBeenCalledTimes(0);
  });

  it("prints two separate header pages for the same variant with different quantities, each followed by its label", async () => {
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

    const generateGroupHeaderPDF = vi
      .fn()
      .mockImplementation(async (items: LineItem[]) => {
        const qty = items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
        return Buffer.from(`SUMMARY:${qty}`);
      });

    const generateTotalsPDF = vi.fn().mockResolvedValue(Buffer.from("TOT"));

    const composer = new GroupedPdfComposer({
      appendPDFToDocument,
      generateGroupHeaderPDF,
      generateTotalsPDF,
      createDoc: async () => PDFDocument.create(),
    });

    const { pdfData, errors } = await composer.compose(
      [uQty4, uQty1],
      new Map([["gid://shopify/Order/999", "#999"]]),
    );

    expect(pdfData).toBeInstanceOf(Buffer);
    expect(errors).toEqual([]);

    expect(generateGroupHeaderPDF).toHaveBeenCalledTimes(2);
    const seenQtys = generateGroupHeaderPDF.mock.calls
      .map(([items]) =>
        (items as LineItem[]).reduce((a, b) => a + b.quantity, 0),
      )
      .sort((a, b) => a - b);
    expect(seenQtys).toEqual([1, 4]);

    const joined = events.join("|");
    const patternA = "TOT|SUMMARY:4|L4|SUMMARY:1|L1";
    const patternB = "TOT|SUMMARY:1|L1|SUMMARY:4|L4";
    expect([patternA, patternB]).toContain(joined);

    expect(generateTotalsPDF).toHaveBeenCalledTimes(1);
    expect(generateGroupHeaderPDF).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      1,
      ["#999"],
    );
    expect(generateGroupHeaderPDF).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      1,
      ["#999"],
    );
  });

  it("ties an error to the orders it affects", async () => {
    const unit = (orderId: string, unitId: string): LabelUnitDetails => ({
      kind: LabelUnitKind.DELIVERY,
      orderId,
      unitId,
      displayName: unitId,
      labelPDF: Buffer.from(unitId),
      lineItems: [new LineItem("vA", 1, "Antricot", "A1")],
      errors: [],
    });

    const composer = new GroupedPdfComposer({
      appendPDFToDocument: vi.fn().mockImplementation(async (bytes: Buffer) => {
        if (bytes.toString() === "F2") throw new Error("corrupt PDF");
      }),
      generateGroupHeaderPDF: vi.fn().mockRejectedValue(new Error("font")),
      createDoc: async () => PDFDocument.create(),
    });

    const { errors, appended } = await composer.compose(
      [
        unit("gid://shopify/Order/1", "F1"),
        unit("gid://shopify/Order/2", "F2"),
      ],
      new Map(),
    );

    expect(appended.map((u) => u.unitId)).toEqual(["F1"]);
    expect(errors).toEqual([
      {
        orderIds: ["gid://shopify/Order/1", "gid://shopify/Order/2"],
        message: "Items page failed to render: Error: font",
      },
      {
        orderIds: ["gid://shopify/Order/2"],
        message: "Label F2 could not be added to the PDF: Error: corrupt PDF",
      },
    ]);
  });
});
