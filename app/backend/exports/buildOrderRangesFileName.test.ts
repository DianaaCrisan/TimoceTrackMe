import { describe, expect, it } from "vitest";
import { buildOrderRangesFileName } from "./buildOrderRangesFileName";

const build = (orderNames: string[]) =>
  buildOrderRangesFileName({
    baseName: "etichete-livrare",
    orderNames,
    timestamp: "9-nov-2026_14-05",
    extension: "pdf",
  });

describe("buildOrderRangesFileName", () => {
  it("names the file after the compact order list", () => {
    expect(build(["#1203", "#1201", "#1202", "#1209"])).toBe(
      "etichete-livrare_1201-1203_1209.pdf",
    );
  });

  it("uses a single order as it is", () => {
    expect(build(["#1201"])).toBe("etichete-livrare_1201.pdf");
  });

  it("falls back to the timestamp when the list is too long", () => {
    const scattered = Array.from({ length: 20 }, (_, i) => `#${1000 + i * 2}`);
    expect(build(scattered)).toBe("etichete-livrare_9-nov-2026_14-05.pdf");
  });

  it("falls back to the timestamp without orders", () => {
    expect(build([])).toBe("etichete-livrare_9-nov-2026_14-05.pdf");
  });

  it("keeps only file-safe characters", () => {
    expect(build(["#1201-B", "Comandă 7"])).toMatch(/^[A-Za-z0-9_.-]+$/);
  });
});
