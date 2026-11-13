import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildOrderResultsWorkbook } from "./buildOrderResultsWorkbook";
import { summarizeOrderResults, type OrderResultRow } from "./OrderResultRow";

const rows: OrderResultRow[] = [
  {
    orderId: "gid://shopify/Order/3",
    orderName: "#1010",
    status: "succeeded",
    details: "AWB 123",
  },
  {
    orderId: "gid://shopify/Order/1",
    orderName: "#1002",
    status: "failed",
    errors: ["Missing phone", "Missing city"],
  },
  {
    orderId: "gid://shopify/Order/2",
    orderName: "#1009",
    status: "skipped",
    details: "Nothing to ship",
  },
];

async function readSheet(buf: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  return workbook.getWorksheet("Results")!;
}

describe("buildOrderResultsWorkbook", () => {
  it("lists failed orders first, then skipped, then succeeded", async () => {
    const sheet = await readSheet(
      await buildOrderResultsWorkbook({
        title: "Add tracking numbers",
        shopAdminUrl: "https://admin.shopify.com/store/timoce",
        rows,
        createdAt: new Date("2026-11-13T10:00:00Z"),
      }),
    );

    const header = 5;
    const statuses = [header + 1, header + 2, header + 3].map(
      (rowNumber) => sheet.getRow(rowNumber).getCell(2).value,
    );
    expect(statuses).toEqual(["Failed", "Skipped", "Succeeded"]);
    expect(sheet.getRow(header + 1).getCell(4).value).toBe(
      "Missing phone\nMissing city",
    );
  });

  it("links each order to its admin page", async () => {
    const sheet = await readSheet(
      await buildOrderResultsWorkbook({
        title: "t",
        shopAdminUrl: "https://admin.shopify.com/store/timoce",
        rows: [rows[0]],
        createdAt: new Date(),
      }),
    );

    expect(sheet.getRow(6).getCell(1).value).toEqual({
      text: "#1010",
      hyperlink: "https://admin.shopify.com/store/timoce/orders/3",
    });
  });

  it("writes the counts in the heading", async () => {
    const sheet = await readSheet(
      await buildOrderResultsWorkbook({
        title: "t",
        shopAdminUrl: "https://admin.shopify.com/store/timoce",
        rows,
        createdAt: new Date(),
      }),
    );

    expect(sheet.getRow(3).getCell(1).value).toBe(
      "3 orders: 1 succeeded, 1 failed, 1 skipped",
    );
  });
});

describe("summarizeOrderResults", () => {
  it("leaves out zero counts", () => {
    expect(summarizeOrderResults(rows)).toBe(
      "1 succeeded, 1 failed, 1 skipped",
    );
    expect(summarizeOrderResults([rows[0]])).toBe("1 succeeded");
    expect(summarizeOrderResults([])).toBe("No orders processed");
  });
});
