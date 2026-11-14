/** A fulfillment order line item still to ship. */
export type PackableItem = {
  /** The fulfillment order line item ID. */
  id: string;
  name: string;
  quantity: number;
  /** The weight of one unit, in kg. */
  unitWeightKg: number;
};

export type PackedParcel = {
  items: { id: string; name: string; quantity: number }[];
  weightKg: number;
  /** One unit alone weighs more than the limit, so it ships on its own. */
  isOverLimit: boolean;
};

// Weights are decimals, so a sum like 4.9 + 0.1 can land a hair above the
// limit. Tolerate that instead of opening an extra parcel.
const WEIGHT_EPSILON_KG = 1e-9;

/**
 * Packs the items into as few parcels as fit under `limitKg`, one unit at a
 * time. A line item's quantity can be spread over several parcels; each
 * parcel lists exactly the units in it.
 *
 * First-fit decreasing: the heaviest units go first, each into the first
 * parcel with room. With a 25 kg limit, 20 + 20 + 5 + 5 kg packs into 2
 * parcels, where filling parcels in sequence would open 3.
 *
 * Ties are broken by ID, so the same items always pack the same way.
 * Without a limit, everything is one parcel.
 */
export function packIntoParcels(
  items: PackableItem[],
  limitKg: number | null,
): PackedParcel[] {
  const shippable = items.filter((item) => item.quantity > 0);
  if (shippable.length === 0) return [];

  if (limitKg === null) {
    return [
      {
        items: shippable.map(({ id, name, quantity }) => ({
          id,
          name,
          quantity,
        })),
        weightKg: sumWeightKg(shippable),
        isOverLimit: false,
      },
    ];
  }

  const heaviestFirst = [...shippable].sort(
    (a, b) => b.unitWeightKg - a.unitWeightKg || a.id.localeCompare(b.id),
  );
  const parcels: PackedParcel[] = [];

  for (const item of heaviestFirst) {
    for (let unit = 0; unit < item.quantity; unit++) {
      const parcel =
        parcels.find(
          (candidate) =>
            !candidate.isOverLimit &&
            candidate.weightKg + item.unitWeightKg <=
              limitKg + WEIGHT_EPSILON_KG,
        ) ?? openParcel(parcels, item.unitWeightKg > limitKg);

      addUnit(parcel, item);
    }
  }

  return parcels;
}

function openParcel(parcels: PackedParcel[], isOverLimit: boolean) {
  const parcel: PackedParcel = { items: [], weightKg: 0, isOverLimit };
  parcels.push(parcel);
  return parcel;
}

function addUnit(parcel: PackedParcel, item: PackableItem) {
  const existing = parcel.items.find((entry) => entry.id === item.id);
  if (existing) existing.quantity += 1;
  else parcel.items.push({ id: item.id, name: item.name, quantity: 1 });
  parcel.weightKg += item.unitWeightKg;
}

function sumWeightKg(items: PackableItem[]): number {
  return items.reduce(
    (total, item) => total + item.unitWeightKg * item.quantity,
    0,
  );
}
