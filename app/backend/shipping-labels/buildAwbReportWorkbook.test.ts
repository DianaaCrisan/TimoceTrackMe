import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { awbReportRow } from "app/commons/shipping-labels/awbReportRow.fixture";
import {
  AWB_REPORT_FIRST_ROW,
  buildAwbReportWorkbook,
} from "./buildAwbReportWorkbook";

const SHOP_ADMIN_URL = "https://admin.shopify.com/store/timoce";

const rows = [
  awbReportRow({
    trackingNumber: "6256347789",
    orderId: "gid://shopify/Order/22",
    orderName: "#1022",
    orderCreatedAt: "2026-11-10T08:00:00.000Z",
    parcelPosition: "2/2",
    weightKg: 12.5,
    issuedAt: "2026-11-16T10:41:00.000Z",
    status: "CANCELLED",
    cancelReason: "TRACKING_REMOVED",
    cancelledAt: "2026-11-16T12:00:00.000Z",
    firstPrintedAt: "2026-11-16T11:00:00.000Z",
    printCount: 1,
  }),
  awbReportRow({
    trackingNumber: "6256285352",
    orderId: "gid://shopify/Order/9",
    orderName: "#1009",
    // placed in October, its AWB issued in November
    orderCreatedAt: "2026-10-30T09:00:00.000Z",
    weightKg: 3,
    issuedAt: "2026-11-02T07:00:00.000Z",
    firstPrintedAt: "2026-11-02T08:00:00.000Z",
    printCount: 2,
  }),
  awbReportRow({
    trackingNumber: "6256000003",
    source: "IMPORT",
    orderId: null,
    orderName: null,
    orderCreatedAt: null,
    weightKg: null,
    issuedAt: "2026-11-05T00:00:00.000Z",
    status: "CANCELLED",
    cancelReason: "SET_BY_HAND",
    cancelledAt: "2026-11-05T00:00:00.000Z",
    note: "livrat de noi",
  }),
  awbReportRow({
    trackingNumber: "ABC123",
    source: "SHOPIFY",
    courier: "UNKNOWN",
    trackingCompany: "Fan Courier",
    orderName: "#1030",
    weightKg: null,
    issuedAt: "2026-11-07T07:00:00.000Z",
  }),
];

async function build(locale: "ro" | "en", input = rows) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await buildAwbReportWorkbook({
      month: "2026-11",
      rows: input,
      shopAdminUrl: SHOP_ADMIN_URL,
      generatedAt: new Date("2026-11-17T12:00:00Z"),
      locale,
    })) as unknown as ArrayBuffer,
  );
  return workbook;
}

describe("buildAwbReportWorkbook", () => {
  it("has one sheet per table, in the user's language", async () => {
    const workbook = await build("ro");

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "AWB-uri folosite",
      "AWB-uri anulate",
      "Curier nerecunoscut",
    ]);
    expect(workbook.worksheets[0].getCell("A1").value).toBe(
      "AWB-uri folosite – Noiembrie 2026",
    );
  });

  it("lists used AWBs with their order, parcel, weight and dates", async () => {
    const sheet = (await build("ro")).getWorksheet("AWB-uri folosite")!;

    expect(sheet.getCell("A3").value).toBe("1 AWB");
    const row = sheet.getRow(AWB_REPORT_FIRST_ROW);
    // kept as text, never as a number
    expect(row.getCell(2).value).toBe("6256285352");
    expect(row.getCell(3).value).toEqual({
      text: "#1009",
      hyperlink: `${SHOP_ADMIN_URL}/orders/9`,
    });
    expect(row.getCell(4).value).toBe("TrackMe");
    expect(row.getCell(6).value).toBe(3);
    // Bucharest wall-clock times, as Excel dates
    expect((row.getCell(7).value as Date).toISOString()).toBe(
      "2026-10-30T11:00:00.000Z",
    );
    expect((row.getCell(8).value as Date).toISOString()).toBe(
      "2026-11-02T09:00:00.000Z",
    );
    expect(row.getCell(8).numFmt).toBe("dd.mm.yyyy hh:mm");
    expect(row.getCell(10).value).toBe(2);
  });

  it("lists cancelled AWBs, oldest first, with the reason; printed ones are highlighted", async () => {
    const sheet = (await build("ro")).getWorksheet("AWB-uri anulate")!;
    const handAdded = sheet.getRow(AWB_REPORT_FIRST_ROW);
    const printed = sheet.getRow(AWB_REPORT_FIRST_ROW + 1);

    expect(handAdded.getCell(2).value).toBe("6256000003");
    expect(handAdded.getCell(3).value).toBe("");
    expect(handAdded.getCell(4).value).toBe("Adăugat de mână");
    expect(handAdded.getCell(7).value).toBe("Adăugat de mână ca anulat");
    expect(handAdded.getCell(10).value).toBe("livrat de noi");
    expect(handAdded.getCell(2).fill).toBeUndefined();

    expect(printed.getCell(2).value).toBe("6256347789");
    expect(printed.getCell(7).value).toBe(
      "Tracking-ul a fost șters în Shopify",
    );
    expect(printed.getCell(2).fill).toMatchObject({
      fgColor: { argb: "FFFED3D1" },
    });
  });

  it("lists AWBs with an unrecognised courier, with the courier as typed", async () => {
    const sheet = (await build("en")).getWorksheet("Unrecognised courier")!;
    const row = sheet.getRow(AWB_REPORT_FIRST_ROW);

    expect(row.getCell(2).value).toBe("ABC123");
    expect(row.getCell(4).value).toBe("Fan Courier");
    expect(row.getCell(5).value).toBe("Used");
  });

  it("still makes every sheet for a month without AWBs", async () => {
    const workbook = await build("en", []);

    for (const sheet of workbook.worksheets) {
      expect(sheet.getCell("A3").value).toBe("0 AWBs");
      expect(sheet.rowCount).toBe(AWB_REPORT_FIRST_ROW - 1);
    }
  });
});
