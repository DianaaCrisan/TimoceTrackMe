import ExcelJS from "exceljs";
import { ShopifyUtils } from "../graphql/utils/ShopifyUtils";
import {
  countOrderResults,
  type OrderResultRow,
  type OrderResultStatus,
} from "./OrderResultRow";

const STATUS_ORDER: Record<OrderResultStatus, number> = {
  failed: 0,
  skipped: 1,
  succeeded: 2,
};

const STATUS_LABEL: Record<OrderResultStatus, string> = {
  failed: "Failed",
  skipped: "Skipped",
  succeeded: "Succeeded",
};

const STATUS_FILL: Record<OrderResultStatus, string> = {
  failed: "FFFED3D1",
  skipped: "FFFFF1CC",
  succeeded: "FFCDFEE1",
};

/**
 * One sheet, one row per order. Failed orders come first, since they are the
 * ones that need someone's attention; each order name links to its admin page.
 */
export async function buildOrderResultsWorkbook(args: {
  title: string;
  shopAdminUrl: string;
  rows: OrderResultRow[];
  createdAt: Date;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Results");

  sheet.columns = [
    { key: "order", width: 14 },
    { key: "status", width: 12 },
    { key: "details", width: 50 },
    { key: "errors", width: 90 },
  ];

  const counts = countOrderResults(args.rows);
  sheet.addRow([args.title]).font = { bold: true, size: 14 };
  sheet.addRow([`Created ${args.createdAt.toISOString()}`]);
  sheet.addRow([
    `${args.rows.length} orders: ${counts.succeeded} succeeded, ${counts.failed} failed, ${counts.skipped} skipped`,
  ]);
  sheet.addRow([]);

  const header = sheet.addRow(["Order", "Status", "Details", "Errors"]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });
  sheet.views = [{ state: "frozen", ySplit: header.number }];

  for (const row of sortRows(args.rows)) {
    const added = sheet.addRow([
      {
        text: row.orderName,
        hyperlink: ShopifyUtils.getOrderAdminUrl(
          row.orderId,
          args.shopAdminUrl,
        ),
      },
      STATUS_LABEL[row.status],
      row.details ?? "",
      (row.errors ?? []).join("\n"),
    ]);

    added.alignment = { vertical: "top", wrapText: true };
    added.getCell("order").font = {
      color: { argb: "FF005BD3" },
      underline: true,
    };
    added.getCell("status").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STATUS_FILL[row.status] },
    };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function sortRows(rows: OrderResultRow[]): OrderResultRow[] {
  return [...rows].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.orderName.localeCompare(b.orderName, undefined, { numeric: true }),
  );
}
