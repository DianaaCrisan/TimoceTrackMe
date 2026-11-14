import { describe, expect, it } from "vitest";
import { packIntoParcels, type PackableItem } from "./packIntoParcels";

const item = (
  id: string,
  quantity: number,
  unitWeightKg: number,
): PackableItem => ({ id, name: `Item ${id}`, quantity, unitWeightKg });

const contents = (parcels: ReturnType<typeof packIntoParcels>) =>
  parcels.map((parcel) =>
    parcel.items.map((entry) => `${entry.id}x${entry.quantity}`).join(" "),
  );

describe("packIntoParcels", () => {
  it("keeps everything in one parcel without a limit", () => {
    const parcels = packIntoParcels([item("a", 3, 10), item("b", 1, 5)], null);

    expect(contents(parcels)).toEqual(["ax3 bx1"]);
    expect(parcels[0].weightKg).toBe(35);
  });

  it("keeps one parcel when the items fit under the limit", () => {
    expect(
      contents(packIntoParcels([item("a", 2, 10), item("b", 1, 5)], 25)),
    ).toEqual(["ax2 bx1"]);
  });

  it("spreads a line item's units over parcels", () => {
    const parcels = packIntoParcels([item("a", 5, 10)], 25);

    expect(contents(parcels)).toEqual(["ax2", "ax2", "ax1"]);
    expect(parcels.map((parcel) => parcel.weightKg)).toEqual([20, 20, 10]);
  });

  it("puts light units into the first parcel with room", () => {
    // in sequence this would open 3 parcels: [20], [20, 5], [5]
    const parcels = packIntoParcels(
      [item("big", 2, 20), item("small", 2, 5)],
      25,
    );

    expect(contents(parcels)).toEqual(["bigx1 smallx1", "bigx1 smallx1"]);
  });

  it("ships a unit heavier than the limit on its own", () => {
    const parcels = packIntoParcels([item("a", 1, 30), item("b", 1, 2)], 25);

    expect(contents(parcels)).toEqual(["ax1", "bx1"]);
    expect(parcels.map((parcel) => parcel.isOverLimit)).toEqual([true, false]);
  });

  it("tolerates float noise at the limit", () => {
    expect(packIntoParcels([item("a", 3, 0.1)], 0.3)).toHaveLength(1);
  });

  it("packs the same items the same way whatever their order", () => {
    const items = [item("b", 2, 6), item("a", 2, 6), item("c", 1, 12)];

    expect(contents(packIntoParcels(items, 12))).toEqual(
      contents(packIntoParcels([...items].reverse(), 12)),
    );
  });

  it("skips items with nothing left to ship", () => {
    expect(packIntoParcels([item("a", 0, 5)], 25)).toEqual([]);
  });
});
