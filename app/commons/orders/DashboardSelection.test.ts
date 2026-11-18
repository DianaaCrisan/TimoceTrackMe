import { describe, expect, it } from "vitest";
import {
  countSelected,
  getSelectAllBlocker,
  headerCheckboxState,
  isOrderSelected,
  NO_SELECTION,
  toggleAll,
  toggleOrder,
  toOrderSelection,
  type DashboardSelection,
} from "./DashboardSelection";

const ALL: DashboardSelection = { kind: "all", excluded: [] };

describe("DashboardSelection", () => {
  it("selects every order in the tab from the header checkbox", () => {
    expect(toggleAll(NO_SELECTION)).toEqual(ALL);
    expect(headerCheckboxState(ALL)).toBe("checked");
    expect(isOrderSelected(ALL, "on-another-page")).toBe(true);
    expect(countSelected(ALL, 45)).toBe(45);
  });

  it("clears the selection when everything is selected", () => {
    expect(toggleAll(ALL)).toEqual(NO_SELECTION);
  });

  it("selects every order when only some are ticked", () => {
    const some: DashboardSelection = { kind: "ids", ids: ["a"] };
    expect(headerCheckboxState(some)).toBe("indeterminate");
    expect(toggleAll(some)).toEqual(ALL);
  });

  it("keeps 'all' when an order is unticked, minus that order", () => {
    const selection = toggleOrder(ALL, "b", { tabCount: 45 });

    expect(selection).toEqual({ kind: "all", excluded: ["b"] });
    expect(isOrderSelected(selection, "b")).toBe(false);
    expect(isOrderSelected(selection, "c")).toBe(true);
    expect(countSelected(selection, 45)).toBe(44);
    expect(headerCheckboxState(selection)).toBe("indeterminate");
    // the header then selects everything again
    expect(toggleAll(selection)).toEqual(ALL);
  });

  it("ticks an unticked order back", () => {
    expect(
      toggleOrder({ kind: "all", excluded: ["b"] }, "b", { tabCount: 45 }),
    ).toEqual(ALL);
  });

  it("ends up empty once every order is unticked", () => {
    expect(toggleOrder({ kind: "all", excluded: ["a"] }, "b", { tabCount: 2 })).toEqual(
      NO_SELECTION,
    );
  });

  it("ticks orders by hand, up to the job limit", () => {
    let selection = toggleOrder(NO_SELECTION, "a", { tabCount: 3, maxIds: 2 });
    selection = toggleOrder(selection, "b", { tabCount: 3, maxIds: 2 });
    expect(toggleOrder(selection, "c", { tabCount: 3, maxIds: 2 })).toEqual(
      selection,
    );
    expect(selection).toEqual({ kind: "ids", ids: ["a", "b"] });

    selection = toggleOrder(selection, "a", { tabCount: 3 });
    selection = toggleOrder(selection, "b", { tabCount: 3 });
    expect(selection).toEqual(NO_SELECTION);
  });

  it("is sent as the tab with its exceptions, or as the ticked IDs", () => {
    expect(
      toOrderSelection({ kind: "all", excluded: ["b"] }, "unprinted", "pack-1"),
    ).toEqual({
      mode: "filter",
      filter: "unprinted",
      excludedOrderIds: ["b"],
      packId: "pack-1",
    });
    expect(toOrderSelection(ALL, "not_in_pack", null)).toEqual({
      mode: "filter",
      filter: "not_in_pack",
    });
    expect(
      toOrderSelection({ kind: "ids", ids: ["a"] }, "all", "pack-1"),
    ).toEqual({ mode: "ids", orderIds: ["a"], packId: "pack-1" });
    expect(toOrderSelection(NO_SELECTION, "all", null)).toBeNull();
  });

  it("offers select all only for a known count one action can take", () => {
    expect(getSelectAllBlocker({ count: 45, isAtLeast: false })).toBeNull();
    expect(getSelectAllBlocker(null)).toBe("unknown");
    expect(getSelectAllBlocker({ count: 10_000, isAtLeast: true })).toBe(
      "tooMany",
    );
    expect(getSelectAllBlocker({ count: 1001, isAtLeast: false }, 1000)).toBe(
      "tooMany",
    );
    expect(getSelectAllBlocker({ count: 0, isAtLeast: false })).toBe("empty");
  });
});
