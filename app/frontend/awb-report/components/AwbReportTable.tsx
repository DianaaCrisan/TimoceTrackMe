import type { ReactNode } from "react";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import type { Translate } from "app/commons/i18n/translate";
import type { TranslationKey } from "app/commons/i18n/translations";
import { SHOP_TIME_ZONE } from "app/commons/packs/FulfillmentPack";
import type { AwbReportRow } from "app/commons/shipping-labels/AwbReport";
import "app/frontend/awb-report/components/AwbReportTable.scss";

export type AwbTableKind = "used" | "cancelled" | "unknown";

type Column = {
  header: TranslationKey;
  numeric?: boolean;
  cell: (row: AwbReportRow, index: number) => ReactNode;
};

type AwbReportTableProps = {
  kind: AwbTableKind;
  rows: AwbReportRow[];
  shopAdminUrl: string;
  locale: Locale;
  t: Translate;
  /** Only rows added by hand get the button. */
  onDelete: (trackingNumber: string) => void;
};

/**
 * One of the report's three tables; the Excel file has the same columns.
 * Scrolls past about 10 rows.
 */
export function AwbReportTable({
  kind,
  rows,
  shopAdminUrl,
  locale,
  t,
  onDelete,
}: AwbReportTableProps) {
  const columns = buildColumns(kind, shopAdminUrl, locale, t);
  const hasHandAdded = rows.some((row) => row.source === "IMPORT");

  return (
    <div className="awb-report-table">
      <s-table>
        <s-table-header-row>
          {columns.map((column) => (
            <s-table-header
              key={column.header}
              {...(column.numeric ? { format: "numeric" } : {})}
            >
              {t(column.header)}
            </s-table-header>
          ))}
          {hasHandAdded ? <s-table-header /> : null}
        </s-table-header-row>
        <s-table-body>
          {rows.map((row, index) => (
            <s-table-row key={row.trackingNumber}>
              {columns.map((column) => (
                <s-table-cell key={column.header}>
                  {column.cell(row, index)}
                </s-table-cell>
              ))}
              {hasHandAdded ? (
                <s-table-cell>
                  {row.source === "IMPORT" ? (
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      onClick={() => onDelete(row.trackingNumber)}
                    >
                      {t("awbReport.delete")}
                    </s-button>
                  ) : null}
                </s-table-cell>
              ) : null}
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </div>
  );
}

function buildColumns(
  kind: AwbTableKind,
  shopAdminUrl: string,
  locale: Locale,
  t: Translate,
): Column[] {
  const index: Column = {
    header: "awbReport.colIndex",
    cell: (_row, i) => i + 1,
  };
  const awb: Column = {
    header: "awbReport.colAwb",
    cell: (row) =>
      kind === "cancelled" && row.printCount > 0 ? (
        <s-stack direction="block" gap="small-300">
          <s-text>{row.trackingNumber}</s-text>
          <s-badge tone="critical">{t("awbReport.printed")}</s-badge>
        </s-stack>
      ) : (
        row.trackingNumber
      ),
  };
  const order: Column = {
    header: "awbReport.colOrder",
    cell: (row) =>
      row.orderId ? (
        <s-link
          href={ShopifyUtils.getOrderAdminUrl(row.orderId, shopAdminUrl)}
          target="_blank"
        >
          {row.orderName}
        </s-link>
      ) : (
        "–"
      ),
  };
  const source: Column = {
    header: "awbReport.colSource",
    cell: (row) => t(`awbReport.source.${row.source}`),
  };
  const issued: Column = {
    header: "awbReport.colIssuedAt",
    cell: (row) => formatDateTime(row.issuedAt, locale),
  };
  const prints: Column = {
    header: "awbReport.colPrintCount",
    numeric: true,
    cell: (row) => row.printCount,
  };
  const note: Column = {
    header: "awbReport.colNote",
    cell: (row) => row.note ?? "",
  };

  switch (kind) {
    case "used":
      return [
        index,
        awb,
        order,
        source,
        {
          header: "awbReport.colParcel",
          cell: (row) => row.parcelPosition ?? "",
        },
        {
          header: "awbReport.colWeight",
          numeric: true,
          cell: (row) =>
            row.weightKg === null ? "" : formatWeight(row.weightKg, locale),
        },
        {
          header: "awbReport.colOrderDate",
          cell: (row) => formatDateTime(row.orderCreatedAt, locale),
        },
        issued,
        {
          header: "awbReport.colPrintedAt",
          cell: (row) => formatDateTime(row.firstPrintedAt, locale),
        },
        prints,
        note,
      ];
    case "cancelled":
      return [
        index,
        awb,
        order,
        source,
        issued,
        {
          header: "awbReport.colCancelledAt",
          cell: (row) => formatDateTime(row.cancelledAt, locale),
        },
        {
          header: "awbReport.colReason",
          cell: (row) =>
            row.cancelReason ? t(`awbReport.reason.${row.cancelReason}`) : "",
        },
        prints,
        note,
      ];
    case "unknown":
      return [
        index,
        awb,
        order,
        {
          header: "awbReport.colCourier",
          cell: (row) => row.trackingCompany ?? "–",
        },
        {
          header: "awbReport.colStatus",
          cell: (row) => t(`awbReport.status.${row.status}`),
        },
        issued,
        prints,
      ];
  }
}

/** By the shop's clock, like the month the report is cut by. */
function formatDateTime(iso: string | null, locale: Locale): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: SHOP_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatWeight(weightKg: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 2,
  }).format(weightKg);
}
