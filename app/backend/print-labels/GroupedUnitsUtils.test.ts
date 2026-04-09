import { describe, expect, it } from "vitest";
import type { LabelUnitDetails } from "../models/LabelUnitDetails";
import { LabelUnitKind } from "../models/LabelUnitKind";
import { GroupedUnitsUtils } from "./GroupedUnitsUtils";
import { LineItem } from "app/commons/models/LineItem";

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
  it("aggregates quantities and sorts by variantId", () => {
    const items: LineItem[] = [
      new LineItem("b", 1, "Cherries - 2kg", ["Spain"], "10"),
      new LineItem("a", 1, "Dragon Fruit - 2kg", ["Spain"], "11"),
      new LineItem("a", 2, "Dragon Fruit - 2kg", ["Spain"], "11"),
    ];

    const out = GroupedUnitsUtils.aggregateAndSort(items);

    expect(out).toEqual([
      new LineItem("a", 3, "Dragon Fruit - 2kg", ["Spain"], "11"),
      new LineItem("b", 1, "Cherries - 2kg", ["Spain"], "10"),
    ]);
  });

  it("does not mutate input array", () => {
    const items = [
      new LineItem("x", 1, "Avocado - 2kg", ["Spain"], "12"),
      new LineItem("x", 2, "Avocado - 2kg", ["Spain"], "12"),
    ];
    const copy = JSON.parse(JSON.stringify(items));
    void GroupedUnitsUtils.aggregateAndSort(items);
    expect(items).toEqual(copy);
  });
});

describe("GroupedUnitsUtils.buildKey", () => {
  it("builds deterministic keys from aggregated items", () => {
    const a = GroupedUnitsUtils.aggregateAndSort([
      new LineItem("a", 1, "Dragon Fruit - 2kg", ["Ecuador"], "14"),
      new LineItem("a", 1, "Dragon Fruit - 2kg", ["Ecuador"], "14"),
      new LineItem("b", 1, "Cherries - 2kg", ["Spain"], "10"),
    ]);
    const b = GroupedUnitsUtils.aggregateAndSort([
      new LineItem("b", 1, "Cherries - 2kg", ["Spain"], "10"),
      new LineItem("a", 2, "Dragon Fruit - 2kg", ["Ecuador"], "14"),
    ]);

    const keyA = GroupedUnitsUtils.buildKey(a);
    const keyB = GroupedUnitsUtils.buildKey(b);

    expect(keyA).toBe("a::Ecuador::2|b::Spain::1");
    expect(keyB).toBe("a::Ecuador::2|b::Spain::1"); // identical despite different original order
  });

  it("returns empty string for empty item list", () => {
    const key = GroupedUnitsUtils.buildKey([]);
    expect(key).toBe("");
  });
});

it("sorts by both variantId and country of origin", () => {
  const a = GroupedUnitsUtils.aggregateAndSort([
    new LineItem("a", 1, "Dragon Fruit - 2kg", ["Ecuador"], "14"),
    new LineItem("a", 1, "Dragon Fruit - 2kg", ["Spain"], "11"),
  ]);
  const b = GroupedUnitsUtils.aggregateAndSort([
    new LineItem("a", 1, "Dragon Fruit - 2kg", ["Spain"], "11"),
    new LineItem("a", 1, "Dragon Fruit - 2kg", ["Ecuador"], "14"),
  ]);

  const keyA = GroupedUnitsUtils.buildKey(a);
  const keyB = GroupedUnitsUtils.buildKey(b);

  expect(keyA).toBe("a::Ecuador::1|a::Spain::1");
  expect(keyB).toBe("a::Ecuador::1|a::Spain::1"); // identical despite different origins order
});

describe("GroupedUnitsUtils.groupUnitsBySummary", () => {
  it("groups units by identical aggregated item summaries", () => {
    // Group A: a::Spain::2, b::Spain::1
    const u1 = labelUnit({
      displayName: "#1194-F4",
      unitId: "2",
      lineItems: [
        new LineItem("a", 1, "Avocado - 2kg", ["Spain"], "12"),
        new LineItem("a", 1, "Avocado - 2kg", ["Spain"], "12"),
        new LineItem("b", 1, "Dragon Fruit - 2kg", ["Spain"], "11"),
      ],
    });

    // Group A: a::Spain::2, b::Spain::1 (same as u1)
    const u3 = labelUnit({
      displayName: "#1195-F1",
      unitId: "1",
      lineItems: [
        new LineItem("b", 1, "Dragon Fruit - 2kg", ["Spain"], "11"),
        new LineItem("a", 2, "Avocado - 2kg", ["Spain"], "12"),
      ],
    });

    // Group B: c::Spain::5
    const u2 = labelUnit({
      displayName: "#2000-F1",
      unitId: "3",
      lineItems: [new LineItem("c", 5, "Cherries - 2kg", ["Spain"], "10")],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([u1, u2, u3]);

    // Two groups total; sorted by key: "a::Spain::2|b::Spain::1" then "c::Spain::5"
    expect(groups.map((g) => g.key)).toEqual([
      "a::Spain::2|b::Spain::1",
      "c::Spain::5",
    ]);

    // ----------------------- Group A -----------------------
    // Group A items are canonical/aggregated
    expect(groups[0].items).toEqual([
      new LineItem("a", 2, "Avocado - 2kg", ["Spain"], "12"),
      new LineItem("b", 1, "Dragon Fruit - 2kg", ["Spain"], "11"),
    ]);

    // Units in Group A sorted by displayName asc, then unitId asc
    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "#1194-F4",
      "#1195-F1",
    ]);

    // ----------------------- Group B -----------------------
    // Group B items are canonical/aggregated
    expect(groups[1].items).toEqual([
      new LineItem("c", 5, "Cherries - 2kg", ["Spain"], "10"),
    ]);

    // Units in Group B sorted by displayName asc, then unitId asc
    expect(groups[1].units.map((u) => u.displayName)).toEqual(["#2000-F1"]);
  });

  it("groups units correctly even if identifier is the same and only origin is different", () => {
    // Group A: a::Spain::3, b::Spain::1
    const u1 = labelUnit({
      displayName: "#1194-F4",
      unitId: "2",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg", ["Spain"], "12"),
        new LineItem("b", 1, "Avocado - 4kg", ["Spain"], "15"),
      ],
    });

    // Group A: a::Spain::3, b::Spain::1 (same as u1)
    const u3 = labelUnit({
      displayName: "#1195-F1",
      unitId: "1",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg", ["Spain"], "12"),
        new LineItem("b", 1, "Avocado - 4kg", ["Spain"], "15"),
      ],
    });

    // Group B: a::Ecuador::3, b::Ecuador::1
    const u2 = labelUnit({
      displayName: "#2000-F1",
      unitId: "3",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg", ["Ecuador"], "18"),
        new LineItem("b", 1, "Avocado - 4kg", ["Ecuador"], "19"),
      ],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([u1, u2, u3]);

    // Two groups total; first one is Ecuador, second one Spain
    expect(groups.map((g) => g.key)).toEqual([
      "a::Spain::3|b::Spain::1",
      "a::Ecuador::3|b::Ecuador::1",
    ]);

    // ----------------------- Group A -----------------------
    expect(groups[0].items).toEqual([
      new LineItem("a", 3, "Avocado - 2kg", ["Spain"], "12"),
      new LineItem("b", 1, "Avocado - 4kg", ["Spain"], "15"),
    ]);

    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "#1194-F4",
      "#1195-F1",
    ]);

    // ----------------------- Group B -----------------------
    expect(groups[1].items).toEqual([
      new LineItem("a", 3, "Avocado - 2kg", ["Ecuador"], "18"),
      new LineItem("b", 1, "Avocado - 4kg", ["Ecuador"], "19"),
    ]);

    expect(groups[1].units.map((u) => u.displayName)).toEqual(["#2000-F1"]);
  });

  it("sorts groups by number of labels (units) descending, not by item count", () => {
    // Group A: 1 item type, 2 labels
    const u1 = labelUnit({
      displayName: "#1194-F4",
      unitId: "1",
      lineItems: [new LineItem("a", 2, "Avocado - 2kg", ["Spain"], "12")],
    });

    const u2 = labelUnit({
      displayName: "#1195-F1",
      unitId: "2",
      lineItems: [new LineItem("a", 2, "Avocado - 2kg", ["Spain"], "12")],
    });

    // Group B: 2 item types, 1 label
    const u3 = labelUnit({
      displayName: "#2000-F1",
      unitId: "3",
      lineItems: [
        new LineItem("a", 3, "Avocado - 2kg", ["Spain"], "12"),
        new LineItem("b", 1, "Avocado - 4kg", ["Spain"], "15"),
      ],
    });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([u1, u2, u3]);

    // Group with MORE LABELS (2 units) comes first,
    // even though it has fewer item types.
    expect(groups.map((g) => g.key)).toEqual([
      "a::Spain::2",
      "a::Spain::3|b::Spain::1",
    ]);

    // ----------------------- Group A (2 labels) -----------------------
    expect(groups[0].items).toEqual([
      new LineItem("a", 2, "Avocado - 2kg", ["Spain"], "12"),
    ]);

    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "#1194-F4",
      "#1195-F1",
    ]);

    // ----------------------- Group B (1 label) -----------------------
    expect(groups[1].items).toEqual([
      new LineItem("a", 3, "Avocado - 2kg", ["Spain"], "12"),
      new LineItem("b", 1, "Avocado - 4kg", ["Spain"], "15"),
    ]);

    expect(groups[1].units.map((u) => u.displayName)).toEqual(["#2000-F1"]);
  });

  it("uses unitId as tiebreaker when displayName is identical", () => {
    const u1 = labelUnit({
      displayName: "Same",
      unitId: "a-1",
      lineItems: [new LineItem("c", 5, "Cherries - 2kg", ["Spain"], "10")],
    });
    const u2 = labelUnit({
      displayName: "Same",
      unitId: "a-0",
      lineItems: [new LineItem("c", 5, "Cherries - 2kg", ["Spain"], "10")],
    });

    const [group] = GroupedUnitsUtils.groupUnitsBySummary([u1, u2]);
    expect(group.key).toBe("c::Spain::5");
    expect(group.units.map((u) => u.unitId)).toEqual(["a-0", "a-1"]); // tiebreaker by unitId
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

  it("clusters groups by shared products (e.g. mango groups stay adjacent) instead of sorting only by label count", () => {
    // Labels 1-3: mango(1) + avocado(1) => same summary => Group A (3 labels)
    const u1 = labelUnit({
      displayName: "label 1",
      unitId: "1",
      lineItems: [
        new LineItem("mango", 1, "Mango", ["Spain"], "20"),
        new LineItem("avocado", 1, "Avocado", ["Spain"], "21"),
      ],
    });

    const u2 = labelUnit({
      displayName: "label 2",
      unitId: "2",
      lineItems: [
        new LineItem("mango", 1, "Mango", ["Spain"], "20"),
        new LineItem("avocado", 1, "Avocado", ["Spain"], "21"),
      ],
    });

    const u3 = labelUnit({
      displayName: "label 3",
      unitId: "3",
      lineItems: [
        new LineItem("mango", 1, "Mango", ["Spain"], "20"),
        new LineItem("avocado", 1, "Avocado", ["Spain"], "21"),
      ],
    });

    // Label 4: mango(5) => Group B (1 label)
    const u4 = labelUnit({
      displayName: "label 4",
      unitId: "4",
      lineItems: [new LineItem("mango", 5, "Mango", ["Spain"], "20")],
    });

    // Labels 5-6: pineapple(1) + coconut(1) => same summary => Group C (2 labels)
    const u5 = labelUnit({
      displayName: "label 5",
      unitId: "5",
      lineItems: [
        new LineItem("pineapple", 1, "Pineapple", ["Spain"], "22"),
        new LineItem("coconut", 1, "Coconut", ["Spain"], "23"),
      ],
    });

    const u6 = labelUnit({
      displayName: "label 6",
      unitId: "6",
      lineItems: [
        new LineItem("pineapple", 1, "Pineapple", ["Spain"], "22"),
        new LineItem("coconut", 1, "Coconut", ["Spain"], "23"),
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

    // Canonical keys (because aggregateAndSort sorts by item.getKey()).
    // avocado < mango, and coconut < pineapple lexicographically.
    const keyGroupA = "avocado::Spain::1|mango::Spain::1";
    const keyGroupB = "mango::Spain::5";
    const keyGroupC = "coconut::Spain::1|pineapple::Spain::1";

    // Expectation:
    // Group A (mango+avocado) first,
    // then Group B (mango-only) because it shares mango,
    // then Group C (no mango).
    expect(groups.map((g) => g.key)).toEqual([keyGroupA, keyGroupB, keyGroupC]);

    expect(groups[0].units.map((u) => u.displayName)).toEqual([
      "label 1",
      "label 2",
      "label 3",
    ]);
    expect(groups[1].units.map((u) => u.displayName)).toEqual(["label 4"]);
    expect(groups[2].units.map((u) => u.displayName)).toEqual([
      "label 5",
      "label 6",
    ]);
  });

  it("when product overlap is tied, prefers the group with more labels (units)", () => {
    // Seed group S (most labels) => mango-only, 3 labels
    const s1 = labelUnit({
      displayName: "S1",
      unitId: "s1",
      lineItems: [new LineItem("mango", 5, "Mango", ["Spain"], "20")],
    });
    const s2 = labelUnit({
      displayName: "S2",
      unitId: "s2",
      lineItems: [new LineItem("mango", 5, "Mango", ["Spain"], "20")],
    });
    const s3 = labelUnit({
      displayName: "S3",
      unitId: "s3",
      lineItems: [new LineItem("mango", 5, "Mango", ["Spain"], "20")],
    });

    // Candidate A overlaps with seed by 1 (mango), 1 label
    const a1 = labelUnit({
      displayName: "A1",
      unitId: "a1",
      lineItems: [
        new LineItem("mango", 1, "Mango", ["Spain"], "20"),
        new LineItem("avocado", 1, "Avocado", ["Spain"], "21"),
      ],
    });

    // Candidate B overlaps with seed by 1 (mango), 2 labels  ==> should be picked before A
    const b1 = labelUnit({
      displayName: "B1",
      unitId: "b1",
      lineItems: [
        new LineItem("mango", 1, "Mango", ["Spain"], "20"),
        new LineItem("banana", 1, "Banana", ["Spain"], "23"),
      ],
    });
    const b2 = labelUnit({
      displayName: "B2",
      unitId: "b2",
      lineItems: [
        new LineItem("mango", 1, "Mango", ["Spain"], "20"),
        new LineItem("banana", 1, "Banana", ["Spain"], "23"),
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

    const keySeed = "mango::Spain::5";
    const keyB = "banana::Spain::1|mango::Spain::1";
    const keyA = "avocado::Spain::1|mango::Spain::1";

    expect(groups.map((g) => g.key)).toEqual([keySeed, keyB, keyA]);
  });

  it("when there is no overlap with the previous group, starts a new cluster deterministically (more labels first, then key)", () => {
    // Cluster 1 (seed): mango-only, 4 labels
    const m = (i: number) =>
      labelUnit({
        displayName: `M${i}`,
        unitId: `m${i}`,
        lineItems: [new LineItem("mango", 1, "Mango", ["Spain"], "20")],
      });

    // Cluster 2: pineapple+coconut, 3 labels
    const p = (i: number) =>
      labelUnit({
        displayName: `P${i}`,
        unitId: `p${i}`,
        lineItems: [
          new LineItem("pineapple", 1, "Pineapple", ["Spain"], "22"),
          new LineItem("coconut", 1, "Coconut", ["Spain"], "23"),
        ],
      });

    // Cluster 3: kiwi-only, 2 labels
    const k = (i: number) =>
      labelUnit({
        displayName: `K${i}`,
        unitId: `k${i}`,
        lineItems: [new LineItem("kiwi", 1, "Kiwi", ["Spain"], "24")],
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

    const keyMango = "mango::Spain::1";
    const keyPineappleCoconut = "coconut::Spain::1|pineapple::Spain::1";
    const keyKiwi = "kiwi::Spain::1";

    // After mango cluster, there is no overlap with either pineapple/coconut or kiwi,
    // so we start a new cluster from the remaining group with more labels (pineapple/coconut),
    // then kiwi last.
    expect(groups.map((g) => g.key)).toEqual([
      keyMango,
      keyPineappleCoconut,
      keyKiwi,
    ]);
  });

  it("treats variantId as the overlap identity even when origins differ (Spain vs Ecuador)", () => {
    // Seed: mango Spain, 6 labels (ensures it is first)
    const ms = (i: number) =>
      labelUnit({
        displayName: `MS${i}`,
        unitId: `ms${i}`,
        lineItems: [new LineItem("mango", 1, "Mango", ["Spain"], "20")],
      });

    // Overlapping by variantId only: mango Ecuador, 1 label => should come next
    const me = labelUnit({
      displayName: "ME1",
      unitId: "me1",
      lineItems: [new LineItem("mango", 1, "Mango", ["Ecuador"], "25")],
    });

    // Non-overlapping but many labels: pineapple-only, 5 labels => should NOT interrupt the mango adjacency
    const pp = (i: number) =>
      labelUnit({
        displayName: `PP${i}`,
        unitId: `pp${i}`,
        lineItems: [new LineItem("pineapple", 1, "Pineapple", ["Spain"], "22")],
      });

    const groups = GroupedUnitsUtils.groupUnitsBySummary([
      pp(1),
      ms(2),
      ms(1),
      pp(2),
      ms(3),
      pp(3),
      ms(4),
      me,
      pp(4),
      ms(5),
      pp(5),
      ms(6),
    ]);

    const keyMangoSpain = "mango::Spain::1";
    const keyMangoEcuador = "mango::Ecuador::1";
    const keyPineapple = "pineapple::Spain::1";

    // Mango Spain cluster first, then mango Ecuador (overlap by variantId),
    // then pineapple.
    expect(groups.map((g) => g.key)).toEqual([
      keyMangoSpain,
      keyMangoEcuador,
      keyPineapple,
    ]);
  });
});
