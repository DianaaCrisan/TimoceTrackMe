import { describe, expect, it } from "vitest";
import { hasCustomerNote, toCustomerNote } from "./CustomerNote";

describe("toCustomerNote", () => {
  it("keeps the note and the checkout fields the customer filled in", () => {
    expect(
      toCustomerNote("  Please ring twice \n", [
        { key: "Delivery time", value: "after 17:00" },
      ]),
    ).toEqual({
      note: "Please ring twice",
      attributes: [{ key: "Delivery time", value: "after 17:00" }],
    });
  });

  it("drops empty values and hidden app attributes", () => {
    const customerNote = toCustomerNote("   ", [
      { key: "_gclid", value: "abc" },
      { key: "Floor", value: " " },
      { key: "Gift", value: null },
    ]);

    expect(customerNote).toEqual({ note: null, attributes: [] });
    expect(hasCustomerNote(customerNote)).toBe(false);
  });

  it("counts a checkout field alone as a note", () => {
    expect(
      hasCustomerNote(toCustomerNote(null, [{ key: "Floor", value: "3" }])),
    ).toBe(true);
  });
});
