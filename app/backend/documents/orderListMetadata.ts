import { formatOrderRanges } from "../print-labels/utils/formatOrderRanges";

/**
 * S3 keeps at most 2 KB of user metadata per object, counted as stored,
 * after URI encoding ("#" takes 3 bytes). The list stays under this; a
 * longer one is cut at a range and ends with "…".
 */
const MAX_ENCODED_RANGES_LENGTH = 1800;

/** The metadata keys on a stored document (S3 sends them as x-amz-meta-*). */
const ORDERS_KEY = "orders";
const ORDER_COUNT_KEY = "order-count";

/** The orders inside a document: "#1201-1206, #1209", and how many. */
export type DocumentOrderList = { ranges: string; count: number };

/**
 * S3 metadata saying which orders a document holds, from their names.
 * URI-encoded: S3 metadata values must be plain ASCII.
 */
export function encodeOrderListMetadata(
  orderNames: string[],
): Record<string, string> {
  const uniqueNames = [...new Set(orderNames.filter(Boolean))];
  if (uniqueNames.length === 0) return {};

  let ranges = "";
  for (const range of formatOrderRanges(uniqueNames)) {
    const next = ranges ? `${ranges}, ${range}` : range;
    if (encodeURIComponent(`${next}, …`).length > MAX_ENCODED_RANGES_LENGTH) {
      ranges = `${ranges}, …`;
      break;
    }
    ranges = next;
  }

  return {
    [ORDERS_KEY]: encodeURIComponent(ranges),
    [ORDER_COUNT_KEY]: String(uniqueNames.length),
  };
}

/** The order list back from a document's metadata; null if it has none. */
export function decodeOrderListMetadata(
  metadata: Record<string, string> | undefined,
): DocumentOrderList | null {
  const encoded = metadata?.[ORDERS_KEY];
  const count = Number(metadata?.[ORDER_COUNT_KEY]);
  if (!encoded || !Number.isFinite(count)) return null;

  try {
    return { ranges: decodeURIComponent(encoded), count };
  } catch {
    return null;
  }
}
