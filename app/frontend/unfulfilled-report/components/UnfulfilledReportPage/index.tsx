import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFetcher, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import "app/frontend/unfulfilled-report/components/UnfulfilledReportPage/styles.scss";
import { INTL_LOCALE, LOCALE_PARAM } from "app/commons/i18n/Locale";
import type { TranslationKey } from "app/commons/i18n/translations";
import {
  formatOrderIntervalScope,
  ORDER_INTERVAL_PARAMS,
  orderIntervalToSearchParams,
  parseOrderInterval,
  type OrderInterval,
} from "app/commons/unfulfilled-report/OrderInterval";
import {
  REPORT_SECTIONS,
  RESULT_ID_PARAM,
  UNFULFILLED_REPORT_DATA_PATH,
  UNFULFILLED_REPORT_PDF_PATH,
  type ReportSection,
  type ReportSectionKey,
  type UnfulfilledReportResponse,
} from "app/commons/unfulfilled-report/UnfulfilledReport";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

const SECTION_TITLES: Record<ReportSectionKey, TranslationKey> = {
  delivery: "report.delivery",
  pickup: "report.pickup",
};

const FALLBACK_PDF_NAME = "report.pdf";

/**
 * What is left to fulfil, per product variant, for delivery and for pickup,
 * with the orders each covers; downloadable as a PDF.
 *
 * The interval lives in the URL (`?from=&to=`), so a reload keeps it. The
 * data loads after the page renders: reading every open order from Shopify
 * can take a while.
 */
export function UnfulfilledReportPage() {
  const { locale, t } = useI18n();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();

  const fromParam = searchParams.get(ORDER_INTERVAL_PARAMS.from);
  const toParam = searchParams.get(ORDER_INTERVAL_PARAMS.to);
  const parsedInterval = parseOrderInterval(fromParam, toParam);
  const interval: OrderInterval = parsedInterval.ok
    ? parsedInterval.interval
    : { from: null, to: null };

  // the form remounts with the URL's values after "Show all" or a reload
  const [formKey, setFormKey] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const dataFetcher = useFetcher<UnfulfilledReportResponse>();
  const loadRef = useRef(dataFetcher.load);
  loadRef.current = dataFetcher.load;

  const intervalQuery = orderIntervalToSearchParams(interval).toString();
  const loadReport = () => {
    const params = new URLSearchParams(intervalQuery);
    params.set(LOCALE_PARAM, locale);
    loadRef.current(`${UNFULFILLED_REPORT_DATA_PATH}?${params}`);
  };

  useEffect(() => {
    setDownloadError(null);
    loadReport();
    // reload only when the interval changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalQuery]);

  const isLoading = dataFetcher.state !== "idle" || !dataFetcher.data;
  const response = isLoading ? null : dataFetcher.data;
  const report = response?.ok ? response.report : null;

  function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = parseOrderInterval(
      String(formData.get(ORDER_INTERVAL_PARAMS.from) ?? ""),
      String(formData.get(ORDER_INTERVAL_PARAMS.to) ?? ""),
    );

    if (!parsed.ok) {
      setFormError(t(parsed.error));
      return;
    }

    setFormError(null);
    const nextQuery = orderIntervalToSearchParams(parsed.interval);
    if (nextQuery.toString() === intervalQuery) {
      // same interval: the user wants fresh numbers
      loadReport();
    } else {
      setSearchParams(nextQuery);
    }
  }

  function handleShowAll() {
    setFormError(null);
    setFormKey((key) => key + 1);
    if (intervalQuery) setSearchParams(new URLSearchParams());
    else loadReport();
  }

  async function handleDownload() {
    if (!response?.ok) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const formData = new FormData();
      formData.append(RESULT_ID_PARAM, response.resultId);
      for (const [name, value] of new URLSearchParams(intervalQuery)) {
        formData.append(name, value);
      }
      formData.append(LOCALE_PARAM, locale);
      formData.append(
        "timeZone",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );

      const token = await shopify.idToken();
      const pdfResponse = await fetch(UNFULFILLED_REPORT_PDF_PATH, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const contentType = pdfResponse.headers.get("Content-Type") ?? "";
      if (!pdfResponse.ok || !contentType.includes("application/pdf")) {
        throw new Error(await readErrorMessage(pdfResponse));
      }

      saveBlob(
        await pdfResponse.blob(),
        readFileName(pdfResponse.headers.get("Content-Disposition")) ??
          FALLBACK_PDF_NAME,
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <s-page heading={t("report.heading")}>
      <s-stack direction="block" gap="base">
        <s-section heading={t("report.intervalHeading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph>{t("report.intro")}</s-paragraph>

            <form
              key={`${formKey}:${intervalQuery}`}
              className="report-page__interval-form"
              onSubmit={handleApply}
              noValidate
            >
              <div className="report-page__interval-fields">
                <s-number-field
                  label={t("report.fromOrder")}
                  name={ORDER_INTERVAL_PARAMS.from}
                  value={fromParam ?? ""}
                  inputMode="numeric"
                  min={1}
                  step={1}
                />
                <s-number-field
                  label={t("report.toOrder")}
                  name={ORDER_INTERVAL_PARAMS.to}
                  value={toParam ?? ""}
                  inputMode="numeric"
                  min={1}
                  step={1}
                />
              </div>

              <s-text color="subdued">{t("report.intervalHint")}</s-text>

              {formError || !parsedInterval.ok ? (
                <s-banner tone="critical">
                  {formError ??
                    (!parsedInterval.ok ? t(parsedInterval.error) : null)}
                </s-banner>
              ) : null}

              <div className="report-page__actions">
                <s-button type="submit" variant="secondary">
                  {t("report.apply")}
                </s-button>
                <s-button
                  variant="tertiary"
                  onClick={handleShowAll}
                  {...(isLoading ? { disabled: true } : {})}
                >
                  {t("report.showAll")}
                </s-button>
              </div>
            </form>
          </s-stack>
        </s-section>

        <div className="report-page__toolbar">
          <div className="report-page__scope">
            <s-text type="strong">
              {formatOrderIntervalScope(interval, t)}
            </s-text>
            {report ? (
              <s-text color="subdued">
                {t("report.generatedAt", {
                  date: new Intl.DateTimeFormat(INTL_LOCALE[locale], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(report.generatedAt)),
                })}
              </s-text>
            ) : null}
          </div>

          <div className="report-page__actions">
            <s-button
              variant="secondary"
              onClick={loadReport}
              {...(isLoading ? { disabled: true } : {})}
            >
              {t("report.refresh")}
            </s-button>
            <s-button
              variant="primary"
              onClick={handleDownload}
              {...(isDownloading ? { loading: true } : {})}
              {...(!report ? { disabled: true } : {})}
            >
              {t("report.downloadPdf")}
            </s-button>
          </div>
        </div>

        {downloadError ? (
          <s-banner tone="critical">{downloadError}</s-banner>
        ) : null}

        {isLoading ? (
          <s-section>
            <div className="report-page__loading">
              <s-spinner accessibilityLabel={t("report.loading")} />
              <s-text color="subdued">{t("report.loading")}</s-text>
            </div>
          </s-section>
        ) : null}

        {response && !response.ok ? (
          <s-banner tone="critical">{response.error}</s-banner>
        ) : null}

        {report
          ? REPORT_SECTIONS.map((key) => (
              <ReportSectionView
                key={key}
                sectionKey={key}
                title={t(SECTION_TITLES[key])}
                section={report[key]}
              />
            ))
          : null}
      </s-stack>
    </s-page>
  );
}

/** Coloured like the PDF: blue for delivery, orange for pickup. */
function ReportSectionView({
  sectionKey,
  title,
  section,
}: {
  sectionKey: ReportSectionKey;
  title: string;
  section: ReportSection;
}) {
  const { t } = useI18n();
  const orderCount = section.orderNames.length;

  return (
    <s-section>
      <div className={`report-page__section --${sectionKey}`}>
        <div className="report-page__section-header">
          <h2 className="report-page__section-title">{title}</h2>
          {orderCount > 0 ? (
            <span className="report-page__section-count">
              {t("report.orderCount", { count: orderCount })}
            </span>
          ) : null}
        </div>

        {section.rows.length === 0 ? (
          <s-text color="subdued">{t("report.noOrders")}</s-text>
        ) : (
          <>
            {/* a plain table: two columns fit a phone, so it never turns into a list */}
            <table className="report-page__table">
              <thead>
                <tr>
                  <th scope="col">{t("report.product")}</th>
                  <th scope="col" className="--quantity">
                    {t("report.quantity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.name}</td>
                    <td className="--quantity">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t("report.total")}</th>
                  <td className="--quantity">{section.totalQuantity}</td>
                </tr>
              </tfoot>
            </table>

            <div className="report-page__orders">
              <h3 className="report-page__orders-title">
                {t("report.orders", { count: orderCount })}
              </h3>
              <p className="report-page__order-ranges">
                {section.orderRanges.join(", ")}
              </p>
            </div>
          </>
        )}
      </div>
    </s-section>
  );
}

/** The server answers JSON `{ error }`, but a proxy or crash page might not. */
async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  }
  return (await response.text()) || `HTTP ${response.status}`;
}

/** `attachment; filename="estimari-neexecutate_1201-1206.pdf"` → the name. */
function readFileName(contentDisposition: string | null): string | null {
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition ?? "");
  return match?.[1] ?? null;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // give the browser time to start the download before freeing it
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
