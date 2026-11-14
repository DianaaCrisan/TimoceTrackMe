import { PageInfo } from "app/types/admin.types";
import { Link } from "react-router";
import {
  formatPageNumbers,
  PAGE_PARAM,
  type PageNumbers,
} from "app/commons/pagination/PageNumbers";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

type CursorPaginationProps = {
  basePath: string;
  pageInfo: PageInfo;
  queryParams?: Record<string, string>;
  pageNumbers?: PageNumbers;
};

export function CursorPagination({
  basePath,
  pageInfo,
  queryParams = {},
  pageNumbers,
}: CursorPaginationProps) {
  const { t } = useI18n();

  const buildUrl = (
    cursorParam: "before" | "after",
    cursorValue: string | null,
  ) => {
    if (!cursorValue) return null;

    const searchParams = new URLSearchParams(queryParams);
    searchParams.delete("before");
    searchParams.delete("after");
    searchParams.set(cursorParam, cursorValue);

    if (pageNumbers) {
      const targetPage =
        cursorParam === "after"
          ? pageNumbers.currentPage + 1
          : Math.max(1, pageNumbers.currentPage - 1);
      searchParams.set(PAGE_PARAM, String(targetPage));
    }

    return `${basePath}?${searchParams.toString()}`;
  };

  const previousUrl =
    pageInfo.hasPreviousPage && pageInfo.startCursor
      ? buildUrl("before", pageInfo.startCursor)
      : null;

  const nextUrl =
    pageInfo.hasNextPage && pageInfo.endCursor
      ? buildUrl("after", pageInfo.endCursor)
      : null;

  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      <div>
        {previousUrl ? (
          <Link to={previousUrl}>
            <s-button>{t("pagination.previous")}</s-button>
          </Link>
        ) : (
          <s-button disabled>{t("pagination.previous")}</s-button>
        )}
      </div>

      {pageNumbers ? (
        <s-text>{formatPageNumbers(pageNumbers, t)}</s-text>
      ) : null}

      <div>
        {nextUrl ? (
          <Link to={nextUrl}>
            <s-button>{t("pagination.next")}</s-button>
          </Link>
        ) : (
          <s-button disabled>{t("pagination.next")}</s-button>
        )}
      </div>
    </s-stack>
  );
}
