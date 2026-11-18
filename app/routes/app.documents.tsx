import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigation,
  useRevalidator,
} from "react-router";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { listDocuments } from "app/backend/documents/listDocuments.server";
import {
  DOCUMENT_CATEGORY_IDS,
  DOCUMENT_CATEGORY_LABELS,
  documentPageParam,
  formatFileSize,
  type DocumentCategoryView,
} from "app/commons/documents/Documents";
import { SHOP_TIME_ZONE } from "app/commons/packs/FulfillmentPack";
import { INTL_LOCALE, type Locale } from "app/commons/i18n/Locale";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

/**
 * The documents the app has stored, by category, newest first. Read from S3
 * on every visit: S3 is the only record, so what its lifecycle rule deletes
 * is gone from here too.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);

  const pages = Object.fromEntries(
    DOCUMENT_CATEGORY_IDS.map((id) => [
      id,
      Number(url.searchParams.get(documentPageParam(id))) || 1,
    ]),
  );
  return { categories: await listDocuments(pages) };
};

/**
 * The download links are signed for an hour. The page reloads them before
 * that, so a page left open never offers a link that no longer works.
 */
const LINK_REFRESH_MS = 50 * 60 * 1000;

export default function DocumentsPage() {
  const { categories } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  const { revalidate } = useRevalidator();
  useEffect(() => {
    const timer = setInterval(revalidate, LINK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [revalidate]);

  return (
    <s-page heading={t("documents.heading")}>
      <TitleBar title={t("nav.documents")} />

      <s-section>
        <s-paragraph>{t("documents.intro")}</s-paragraph>
      </s-section>

      {categories.map((category) => (
        <DocumentCategorySection key={category.id} category={category} />
      ))}
    </s-page>
  );
}

function DocumentCategorySection({
  category,
}: {
  category: DocumentCategoryView;
}) {
  const { locale, t } = useI18n();
  const location = useLocation();
  const isLoading = useNavigation().state !== "idle";

  /** This page's URL with the category on another page; the others kept. */
  const pageUrl = (page: number) => {
    const params = new URLSearchParams(location.search);
    params.set(documentPageParam(category.id), String(page));
    return `${location.pathname}?${params}`;
  };

  return (
    <s-section heading={t(DOCUMENT_CATEGORY_LABELS[category.id])}>
      <s-stack direction="block" gap="base">
        {category.error ? (
          <s-banner tone="critical" heading={t("documents.loadFailed")}>
            {category.error.kind === "accessDenied"
              ? t("documents.accessDenied")
              : category.error.message}
          </s-banner>
        ) : category.total === 0 ? (
          <s-text color="subdued">{t("documents.empty")}</s-text>
        ) : (
          <>
            <s-table>
              <s-table-header-row>
                <s-table-header>{t("documents.colStoredAt")}</s-table-header>
                <s-table-header>{t("documents.colOrders")}</s-table-header>
                <s-table-header>{t("documents.colFile")}</s-table-header>
                <s-table-header>{t("documents.colSize")}</s-table-header>
                <s-table-header>{t("documents.colDownload")}</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {category.documents.map((document) => (
                  <s-table-row key={document.key}>
                    <s-table-cell>
                      {formatStoredAt(document.storedAt, locale)}
                    </s-table-cell>
                    <s-table-cell>
                      {document.orders ? (
                        <s-stack direction="block" gap="small-500">
                          <s-text>{document.orders.ranges}</s-text>
                          <s-text color="subdued">
                            {t("documents.orderCount", {
                              count: document.orders.count,
                            })}
                          </s-text>
                        </s-stack>
                      ) : (
                        <s-text color="subdued">
                          {t("documents.ordersNotRecorded")}
                        </s-text>
                      )}
                    </s-table-cell>
                    <s-table-cell>{document.fileName}</s-table-cell>
                    <s-table-cell>
                      {formatFileSize(document.sizeBytes, locale)}
                    </s-table-cell>
                    <s-table-cell>
                      {document.downloadUrl ? (
                        <s-link href={document.downloadUrl} target="_blank">
                          {t("documents.download")}
                        </s-link>
                      ) : (
                        <s-text color="subdued">
                          {t("documents.noLink")}
                        </s-text>
                      )}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>

            {category.pageCount > 1 ? (
              <s-stack direction="inline" gap="base" alignItems="center">
                {category.page > 1 ? (
                  <Link to={pageUrl(category.page - 1)}>
                    ← {t("documents.newer")}
                  </Link>
                ) : null}
                <s-text color="subdued">
                  {t("documents.pageOf", {
                    page: category.page,
                    pageCount: category.pageCount,
                    count: category.total,
                  })}
                </s-text>
                {category.page < category.pageCount ? (
                  <Link to={pageUrl(category.page + 1)}>
                    {t("documents.older")} →
                  </Link>
                ) : null}
                {isLoading ? <s-spinner size="base" /> : null}
              </s-stack>
            ) : null}
          </>
        )}
      </s-stack>
    </s-section>
  );
}

/** "18 nov. 2026, 16:07" in the shop's time zone, like the rest of the app. */
function formatStoredAt(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    timeZone: SHOP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
