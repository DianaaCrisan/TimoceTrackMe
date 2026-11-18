import { describe, expect, it } from "vitest";
import {
  decodeOrderListMetadata,
  encodeOrderListMetadata,
} from "./orderListMetadata";

describe("order list metadata", () => {
  it("stores the compact list, like the PDF's first page, and reads it back", () => {
    const metadata = encodeOrderListMetadata([
      "#1201",
      "#1202",
      "#1203",
      "#1209",
      "#1202",
    ]);

    expect(
      Object.values(metadata).every((value) => /^[\x20-\x7E]*$/.test(value)),
    ).toBe(true);
    expect(decodeOrderListMetadata(metadata)).toEqual({
      ranges: "#1201-1203, #1209",
      count: 4,
    });
  });

  it("cuts a very long list at a range and keeps the full count", () => {
    // every other number: no runs, so the list is long
    const names = Array.from({ length: 1000 }, (_, i) => `#${1000 + i * 2}`);
    const metadata = encodeOrderListMetadata(names);
    const list = decodeOrderListMetadata(metadata)!;

    expect(list.count).toBe(1000);
    expect(list.ranges.endsWith(", …")).toBe(true);
    // S3 allows 2 KB of user metadata in all
    const bytes = Object.entries(metadata).reduce(
      (sum, [key, value]) => sum + key.length + value.length,
      0,
    );
    expect(bytes).toBeLessThan(2048);
  });

  it("keeps names outside ASCII readable", () => {
    const list = decodeOrderListMetadata(
      encodeOrderListMetadata(["Comandă-1"]),
    );
    expect(list).toEqual({ ranges: "Comandă-1", count: 1 });
  });

  it("is empty without orders, and null for documents saved without it", () => {
    expect(encodeOrderListMetadata([])).toEqual({});
    expect(decodeOrderListMetadata({})).toBeNull();
    expect(decodeOrderListMetadata(undefined)).toBeNull();
  });
});
