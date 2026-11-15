import { describe, expect, it } from "vitest";
import {
  planAddToPack,
  planRemoveFromPack,
  type CurrentMembership,
} from "./planMembershipChange";

const membership = (
  orderId: string,
  packId: string,
  packStatus: CurrentMembership["packStatus"],
): CurrentMembership => ({
  orderId,
  packId,
  packStatus,
  packTag: `tag-${packId}`,
});

describe("planAddToPack", () => {
  const current = [
    membership("in-target", "target", "LOCKED"),
    membership("in-other", "other", "OPEN"),
    membership("in-closed", "old", "CLOSED"),
  ];

  it("inserts new orders, moves orders from open packs and leaves closed packs alone", () => {
    expect(
      planAddToPack(
        ["new", "in-target", "in-other", "in-closed"],
        current,
        "target",
      ),
    ).toEqual({
      orderIdsToInsert: ["new"],
      ordersToMove: [{ orderId: "in-other", fromTag: "tag-other" }],
      alreadyInTarget: ["in-target"],
      inClosedPack: ["in-closed"],
    });
  });

  it("handles an order listed twice once", () => {
    expect(planAddToPack(["new", "new"], [], "target").orderIdsToInsert).toEqual(
      ["new"],
    );
  });
});

describe("planRemoveFromPack", () => {
  it("removes orders from open and locked packs only", () => {
    expect(
      planRemoveFromPack(
        ["a", "b", "c", "none"],
        [
          membership("a", "p1", "OPEN"),
          membership("b", "p2", "LOCKED"),
          membership("c", "p3", "CLOSED"),
        ],
      ),
    ).toEqual({
      ordersToRemove: [
        { orderId: "a", fromTag: "tag-p1" },
        { orderId: "b", fromTag: "tag-p2" },
      ],
      notInPack: ["none"],
      inClosedPack: ["c"],
    });
  });
});
