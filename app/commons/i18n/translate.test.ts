import { describe, expect, it } from "vitest";
import { resolveLocale } from "./Locale";
import { createTranslator, translateShopifyEnum } from "./translate";
import { en, ro } from "./translations";

describe("resolveLocale", () => {
  it("reads Romanian in any of Shopify's spellings and falls back to English", () => {
    expect(resolveLocale("ro")).toBe("ro");
    expect(resolveLocale("ro-RO")).toBe("ro");
    expect(resolveLocale("RO_ro")).toBe("ro");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });
});

describe("createTranslator", () => {
  it("fills in params", () => {
    expect(
      createTranslator("ro")("pagination.pageOf", { current: 2, total: 7 }),
    ).toBe("Pagina 2 din 7");
  });

  it("picks the Romanian plural form, including 'de' from 20 up", () => {
    const t = createTranslator("ro");
    expect(t("table.itemCount", { count: 1 })).toBe("1 articol");
    expect(t("table.itemCount", { count: 3 })).toBe("3 articole");
    expect(t("table.itemCount", { count: 25 })).toBe("25 de articole");
  });

  it("picks the English plural form", () => {
    const t = createTranslator("en");
    expect(t("table.itemCount", { count: 1 })).toBe("1 item");
    expect(t("table.itemCount", { count: 2 })).toBe("2 items");
  });

  it("translates Shopify values it knows and formats the rest", () => {
    const t = createTranslator("ro");
    expect(translateShopifyEnum(t, "financialStatus", "PAID")).toBe("Plătită");
    expect(translateShopifyEnum(t, "financialStatus", "SOMETHING_NEW")).toBe(
      "Something new",
    );
  });

  it("has a Romanian text for every English one, with the same placeholders", () => {
    const placeholders = (entry: unknown) =>
      [...JSON.stringify(entry).matchAll(/\{(\w+)\}/g)]
        .map((match) => match[1])
        .filter((name, index, all) => all.indexOf(name) === index)
        .sort();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ro[key]), key).toEqual(placeholders(en[key]));
    }
  });
});
