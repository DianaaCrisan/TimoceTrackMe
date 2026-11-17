import { describe, expect, it } from "vitest";
import { parseHandAddedAwbs } from "./parseHandAddedAwbs";

describe("parseHandAddedAwbs", () => {
  it("reads one AWB per line, with or without an order", () => {
    expect(
      parseHandAddedAwbs("6256347789 1022\n\n  6256347790\t#1023 \n6256347791"),
    ).toEqual({
      lines: [
        { line: 1, trackingNumber: "6256347789", orderName: "#1022" },
        { line: 3, trackingNumber: "6256347790", orderName: "#1023" },
        { line: 4, trackingNumber: "6256347791", orderName: null },
      ],
      errors: [],
    });
  });

  it("takes commas and semicolons from a pasted sheet", () => {
    expect(
      parseHandAddedAwbs("6256347789,1022\r\n6256347790;1023").lines,
    ).toEqual([
      { line: 1, trackingNumber: "6256347789", orderName: "#1022" },
      { line: 2, trackingNumber: "6256347790", orderName: "#1023" },
    ]);
  });

  it("explains each line it cannot read", () => {
    expect(
      parseHandAddedAwbs(
        "62/56\n6256347789 1022 extra\n6256347789 #10?2\n6256347789\n6256347789",
      ).errors,
    ).toEqual([
      { line: 1, text: "62/56", reason: "badAwb" },
      { line: 2, text: "6256347789 1022 extra", reason: "tooManyParts" },
      { line: 3, text: "6256347789 #10?2", reason: "badOrder" },
      { line: 5, text: "6256347789", reason: "duplicate" },
    ]);
  });
});
