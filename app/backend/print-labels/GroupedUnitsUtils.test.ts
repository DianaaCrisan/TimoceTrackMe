import { describe, expect, it } from "vitest";
import { GroupedUnitsUtils } from "./GroupedUnitsUtils";
import { LineItem } from "./models/LineItem";
import { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LabelUnitKind } from "./models/LabelUnitKind";

function labelUnit(partial: Partial<LabelUnitDetails>): LabelUnitDetails {
  return {
    kind: LabelUnitKind.DELIVERY,
    orderId: "order-1",
    unitId: "unitId-1",
    displayName: "unit",
    labelPDF: Buffer.from("pdf"),
    lineItems: [],
    errors: [],
    ...partial,
  } as LabelUnitDetails;
}

describe("GroupedUnitsUtils.aggregateAndSort", () => {
  it("aggregates quantities and sorts by item key", () => {
    const items: LineItem[] = [
      new LineItem("b", 1, "Cherries - 2kg"),
      new LineItem("a", 1, "Dragon Fruit - 2kg"),
      new LineItem("a", 2, "Dragon Fruit - 2kg"),
    ];

    const out = GroupedUnitsUtils.aggregateAndSort(items);

    expect(out).toEqual([
      new LineItem("a", 3, "Dragon Fruit - 2kg"),
      new LineItem("b", 1, "Cherries - 2kg"),
    ]);
  });

  it("does not mutate input array", () => {
    const items = [
      new LineItem("x", 1, "Avocado - 2kg"),
      new LineItem("x", 2, "Avocado - 2kg"),
    ];
    const copy = JSON.parse(JSON.stringify(items));

    void GroupedUnitsUtils.aggregateAndSort(items);

    expect(items).toEqual(copy);
  });
});

describe("GroupedUnitsUtils.buildKey", () => {
  it("builds deterministic keys from aggregated items", () => {
    const a = GroupedUnitsUtils.aggregateAndSort([
      new LineItem("a", 1, "Dragon Fruit - 2kg"),
      new LineItem("a", 1, "Dragon Fruit - 2kg"),
      new LineItem("b", 1, "Cherries - 2kg"),
    ]);
    const b = GroupedUnitsUtils.aggregateAndSort([
      new LineItem("b", 1, "Cherries - 2kg"),
      new LineItem("a", 2, "Dragon Fruit - 2kg"),
    ]);

    const keyA = GroupedUnitsUtils.buildKey(a);
    const keyB = GroupedUnitsUtils.buildKey(b);

    expect(keyA).toBe("a::2|b::1");
    expect(keyB).toBe("a::2|b::1");
  });

  it("returns empty string for empty item list", () => {
    const key = GroupedUnitsUtils.buildKey([]);
    expect(key).toBe("");
  });

  it("sorts by identifier without any country-of-origin data", () => {
    const a = GroupedUnitsUtils.aggregateAndSort([
      new LineItem("a", 1, "Dragon Fruit - 2kg"),
      new LineItem("b", 1, "Dragon Fruit - 2kg"),
    ]);
    const b = GroupedUnitsUtils.aggregateAndSort([
      new LineItem("b", 1, "Dragon Fruit - 2kg"),
      new LineItem("a", 1, "Dragon Fruit - 2kg"),
    ]);

    const keyA = GroupedUnitsUtils.buildKey(a);
    const keyB = GroupedUnitsUtils.buildKey(b);

    expect(keyA).toBe("a::1|b::1");
    expect(keyB).toBe("a::1|b::1");
  });
});

describe("GroupedUnitsUtils.groupUnitsBySummary", () => {
  it("groups units by identical aggregated item summaries", () => {
    const u1 = labelUnit({
      displayName: "#1194-F4",
      unitId: "2",
      lineItems: [
        new LineItem("a", 1, "Avocado - 2kg"),
        new LineItem("a", 1, "Avocado - 2kg"),
        new LineItem("b", 1, "Dragon Fruit - 2kg"),
      ],
    });

    const u3 = labelUnit({
      displayName: "#1195-F1",
      unitId: "1",
      lineItems: [
        new LineItem("b", 1, "Dragon Fruit - 2kg"),
        new LineItem("a", 2, "Avocado - 2kg"),
      ],
    });

    const u2 = labelUnit({
      displayName: "#2000-F1",
      unitId: "3",
      lineItems: [new LineItem("c", 5, "Cherries - 2kg")],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([u1, u2, u3]);

    expect(groups.map((g) => g.key)).toEqual(["a::2|b::1", "c::5"]);

    expect(groups[0].items).toEqual([
      new LineItem("a", 2, "Avocado - 2kg"),
      new LineItem("b", 1, "Dragon Fruit - 2kg"),
    ]);

    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "#1194-F4",
      "#1195-F1",
    ]);

    expect(groups[1].items).toEqual([new LineItem("c", 5, "Cherries - 2kg")]);

    expect(groups[1].units.map((u) => u.displayName)).toEqual(["#2000-F1"]);
  });

  it("groups units correctly when only non-grouping details differ", () => {
    const u1 = labelUnit({
      displayName: "#1194-F4",
      unitId: "2",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg"),
        new LineItem("b", 1, "Avocado - 4kg"),
      ],
    });

    const u3 = labelUnit({
      displayName: "#1195-F1",
      unitId: "1",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg"),
        new LineItem("b", 1, "Avocado - 4kg"),
      ],
    });

    const u2 = labelUnit({
      displayName: "#2000-F1",
      unitId: "3",
      lineItems: [
        new LineItem("a", 4, "Avocado - 2kg"),
        new LineItem("b", 1, "Avocado - 4kg"),
      ],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([u1, u2, u3]);

    expect(groups.map((g) => g.key)).toEqual(["a::3|b::1", "a::4|b::1"]);

    expect(groups[0].items).toEqual([
      new LineItem("a", 3, "Avocado - 2kg"),
      new LineItem("b", 1, "Avocado - 4kg"),
    ]);

    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "#1194-F4",
      "#1195-F1",
    ]);

    expect(groups[1].items).toEqual([
      new LineItem("a", 4, "Avocado - 2kg"),
      new LineItem("b", 1, "Avocado - 4kg"),
    ]);

    expect(groups[1].units.map((u) => u.displayName)).toEqual(["#2000-F1"]);
  });

  it("sorts groups by number of labels (units) descending, not by item count", () => {
    const u1 = labelUnit({
      displayName: "#1194-F4",
      unitId: "1",
      lineItems: [new LineItem("a", 2, "Avocado - 2kg")],
    });

    const u2 = labelUnit({
      displayName: "#1195-F1",
      unitId: "2",
      lineItems: [new LineItem("a", 2, "Avocado - 2kg")],
    });

    const u3 = labelUnit({
      displayName: "#2000-F1",
      unitId: "3",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg"),
        new LineItem("b", 1, "Avocado - 4kg"),
      ],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([u1, u2, u3]);

    expect(groups.map((g) => g.key)).toEqual(["a::2", "a::3|b::1"]);

    expect(groups[0].items).toEqual([new LineItem("a", 2, "Avocado - 2kg")]);

    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "#1194-F4",
      "#1195-F1",
    ]);

    expect(groups[1].items).toEqual([
      new LineItem("a", 3, "Avocado - 2kg"),
      new LineItem("b", 1, "Avocado - 4kg"),
    ]);

    expect(groups[1].units.map((u) => u.displayName)).toEqual(["#2000-F1"]);
  });

  it("uses unitId as tiebreaker when displayName is identical", () => {
    const u1 = labelUnit({
      displayName: "Same",
      unitId: "a-1",
      lineItems: [new LineItem("c", 5, "Cherries - 2kg")],
    });
    const u2 = labelUnit({
      displayName: "Same",
      unitId: "a-0",
      lineItems: [new LineItem("c", 5, "Cherries - 2kg")],
    });

    const [group] = GroupedUnitsUtils.groupUnitsBySummary([u1, u2]);

    expect(group.key).toBe("c::5");
    expect(group.units.map((u) => u.unitId)).toEqual(["a-0", "a-1"]);
  });

  it("returns empty array for empty input", () => {
    expect(GroupedUnitsUtils.groupUnitsBySummary([])).toEqual([]);
  });

  it("groups empty-lineItems units together under an empty key", () => {
    const u1 = labelUnit({
      displayName: "E1",
      unitId: "e1",
      lineItems: [],
    });
    const u2 = labelUnit({
      displayName: "E2",
      unitId: "e2",
      lineItems: [],
    });

    const [group] = GroupedUnitsUtils.groupUnitsBySummary([u1, u2]);

    expect(group.key).toBe("");
    expect(group.items).toEqual([]);
    expect(group.units.map((u) => u.displayName)).toEqual(["E1", "E2"]);
  });

  it("clusters groups by shared products instead of sorting only by label count", () => {
    const u1 = labelUnit({
      displayName: "label 1",
      unitId: "1",
      lineItems: [
        new LineItem("mango", 1, "Mango"),
        new LineItem("avocado", 1, "Avocado"),
      ],
    });

    const u2 = labelUnit({
      displayName: "label 2",
      unitId: "2",
      lineItems: [
        new LineItem("mango", 1, "Mango"),
        new LineItem("avocado", 1, "Avocado"),
      ],
    });

    const u3 = labelUnit({
      displayName: "label 3",
      unitId: "3",
      lineItems: [
        new LineItem("mango", 1, "Mango"),
        new LineItem("avocado", 1, "Avocado"),
      ],
    });

    const u4 = labelUnit({
      displayName: "label 4",
      unitId: "4",
      lineItems: [new LineItem("mango", 5, "Mango")],
    });

    const u5 = labelUnit({
      displayName: "label 5",
      unitId: "5",
      lineItems: [
        new LineItem("pineapple", 1, "Pineapple"),
        new LineItem("coconut", 1, "Coconut"),
      ],
    });

    const u6 = labelUnit({
      displayName: "label 6",
      unitId: "6",
      lineItems: [
        new LineItem("pineapple", 1, "Pineapple"),
        new LineItem("coconut", 1, "Coconut"),
      ],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([
      u1,
      u2,
      u3,
      u4,
      u5,
      u6,
    ]);

    const keyGroupA = "avocado::1|mango::1";
    const keyGroupB = "mango::5";
    const keyGroupC = "coconut::1|pineapple::1";

    expect(groups.map((g) => g.key)).toEqual([keyGroupA, keyGroupB, keyGroupC]);
  });

  it("when product overlap is tied, prefers the group with more labels (units)", () => {
    const s1 = labelUnit({
      displayName: "S1",
      unitId: "s1",
      lineItems: [new LineItem("mango", 5, "Mango")],
    });
    const s2 = labelUnit({
      displayName: "S2",
      unitId: "s2",
      lineItems: [new LineItem("mango", 5, "Mango")],
    });
    const s3 = labelUnit({
      displayName: "S3",
      unitId: "s3",
      lineItems: [new LineItem("mango", 5, "Mango")],
    });

    const a1 = labelUnit({
      displayName: "A1",
      unitId: "a1",
      lineItems: [
        new LineItem("mango", 1, "Mango"),
        new LineItem("avocado", 1, "Avocado"),
      ],
    });

    const b1 = labelUnit({
      displayName: "B1",
      unitId: "b1",
      lineItems: [
        new LineItem("mango", 1, "Mango"),
        new LineItem("banana", 1, "Banana"),
      ],
    });
    const b2 = labelUnit({
      displayName: "B2",
      unitId: "b2",
      lineItems: [
        new LineItem("mango", 1, "Mango"),
        new LineItem("banana", 1, "Banana"),
      ],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([
      a1,
      b1,
      s2,
      s1,
      b2,
      s3,
    ]);

    const keySeed = "mango::5";
    const keyB = "banana::1|mango::1";
    const keyA = "avocado::1|mango::1";

    expect(groups.map((g) => g.key)).toEqual([keySeed, keyB, keyA]);
  });

  it("when there is no overlap with the previous group, starts a new cluster deterministically", () => {
    const m = (i: number) =>
      labelUnit({
        displayName: `M${i}`,
        unitId: `m${i}`,
        lineItems: [new LineItem("mango", 1, "Mango")],
      });

    const p = (i: number) =>
      labelUnit({
        displayName: `P${i}`,
        unitId: `p${i}`,
        lineItems: [
          new LineItem("pineapple", 1, "Pineapple"),
          new LineItem("coconut", 1, "Coconut"),
        ],
      });

    const k = (i: number) =>
      labelUnit({
        displayName: `K${i}`,
        unitId: `k${i}`,
        lineItems: [new LineItem("kiwi", 1, "Kiwi")],
      });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([
      p(1),
      m(2),
      k(1),
      m(1),
      p(2),
      m(4),
      k(2),
      p(3),
      m(3),
    ]);

    const keyMango = "mango::1";
    const keyPineappleCoconut = "coconut::1|pineapple::1";
    const keyKiwi = "kiwi::1";

    expect(groups.map((g) => g.key)).toEqual([
      keyMango,
      keyPineappleCoconut,
      keyKiwi,
    ]);
  });
});
