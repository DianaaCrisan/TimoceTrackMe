import { describe, expect, it } from "vitest";
import { createTranslator } from "../i18n/translate";
import {
  formatOrderIntervalScope,
  getOrderNumber,
  isOrderInInterval,
  orderIntervalToSearchParams,
  parseOrderInterval,
} from "./OrderInterval";

describe("parseOrderInterval", () => {
  it("leaves empty ends open", () => {
    expect(parseOrderInterval(null, "")).toEqual({
      ok: true,
      interval: { from: null, to: null },
    });
  });

  it("reads plain numbers and numbers with #", () => {
    expect(parseOrderInterval(" 1200 ", "#1250")).toEqual({
      ok: true,
      interval: { from: 1200, to: 1250 },
    });
  });

  it("refuses anything that is not a whole number", () => {
    expect(parseOrderInterval("12.5", null)).toEqual({
      ok: false,
      error: "report.invalidNumber",
    });
    expect(parseOrderInterval(null, "abc")).toEqual({
      ok: false,
      error: "report.invalidNumber",
    });
  });

  it("refuses a start past the end", () => {
    expect(parseOrderInterval("1300", "1200")).toEqual({
      ok: false,
      error: "report.invalidInterval",
    });
  });
});

describe("isOrderInInterval", () => {
  it("includes both ends", () => {
    const interval = { from: 1200, to: 1250 };
    expect(isOrderInInterval("#1200", interval)).toBe(true);
    expect(isOrderInInterval("#1250", interval)).toBe(true);
    expect(isOrderInInterval("#1199", interval)).toBe(false);
    expect(isOrderInInterval("#1251", interval)).toBe(false);
  });

  it("handles open ends", () => {
    expect(isOrderInInterval("#5", { from: null, to: 10 })).toBe(true);
    expect(isOrderInInterval("#50", { from: 10, to: null })).toBe(true);
  });

  it("keeps every order, numbered or not, without an interval", () => {
    expect(isOrderInInterval("Draft", { from: null, to: null })).toBe(true);
  });

  it("leaves out orders without a number once an interval is set", () => {
    expect(isOrderInInterval("Draft", { from: 1, to: null })).toBe(false);
  });
});

describe("getOrderNumber", () => {
  it("reads the number in an order name", () => {
    expect(getOrderNumber("#1250")).toBe(1250);
    expect(getOrderNumber("TM1250-B")).toBe(1250);
    expect(getOrderNumber("no number")).toBeNull();
  });
});

describe("formatOrderIntervalScope", () => {
  const t = createTranslator("en");

  it("describes every kind of interval", () => {
    expect(formatOrderIntervalScope({ from: null, to: null }, t)).toBe(
      "All unfulfilled orders",
    );
    expect(formatOrderIntervalScope({ from: 1, to: 9 }, t)).toBe(
      "Orders #1 – #9",
    );
    expect(formatOrderIntervalScope({ from: 1, to: null }, t)).toBe(
      "Orders from #1",
    );
    expect(formatOrderIntervalScope({ from: null, to: 9 }, t)).toBe(
      "Orders up to #9",
    );
  });
});

describe("orderIntervalToSearchParams", () => {
  it("keeps only the ends that are set", () => {
    expect(
      orderIntervalToSearchParams({ from: 1200, to: null }).toString(),
    ).toBe("from=1200");
  });
});
