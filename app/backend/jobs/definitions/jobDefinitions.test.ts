import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../../core/types/AdminApiContextWithoutRest";
import { getOrderNames } from "../../orders/getOrderNames.server";
import { LabelUnitKind } from "../../print-labels/models/LabelUnitKind";
import { markLabelsPrinted } from "../../print-labels/markLabelsPrinted.server";
import {
  buildPrintLabels,
  type PrintLabelsResult,
} from "../../print-labels/printLabels.server";
import { SolveZipService } from "../../zip-solver/SolveZipService";
import type { OrdersJobContext } from "./OrdersJobContext";
import { buildPrintLabelsArtifact } from "./printLabelsJob.server";
import { buildSolveZipArtifact } from "./solveZipJob.server";

vi.mock("../../orders/getOrderNames.server", () => ({
  getOrderNames: vi.fn(),
}));
vi.mock("../../zip-solver/SolveZipService", () => ({
  SolveZipService: { solveMissingZipCodesWithOrderIds: vi.fn() },
}));
vi.mock("../../print-labels/printLabels.server", () => ({
  buildPrintLabels: vi.fn(),
}));
vi.mock("../../print-labels/markLabelsPrinted.server", () => ({
  markLabelsPrinted: vi.fn(),
}));

const gid = (n: number) => `gid://shopify/Order/${n}`;

const ctx: OrdersJobContext = {
  admin: {} as AdminApiContextWithoutRest,
  shopUrl: "https://admin.shopify.com/store/timoce",
  orderIds: [gid(1), gid(2), gid(3)],
  startedAt: new Date("2026-11-13T10:00:00Z"),
  timeZone: "Europe/Bucharest",
};

async function readResultRows(buf: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet("Results")!;
  const rows: string[][] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 5) return; // title block and header
    rows.push(
      [1, 2, 3, 4].map((col) => {
        const value = row.getCell(col).value;
        return typeof value === "object" && value && "text" in value
          ? String(value.text)
          : String(value ?? "");
      }),
    );
  });
  return rows;
}

describe("buildSolveZipArtifact", () => {
  beforeEach(() => {
    vi.mocked(getOrderNames).mockResolvedValue(new Map([[gid(3), "#1003"]]));
  });

  it("reports solved, failed and skipped orders, counting a ZIP that could not be saved as failed", async () => {
    vi.mocked(
      SolveZipService.solveMissingZipCodesWithOrderIds,
    ).mockResolvedValue({
      processedOrdersSolvedZip: [
        {
          id: gid(1),
          name: "#1001",
          zipCode: "400001",
          confidenceLevel: "high",
        },
        {
          id: gid(2),
          name: "#1002",
          zipCode: "500001",
          confidenceLevel: "medium",
        },
      ],
      processedOrdersUnsolvedZip: [],
      unsupportedOrders: [
        { id: gid(2), name: "#1002", errorStack: ["orderUpdate failed"] },
      ],
    } as never);

    const artifact = await buildSolveZipArtifact(ctx);

    expect(artifact.summary).toBe("1 succeeded, 1 failed, 1 skipped");
    expect(artifact.hasErrors).toBe(true);
    expect(await readResultRows(artifact.buf)).toEqual([
      [
        "#1002",
        "Failed",
        "ZIP set to 500001 (medium confidence)",
        "orderUpdate failed",
      ],
      ["#1003", "Skipped", "Already has a ZIP code, or is a pickup order.", ""],
      ["#1001", "Succeeded", "ZIP set to 400001 (high confidence)", ""],
    ]);
  });
});

describe("buildPrintLabelsArtifact", () => {
  const printResult = (
    overrides: Partial<PrintLabelsResult> = {},
  ): PrintLabelsResult => ({
    files: [
      {
        fileName: "shipping-labels_13-Nov-2026_12-00.pdf",
        buf: Buffer.from("pdf"),
      },
    ],
    printedUnits: [
      {
        orderId: gid(1),
        unitId: "gid://shopify/Fulfillment/1",
        displayName: "#1001-F1",
        kind: LabelUnitKind.DELIVERY,
      },
      {
        orderId: gid(1),
        unitId: "gid://shopify/Fulfillment/2",
        displayName: "#1001-F2",
        kind: LabelUnitKind.DELIVERY,
      },
    ],
    orderNamesById: new Map([
      [gid(1), "#1001"],
      [gid(2), "#1002"],
      [gid(3), "#1003"],
    ]),
    errorsByOrderId: new Map(),
    generalErrors: [],
    timestamp: "13-Nov-2026_12-00",
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(getOrderNames).mockReset();
    vi.mocked(markLabelsPrinted).mockReset();
    vi.mocked(markLabelsPrinted).mockResolvedValue({
      failuresByOrderId: new Map(),
    });
  });

  async function reportRows(artifactBuf: Buffer) {
    const zip = await JSZip.loadAsync(artifactBuf);
    return readResultRows(
      await zip.file("print-labels-results.xlsx")!.async("nodebuffer"),
    );
  }

  it("zips the PDFs and the report, and marks printed orders", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(printResult());

    const artifact = await buildPrintLabelsArtifact(ctx);
    const zip = await JSZip.loadAsync(artifact.buf);

    expect(markLabelsPrinted).toHaveBeenCalledWith(
      ctx.admin,
      ctx.shopUrl,
      printResult().printedUnits,
    );
    expect(artifact.fileName).toBe("labels_13-Nov-2026_12-00.zip");
    expect(artifact.summary).toBe("2 labels for 1 orders");
    expect(artifact.hasErrors).toBe(false);
    expect(Object.keys(zip.files).sort()).toEqual([
      "print-labels-results.xlsx",
      "shipping-labels_13-Nov-2026_12-00.pdf",
    ]);
    expect(
      (await reportRows(artifact.buf)).map((row) => row.slice(0, 3)),
    ).toEqual([
      ["#1002", "Skipped", expect.stringContaining("No label to print")],
      ["#1003", "Skipped", expect.stringContaining("No label to print")],
      ["#1001", "Succeeded", "2 labels, marked as printed"],
    ]);
    // every name was known from the print query
    expect(getOrderNames).not.toHaveBeenCalled();
  });

  it("reports a failed label against its order", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(
      printResult({
        errorsByOrderId: new Map([
          [
            gid(2),
            ["Order #1002: Label for tracking number '123' failed to load"],
          ],
        ]),
      }),
    );

    const artifact = await buildPrintLabelsArtifact(ctx);

    expect(artifact.hasErrors).toBe(true);
    expect(artifact.summary).toBe("2 labels for 1 orders, 1 orders failed");
    expect(await reportRows(artifact.buf)).toContainEqual([
      "#1002",
      "Failed",
      "No label printed",
      "Order #1002: Label for tracking number '123' failed to load",
    ]);
  });

  it("keeps a printed order as succeeded when only the marking failed, but flags it", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(printResult());
    vi.mocked(markLabelsPrinted).mockResolvedValue({
      failuresByOrderId: new Map([
        [gid(1), ['Could not add the "eticheta-printata" tag: throttled']],
      ]),
    });

    const artifact = await buildPrintLabelsArtifact(ctx);

    expect(artifact.hasErrors).toBe(true);
    expect(artifact.summary).toBe(
      "2 labels for 1 orders, 1 orders not marked as printed",
    );
    expect(await reportRows(artifact.buf)).toContainEqual([
      "#1001",
      "Succeeded",
      "2 labels",
      'Could not add the "eticheta-printata" tag: throttled',
    ]);
  });

  it("puts errors that belong to no order in errors.txt", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(
      printResult({ generalErrors: ["Totals page render failed"] }),
    );

    const artifact = await buildPrintLabelsArtifact(ctx);
    const zip = await JSZip.loadAsync(artifact.buf);

    expect(await zip.file("errors.txt")!.async("string")).toBe(
      "Totals page render failed\n",
    );
    expect(artifact.hasErrors).toBe(true);
  });

  it("names every file and the PDFs' language after the user's language", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(
      printResult({
        files: [
          {
            fileName: "etichete-livrare_1001.pdf",
            buf: Buffer.from("pdf"),
          },
        ],
        generalErrors: ["Totals page render failed"],
        timestamp: "13-nov-2026_12-00",
      }),
    );

    const artifact = await buildPrintLabelsArtifact({ ...ctx, locale: "ro" });
    const zip = await JSZip.loadAsync(artifact.buf);

    expect(buildPrintLabels).toHaveBeenCalledWith(ctx.admin, ctx.shopUrl, {
      orderIds: ctx.orderIds,
      timeZone: ctx.timeZone,
      locale: "ro",
    });
    expect(artifact.fileName).toBe("etichete_13-nov-2026_12-00.zip");
    expect(Object.keys(zip.files).sort()).toEqual([
      "erori.txt",
      "etichete-livrare_1001.pdf",
      "rezultate-printare-etichete.xlsx",
    ]);
    expect(artifact.summary).toContain("vezi erori.txt");
  });

  it("fails the job when there are errors and no PDF at all, without marking anything", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(
      printResult({
        files: [],
        printedUnits: [],
        errorsByOrderId: new Map([[gid(1), ["Optimus is down"]]]),
      }),
    );

    await expect(buildPrintLabelsArtifact(ctx)).rejects.toThrow(
      "No labels could be generated:\nOptimus is down",
    );
    expect(markLabelsPrinted).not.toHaveBeenCalled();
  });

  it("still produces a report when every order is simply skipped", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue(
      printResult({ files: [], printedUnits: [] }),
    );

    const artifact = await buildPrintLabelsArtifact(ctx);

    expect(artifact.hasErrors).toBe(false);
    expect(artifact.summary).toBe("0 labels for 0 orders");
    expect(markLabelsPrinted).not.toHaveBeenCalled();
  });
});
