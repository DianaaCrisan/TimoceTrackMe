import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ShopifyUtils } from "app/backend/graphql/utils/ShopifyUtils";
import { handleAwbReportAction } from "app/backend/shipping-labels/handleAwbReportAction.server";
import { ShippingLabelRepository } from "app/backend/shipping-labels/ShippingLabelRepository.server";
import { INTL_LOCALE, LOCALE_PARAM } from "app/commons/i18n/Locale";
import { SHOP_TIME_ZONE, toShopDay } from "app/commons/packs/FulfillmentPack";
import {
  AWB_REPORT_FIELDS,
  AWB_REPORT_INTENT,
  AWB_REPORT_XLSX_PATH,
  formatReportMonth,
  listRecentMonths,
  parseReportMonth,
  REPORT_MONTH_PARAM,
  splitAwbReport,
  toShopMonth,
  type AwbReportActionResponse,
  type AwbReportIntent,
} from "app/commons/shipping-labels/AwbReport";
import { TUTORIALS_PATH } from "app/commons/tutorials/Tutorials";
import {
  AddAwbsDialog,
  type AddAwbsInput,
} from "app/frontend/awb-report/components/AddAwbsDialog";
import {
  AwbReportTable,
  type AwbTableKind,
} from "app/frontend/awb-report/components/AwbReportTable";
import { ConfirmDialog } from "app/frontend/core/components/ConfirmDialog";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";
import {
  readErrorMessage,
  readFileName,
  saveBlob,
} from "app/frontend/core/utils/download";

const XLSX_CONTENT_TYPE_PART = "spreadsheetml";

/**
 * The month's AWBs in three tables (used, cancelled, unrecognised courier),
 * downloadable as Excel. The month lives in the URL (`?month=YYYY-MM`) and
 * defaults to the current one, by the shop's clock. See
 * docs/awb-report-plan.md.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const months = listRecentMonths(new Date());
  const month =
    parseReportMonth(
      new URL(request.url).searchParams.get(REPORT_MONTH_PARAM),
    ) ?? months[0];
  const [rows, syncedAt] = await Promise.all([
    ShippingLabelRepository.listIssuedIn(month),
    ShippingLabelRepository.getSyncedAt(month),
  ]);

  return {
    month,
    // an older month from a saved link still shows in the picker
    months: months.includes(month) ? months : [month, ...months],
    tables: splitAwbReport(rows),
    syncedAt: syncedAt?.toISOString() ?? null,
    shopAdminUrl: ShopifyUtils.getShopAdminUrl(session.shop),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  return handleAwbReportAction(
    admin,
    ShopifyUtils.getShopAdminUrl(session.shop),
    await request.formData(),
  );
};

const TABLES: {
  kind: AwbTableKind;
  key: "used" | "cancelled" | "unknownCourier";
  heading:
    | "awbReport.usedHeading"
    | "awbReport.cancelledHeading"
    | "awbReport.unknownHeading";
  hint?: "awbReport.cancelledHint" | "awbReport.unknownHint";
  /** Hidden while empty. */
  hideWhenEmpty?: boolean;
}[] = [
  { kind: "used", key: "used", heading: "awbReport.usedHeading" },
  {
    kind: "cancelled",
    key: "cancelled",
    heading: "awbReport.cancelledHeading",
    hint: "awbReport.cancelledHint",
  },
  {
    kind: "unknown",
    key: "unknownCourier",
    heading: "awbReport.unknownHeading",
    hint: "awbReport.unknownHint",
    hideWhenEmpty: true,
  },
];

export default function AwbReportRoute() {
  const { month, months, tables, syncedAt, shopAdminUrl } =
    useLoaderData<typeof loader>();
  const { locale, t } = useI18n();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const [, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<AwbReportActionResponse>();
  const [busyIntent, setBusyIntent] = useState<AwbReportIntent | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [addError, setAddError] = useState<{
    error: string;
    lineErrors: string[];
  } | null>(null);

  const isLoading = navigation.state === "loading";
  const isBusy = fetcher.state !== "idle";
  const monthName = formatReportMonth(month, locale);

  useEffect(() => {
    const response = fetcher.data;
    if (!response || fetcher.state !== "idle") return;
    setBusyIntent(null);

    if (!response.ok) {
      // the add dialog shows its own errors
      if (response.intent === AWB_REPORT_INTENT.addByHand) {
        setAddError({
          error: response.error,
          lineErrors: response.lineErrors ?? [],
        });
      } else {
        shopify.toast.show(response.error, { isError: true, duration: 8000 });
      }
      return;
    }
    shopify.toast.show(
      response.notice
        ? `${response.message} ${response.notice}`
        : response.message,
      { duration: response.notice ? 10000 : 6000 },
    );
    if (response.intent === AWB_REPORT_INTENT.addByHand) setIsAddOpen(false);
    if (response.intent === AWB_REPORT_INTENT.delete) setToDelete(null);
  }, [fetcher.data, fetcher.state, shopify]);

  function submit(
    intent: AwbReportIntent,
    fields: Record<string, string> = {},
  ) {
    const formData = new FormData();
    formData.append(AWB_REPORT_FIELDS.intent, intent);
    formData.append(REPORT_MONTH_PARAM, month);
    formData.append(LOCALE_PARAM, locale);
    Object.entries(fields).forEach(([name, value]) =>
      formData.append(name, value),
    );
    setBusyIntent(intent);
    fetcher.submit(formData, { method: "post" });
  }

  function handleMonthChange(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    setDownloadError(null);
    setSearchParams({ [REPORT_MONTH_PARAM]: value });
  }

  function handleAdd(input: AddAwbsInput) {
    setAddError(null);
    submit(AWB_REPORT_INTENT.addByHand, {
      [AWB_REPORT_FIELDS.status]: input.status,
      [AWB_REPORT_FIELDS.day]: input.day,
      [AWB_REPORT_FIELDS.awbs]: input.awbs,
      [AWB_REPORT_FIELDS.note]: input.note,
    });
  }

  async function handleDownload() {
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const formData = new FormData();
      formData.append(REPORT_MONTH_PARAM, month);
      formData.append(LOCALE_PARAM, locale);

      const token = await shopify.idToken();
      const response = await fetch(AWB_REPORT_XLSX_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const contentType = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !contentType.includes(XLSX_CONTENT_TYPE_PART)) {
        throw new Error(await readErrorMessage(response));
      }

      saveBlob(
        await response.blob(),
        readFileName(response.headers.get("Content-Disposition")) ??
          `${month}.xlsx`,
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDownloading(false);
    }
  }

  // today when looking at the current month, else its first day
  const today = toShopDay(new Date());
  const defaultDay = toShopMonth(new Date()) === month ? today : `${month}-01`;

  return (
    <s-page heading={t("awbReport.heading")} inlineSize="large">
      <s-stack direction="block" gap="base">
        <s-section>
          <s-stack direction="block" gap="base">
            <s-paragraph>
              {t("awbReport.intro")}{" "}
              <s-link href={TUTORIALS_PATH}>
                {t("awbReport.tutorialsLink")}
              </s-link>
            </s-paragraph>
            <s-box maxInlineSize="240px">
              <s-select
                label={t("awbReport.month")}
                value={month}
                onChange={handleMonthChange}
                {...(isLoading ? { disabled: true } : {})}
              >
                {months.map((value) => (
                  <s-option key={value} value={value}>
                    {formatReportMonth(value, locale)}
                  </s-option>
                ))}
              </s-select>
            </s-box>
            <s-text color="subdued">
              {syncedAt
                ? t("awbReport.syncedAt", {
                    time: new Intl.DateTimeFormat(INTL_LOCALE[locale], {
                      timeZone: SHOP_TIME_ZONE,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(syncedAt)),
                  })
                : t("awbReport.neverSynced")}
            </s-text>
            <s-stack direction="inline" gap="base">
              <s-button
                variant="primary"
                onClick={handleDownload}
                {...(isDownloading ? { loading: true } : {})}
                {...(isLoading ? { disabled: true } : {})}
              >
                {t("awbReport.downloadExcel")}
              </s-button>
              <s-button
                onClick={() => submit(AWB_REPORT_INTENT.refresh)}
                {...(busyIntent === AWB_REPORT_INTENT.refresh
                  ? { loading: true }
                  : {})}
                {...(isLoading || isBusy ? { disabled: true } : {})}
              >
                {t("awbReport.refresh")}
              </s-button>
              <s-button
                onClick={() => {
                  setAddError(null);
                  setIsAddOpen(true);
                }}
                {...(isLoading || isBusy ? { disabled: true } : {})}
              >
                {t("awbReport.addByHand")}
              </s-button>
            </s-stack>
            {downloadError ? (
              <s-banner tone="critical">{downloadError}</s-banner>
            ) : null}
          </s-stack>
        </s-section>

        {TABLES.map((table) => {
          const rows = tables[table.key];
          if (table.hideWhenEmpty && rows.length === 0) return null;

          return (
            <s-section
              key={table.kind}
              heading={`${t(table.heading)} · ${t("awbReport.count", { count: rows.length })}`}
            >
              <s-stack direction="block" gap="base">
                {table.hint && rows.length > 0 ? (
                  <s-text color="subdued">{t(table.hint)}</s-text>
                ) : null}
                {rows.length === 0 ? (
                  <s-text color="subdued">
                    {t("awbReport.emptyTable", { month: monthName })}
                  </s-text>
                ) : (
                  <AwbReportTable
                    kind={table.kind}
                    rows={rows}
                    shopAdminUrl={shopAdminUrl}
                    locale={locale}
                    t={t}
                    onDelete={setToDelete}
                  />
                )}
              </s-stack>
            </s-section>
          );
        })}
      </s-stack>

      <AddAwbsDialog
        isOpen={isAddOpen}
        defaultDay={defaultDay}
        isBusy={busyIntent === AWB_REPORT_INTENT.addByHand}
        error={addError?.error ?? null}
        lineErrors={addError?.lineErrors ?? []}
        onSubmit={handleAdd}
        onCancel={() => setIsAddOpen(false)}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        title={t("awbReport.deleteTitle", { awb: toDelete ?? "" })}
        confirmLabel={t("awbReport.delete")}
        cancelLabel={t("awbReport.cancel")}
        isConfirmDisabled={isBusy}
        onConfirm={() =>
          toDelete &&
          submit(AWB_REPORT_INTENT.delete, {
            [AWB_REPORT_FIELDS.trackingNumber]: toDelete,
          })
        }
        onCancel={() => setToDelete(null)}
      >
        <p>{t("awbReport.deleteBody")}</p>
      </ConfirmDialog>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
