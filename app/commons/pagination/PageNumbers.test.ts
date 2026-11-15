import { describe, expect, it } from "vitest";
import {
  buildPageNumbers,
  formatPageNumbers,
  formatShownRange,
  parsePageParam,
  type PageNumbers,
} from "./PageNumbers";

const pageNumbers = (overrides: Partial<PageNumbers>): PageNumbers => ({
  currentPage: 1,
  pageSize: 50,
  totalCount: 312,
  totalPages: 7,
  isTotalAtLeast: false,
  ...overrides,
});

describe("buildPageNumbers", () => {
  it("rounds the page count up", () => {
    expect(
      buildPageNumbers({
        pageParam: "2",
        pageSize: 50,
        count: { count: 101, isAtLeast: false },
      }),
    ).toEqual({
      currentPage: 2,
      pageSize: 50,
      totalCount: 101,
      totalPages: 3,
      isTotalAtLeast: false,
    });
  });

  it("shows one page for an empty tab", () => {
    expect(
      buildPageNumbers({
        pageParam: null,
        pageSize: 50,
        count: { count: 0, isAtLeast: false },
      }).totalPages,
    ).toBe(1);
  });

  it("never shows a current page past the last one", () => {
    expect(
      buildPageNumbers({
        pageParam: "7",
        pageSize: 50,
        count: { count: 120, isAtLeast: false },
      }).currentPage,
    ).toBe(3);
  });

  it("leaves the total unknown when the count failed", () => {
    expect(
      buildPageNumbers({ pageParam: "4", pageSize: 50, count: null }),
    ).toEqual({
      currentPage: 4,
      pageSize: 50,
      totalCount: null,
      totalPages: null,
      isTotalAtLeast: false,
    });
  });
});

describe("parsePageParam", () => {
  it("falls back to page 1 for anything that is not a positive whole number", () => {
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
    expect(parsePageParam("2.5")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("12")).toBe(12);
  });
});

describe("formatPageNumbers", () => {
  it("reads 'Page X of Y', with a + when Shopify stopped counting", () => {
    expect(
      formatPageNumbers(pageNumbers({ currentPage: 2, totalPages: 7 })),
    ).toBe("Page 2 of 7");
    expect(
      formatPageNumbers(
        pageNumbers({ currentPage: 2, totalPages: 200, isTotalAtLeast: true }),
      ),
    ).toBe("Page 2 of 200+");
    expect(
      formatPageNumbers(pageNumbers({ currentPage: 2, totalPages: null })),
    ).toBe("Page 2");
  });
});

describe("formatShownRange", () => {
  it("says which orders of the tab this page shows", () => {
    expect(formatShownRange(pageNumbers({ currentPage: 2 }), 50)).toBe(
      "Showing 51–100 of 312 orders",
    );
    expect(formatShownRange(pageNumbers({ currentPage: 7 }), 12)).toBe(
      "Showing 301–312 of 312 orders",
    );
  });

  it("handles one order, no orders, an open-ended total and an unknown total", () => {
    expect(formatShownRange(pageNumbers({ totalCount: 1 }), 1)).toBe(
      "Showing 1 of 1 orders",
    );
    expect(formatShownRange(pageNumbers({}), 0)).toBe("No orders");
    expect(
      formatShownRange(
        pageNumbers({ totalCount: 10000, isTotalAtLeast: true }),
        50,
      ),
    ).toBe("Showing 1–50 of 10000+ orders");
    expect(formatShownRange(pageNumbers({ totalCount: null }), 50)).toBe(
      "Showing 1–50 (50 on this page)",
    );
  });
});
