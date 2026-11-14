/** A checkout field the customer filled in ("Additional details"). */
export type CustomerAttribute = { key: string; value: string };

/** What the customer wrote on an order, for the admin to read before shipping it. */
export type CustomerNote = {
  note: string | null;
  attributes: CustomerAttribute[];
};

/** An order with something from the customer on it. */
export type OrderWithCustomerNote = CustomerNote & {
  id: string;
  name: string;
  customerName: string;
};

/** What the dashboard asks before add tracking: the orders it would run on. */
export type OrderNotesResponse =
  | {
      ok: true;
      /** Every order in the selection, so some can be left out by ID. */
      orderIds: string[];
      /** Only the orders with a note or a filled-in checkout field. */
      ordersWithNotes: OrderWithCustomerNote[];
    }
  | { ok: false; error: string };

/**
 * The customer's note and checkout fields, without empty ones and without
 * keys starting with "_": Shopify's convention for attributes that apps add
 * and the customer never sees (tracking IDs and the like).
 */
export function toCustomerNote(
  note: string | null | undefined,
  attributes: { key: string; value?: string | null }[] | null | undefined,
): CustomerNote {
  return {
    note: note?.trim() || null,
    attributes: (attributes ?? []).flatMap(({ key, value }) => {
      const trimmed = value?.trim();
      return !key.startsWith("_") && trimmed ? [{ key, value: trimmed }] : [];
    }),
  };
}

export function hasCustomerNote(customerNote: CustomerNote): boolean {
  return customerNote.note !== null || customerNote.attributes.length > 0;
}
