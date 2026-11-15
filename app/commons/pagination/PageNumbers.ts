import { translateEn, type Translate } from "../i18n/translate";

/**
 * "Page 3 of 12" for a cursor-paginated list.
 *
 * Shopify pages by cursor and never says which page a cursor is on, so the
 * current page travels in the URL (`page`) and the total comes from a count.
 */
export type PageNumbers = {
  currentPage: number;
  pageSize: number;
  /** Null when the count failed. */
  totalCount: number | null;
  /** Null when the total is unknown (the count failed). */
  totalPages: number | null;
  /** The count hit Shopify's limit, so there may be more pages. */
  isTotalAtLeast: boolean;
};

export const PAGE_PARAM = "page";

export function parsePageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function buildPageNumbers(args: {
  pageParam: string | null;
  pageSize: number;
  count: { count: number; isAtLeast: boolean } | null;
}): PageNumbers {
  const currentPage = parsePageParam(args.pageParam);

  if (!args.count) {
    return {
      currentPage,
      pageSize: args.pageSize,
      totalCount: null,
      totalPages: null,
      isTotalAtLeast: false,
    };
  }

  const totalPages = Math.max(1, Math.ceil(args.count.count / args.pageSize));
  return {
    // a stale `page` (e.g. after orders left the tab) must not read "7 of 5"
    currentPage: Math.min(currentPage, totalPages),
    pageSize: args.pageSize,
    totalCount: args.count.count,
    totalPages,
    isTotalAtLeast: args.count.isAtLeast,
  };
}

export function formatPageNumbers(
  pageNumbers: PageNumbers,
  t: Translate = translateEn,
): string {
  const { currentPage, totalPages, isTotalAtLeast } = pageNumbers;
  if (totalPages === null) {
    return t("pagination.page", { current: currentPage });
  }
  return t("pagination.pageOf", {
    current: currentPage,
    total: `${totalPages}${isTotalAtLeast ? "+" : ""}`,
  });
}

/** e.g. "Showing 51–100 of 312 orders", for the `shownCount` rows on this page. */
export function formatShownRange(
  pageNumbers: PageNumbers,
  shownCount: number,
  t: Translate = translateEn,
): string {
  if (shownCount === 0) return t("pagination.noOrders");

  const first = (pageNumbers.currentPage - 1) * pageNumbers.pageSize + 1;
  const last = first + shownCount - 1;
  const range = shownCount === 1 ? `${first}` : `${first}–${last}`;

  if (pageNumbers.totalCount === null) {
    return t("pagination.showingOnPage", { range, shown: shownCount });
  }

  return t("pagination.showingOf", {
    range,
    total: `${pageNumbers.totalCount}${pageNumbers.isTotalAtLeast ? "+" : ""}`,
    count: pageNumbers.totalCount,
  });
}
