import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminApiContextWithoutRest } from "../../core/types/AdminApiContextWithoutRest";
import { getOrderNames } from "../../orders/getOrderNames.server";
import { buildPrintLabels } from "../../print-labels/printLabels.server";
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
  beforeEach(() => {
    vi.mocked(getOrderNames).mockResolvedValue(new Map([[gid(3), "#1003"]]));
  });

  it("zips the PDFs, the report and the errors", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue({
      files: [
        {
          fileName: "shipping-labels_13-Nov-2026_12-00.pdf",
          buf: Buffer.from("pdf"),
        },
      ],
      printedUnits: [
        { orderId: gid(1), unitId: "f1", displayName: "#1001-F1" },
        { orderId: gid(1), unitId: "f2", displayName: "#1001-F2" },
      ],
      orderNamesById: new Map([
        [gid(1), "#1001"],
        [gid(2), "#1002"],
      ]),
      errors: ["Order #1002: Label for tracking number '123' failed to load"],
      timestamp: "13-Nov-2026_12-00",
    });

    const artifact = await buildPrintLabelsArtifact(ctx);
    const zip = await JSZip.loadAsync(artifact.buf);

    expect(artifact.fileName).toBe("labels_13-Nov-2026_12-00.zip");
    expect(artifact.summary).toBe("2 labels for 1 orders, 1 errors");
    expect(artifact.hasErrors).toBe(true);
    expect(Object.keys(zip.files).sort()).toEqual([
      "errors.txt",
      "print-labels-results.xlsx",
      "shipping-labels_13-Nov-2026_12-00.pdf",
    ]);
    const rows = await readResultRows(
      await zip.file("print-labels-results.xlsx")!.async("nodebuffer"),
    );
    expect(rows.map((row) => row.slice(0, 3))).toEqual([
      ["#1002", "Skipped", expect.stringContaining("No label to print")],
      ["#1003", "Skipped", expect.stringContaining("No label to print")],
      ["#1001", "Succeeded", "2 labels"],
    ]);
  });

  it("fails the job when there are errors and no PDF at all", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue({
      files: [],
      printedUnits: [],
      orderNamesById: new Map(),
      errors: ["Optimus is down"],
      timestamp: "13-Nov-2026_12-00",
    });

    await expect(buildPrintLabelsArtifact(ctx)).rejects.toThrow(
      "No labels could be generated:\nOptimus is down",
    );
  });

  it("still produces a report when every order is simply skipped", async () => {
    vi.mocked(buildPrintLabels).mockResolvedValue({
      files: [],
      printedUnits: [],
      orderNamesById: new Map(),
      errors: [],
      timestamp: "13-Nov-2026_12-00",
    });
    vi.mocked(getOrderNames).mockResolvedValue(
      new Map([
        [gid(1), "#1001"],
        [gid(2), "#1002"],
        [gid(3), "#1003"],
      ]),
    );

    const artifact = await buildPrintLabelsArtifact(ctx);

    expect(artifact.hasErrors).toBe(false);
    expect(artifact.summary).toBe("0 labels for 0 orders");
  });
});
