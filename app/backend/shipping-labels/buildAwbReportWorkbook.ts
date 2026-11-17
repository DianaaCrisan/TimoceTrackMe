import ExcelJS from "exceljs";
import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import { createTranslator, type Translate } from "app/commons/i18n/translate";
import type { TranslationKey } from "app/commons/i18n/translations";
import { SHOP_TIME_ZONE } from "app/commons/packs/FulfillmentPack";
import {
  formatReportMonth,
  splitAwbReport,
  toShopWallClock,
  type AwbReportRow,
  type ReportMonth,
} from "app/commons/shipping-labels/AwbReport";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";

const DATE_TIME_FORMAT = "dd.mm.yyyy hh:mm";
const LINK_COLOR = "FF005BD3";
/** Cancelled but printed: the label may have reached the courier. */
const PRINTED_CANCELLED_FILL = "FFFED3D1";

/** The rows start below the title block and the header. */
export const AWB_REPORT_FIRST_ROW = 6;

type CellValue = ExcelJS.CellValue;

type Column = {
  header: TranslationKey;
  width: number;
  value: (row: AwbReportRow, index: number) => CellValue;
  numFmt?: string;
  isLink?: boolean;
};

/**
 * The month's AWBs in three sheets: used, cancelled, and unrecognised
 * courier, each oldest first, in the user's language. Dates are real Excel
 * dates in the shop's time zone, so they sort and filter; each order links to
 * its admin page.
 */
export async function buildAwbReportWorkbook(args: {
  month: ReportMonth;
  rows: AwbReportRow[];
  shopAdminUrl: string;
  generatedAt: Date;
  locale: Locale;
}): Promise<Buffer> {
  const t = createTranslator(args.locale);
  const monthName = formatReportMonth(args.month, args.locale);
  const tables = splitAwbReport(args.rows);
  const workbook = new ExcelJS.Workbook();
  const generatedLine = t("report.generatedAt", {
    date: formatGeneratedAt(args.generatedAt, args.locale),
  });
  const columns = buildColumns(t, args.shopAdminUrl);

  const sheets: {
    name: TranslationKey;
    rows: AwbReportRow[];
    columns: Column[];
    highlight?: (row: AwbReportRow) => boolean;
  }[] = [
    { name: "awbReport.usedHeading", rows: tables.used, columns: columns.used },
    {
      name: "awbReport.cancelledHeading",
      rows: tables.cancelled,
      columns: columns.cancelled,
      highlight: (row) => row.printCount > 0,
    },
    {
      name: "awbReport.unknownHeading",
      rows: tables.unknownCourier,
      columns: columns.unknown,
    },
  ];

  for (const spec of sheets) {
    const name = t(spec.name);
    const sheet = workbook.addWorksheet(name);
    sheet.columns = spec.columns.map((column) => ({ width: column.width }));

    sheet.addRow([`${name} – ${monthName}`]).font = { bold: true, size: 14 };
    sheet.addRow([generatedLine]);
    sheet.addRow([t("awbReport.count", { count: spec.rows.length })]);
    sheet.addRow([]);

    const header = sheet.addRow(spec.columns.map((c) => t(c.header)));
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.border = { bottom: { style: "thin" } };
    });
    sheet.views = [{ state: "frozen", ySplit: header.number }];

    spec.rows.forEach((row, index) => {
      const added = sheet.addRow(
        spec.columns.map((column) => column.value(row, index)),
      );
      spec.columns.forEach((column, columnIndex) => {
        const cell = added.getCell(columnIndex + 1);
        if (column.numFmt) cell.numFmt = column.numFmt;
        if (column.isLink && row.orderId) {
          cell.font = { color: { argb: LINK_COLOR }, underline: true };
        }
      });
      if (spec.highlight?.(row)) {
        added.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: PRINTED_CANCELLED_FILL },
          };
        });
      }
    });

    if (spec.rows.length > 0) {
      sheet.autoFilter = {
        from: { row: header.number, column: 1 },
        to: {
          row: header.number + spec.rows.length,
          column: spec.columns.length,
        },
      };
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildColumns(t: Translate, shopAdminUrl: string) {
  const date = (iso: string | null) =>
    iso ? toShopWallClock(new Date(iso)) : null;

  const index: Column = {
    header: "awbReport.colIndex",
    width: 6,
    value: (_row, i) => i + 1,
  };
  // text, so long AWBs never turn into 6.25E+09
  const awb: Column = {
    header: "awbReport.colAwb",
    width: 16,
    value: (row) => row.trackingNumber,
  };
  const order: Column = {
    header: "awbReport.colOrder",
    width: 11,
    isLink: true,
    value: (row) =>
      row.orderId && row.orderName
        ? {
            text: row.orderName,
            hyperlink: ShopifyUtils.getOrderAdminUrl(row.orderId, shopAdminUrl),
          }
        : (row.orderName ?? ""),
  };
  const source: Column = {
    header: "awbReport.colSource",
    width: 16,
    value: (row) => t(`awbReport.source.${row.source}`),
  };
  const issued: Column = {
    header: "awbReport.colIssuedAt",
    width: 17,
    numFmt: DATE_TIME_FORMAT,
    value: (row) => date(row.issuedAt),
  };
  const printed: Column = {
    header: "awbReport.colPrintedAt",
    width: 17,
    numFmt: DATE_TIME_FORMAT,
    value: (row) => date(row.firstPrintedAt),
  };
  const prints: Column = {
    header: "awbReport.colPrintCount",
    width: 9,
    value: (row) => row.printCount,
  };
  const note: Column = {
    header: "awbReport.colNote",
    width: 30,
    value: (row) => row.note ?? "",
  };

  return {
    used: [
      index,
      awb,
      order,
      source,
      {
        header: "awbReport.colParcel",
        width: 8,
        value: (row) => row.parcelPosition ?? "",
      },
      {
        header: "awbReport.colWeight",
        width: 11,
        numFmt: "0.00",
        value: (row) => row.weightKg,
      },
      {
        header: "awbReport.colOrderDate",
        width: 17,
        numFmt: DATE_TIME_FORMAT,
        value: (row) => date(row.orderCreatedAt),
      },
      issued,
      printed,
      prints,
      note,
    ] satisfies Column[],
    cancelled: [
      index,
      awb,
      order,
      source,
      issued,
      {
        header: "awbReport.colCancelledAt",
        width: 17,
        numFmt: DATE_TIME_FORMAT,
        value: (row) => date(row.cancelledAt),
      },
      {
        header: "awbReport.colReason",
        width: 30,
        value: (row) =>
          row.cancelReason ? t(`awbReport.reason.${row.cancelReason}`) : "",
      },
      printed,
      prints,
      note,
    ] satisfies Column[],
    unknown: [
      index,
      awb,
      order,
      {
        header: "awbReport.colCourier",
        width: 18,
        value: (row) => row.trackingCompany ?? "",
      },
      {
        header: "awbReport.colStatus",
        width: 12,
        value: (row) => t(`awbReport.status.${row.status}`),
      },
      issued,
      printed,
      prints,
    ] satisfies Column[],
  };
}

function formatGeneratedAt(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: SHOP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
