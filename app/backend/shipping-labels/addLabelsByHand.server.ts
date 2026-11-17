import type { AwbStatus } from "app/commons/shipping-labels/AwbReport";
import {
  MAX_HAND_ADDED_AWBS,
  parseHandAddedAwbs,
  type HandAddedLineError,
} from "app/commons/shipping-labels/parseHandAddedAwbs";
import type { AdminApiContextWithoutRest } from "../core/types/AdminApiContextWithoutRest";
import { findOrderByName } from "./fetchOrderFulfillments.server";
import { ShippingLabelRepository } from "./ShippingLabelRepository.server";

export type AddByHandLineError = Omit<HandAddedLineError, "reason"> & {
  reason: HandAddedLineError["reason"] | "orderNotFound";
};

export type AddByHandResult =
  | { kind: "empty" }
  | { kind: "tooMany" }
  /** Nothing saved: fix these lines and send the same text again. */
  | { kind: "lineErrors"; errors: AddByHandLineError[] }
  | { kind: "saved"; added: string[]; alreadyInReport: string[] };

/**
 * Saves the AWBs typed in the report's "Add by hand" box, all with the same
 * status and issue day. Each order number is looked up in Shopify. Any line
 * that cannot be read, or names an order Shopify does not have, saves
 * nothing, so the admin can fix it and send the same text again. AWBs the
 * report already has are left as they are and listed.
 */
export async function addLabelsByHand(
  admin: AdminApiContextWithoutRest,
  shopUrl: string,
  input: {
    text: string;
    status: AwbStatus;
    issuedAt: Date;
    note: string | null;
  },
): Promise<AddByHandResult> {
  const { lines, errors } = parseHandAddedAwbs(input.text);
  if (lines.length === 0 && errors.length === 0) return { kind: "empty" };
  if (lines.length > MAX_HAND_ADDED_AWBS) return { kind: "tooMany" };

  const orderNames = [
    ...new Set(lines.flatMap((line) => line.orderName ?? [])),
  ];
  const orders = new Map(
    await Promise.all(
      orderNames.map(
        async (name) =>
          [name, await findOrderByName(admin, shopUrl, name)] as const,
      ),
    ),
  );

  const lineErrors: AddByHandLineError[] = [...errors];
  for (const line of lines) {
    if (line.orderName && !orders.get(line.orderName)) {
      lineErrors.push({
        line: line.line,
        text: `${line.trackingNumber} ${line.orderName}`,
        reason: "orderNotFound",
      });
    }
  }
  if (lineErrors.length > 0) {
    return {
      kind: "lineErrors",
      errors: lineErrors.sort((a, b) => a.line - b.line),
    };
  }

  const added = await ShippingLabelRepository.addByHand(
    lines.map((line) => ({
      trackingNumber: line.trackingNumber,
      status: input.status,
      issuedAt: input.issuedAt,
      order: line.orderName ? (orders.get(line.orderName) ?? null) : null,
      note: input.note,
    })),
  );
  const addedSet = new Set(added);

  return {
    kind: "saved",
    added,
    alreadyInReport: lines
      .map((line) => line.trackingNumber)
      .filter((number) => !addedSet.has(number)),
  };
}
