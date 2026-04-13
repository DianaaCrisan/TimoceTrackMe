export type UnsupportedOrder = {
  id: string;
  name: string;
  errorStack: string[];
};

/**
 * Add or merge an unsupported order into the map.
 * This ensures that even if there are multiple failed fulfillments in
 * one order, the order appears only once in the array of unsupported orders
 */
export function addUnsupportedOrder(
  unsupportedByOrder: Map<string, UnsupportedOrder>,
  id: string,
  name: string | undefined,
  errorStack: string[],
) {
  const safeName = name ?? "-";
  const existing = unsupportedByOrder.get(id);

  if (existing) {
    existing.errorStack.push(...errorStack);
    if (existing.name === "-" && name !== "-") {
      existing.name = safeName;
    }
  } else {
    unsupportedByOrder.set(id, {
      id,
      name: safeName,
      errorStack: [...errorStack],
    });
  }
}
