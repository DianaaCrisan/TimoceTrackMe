import { formatOrderRanges } from "../print-labels/utils/formatOrderRanges";

/** Longest order list kept in a file name; anything longer uses the timestamp. */
export const MAX_FILE_NAME_RANGES_LENGTH = 60;

/**
 * A file name that says which orders are inside, from the same compact list
 * as the PDF's first page: `etichete-livrare_1201-1206_1209.pdf`.
 *
 * Falls back to `<baseName>_<timestamp>.<extension>` when the list is longer
 * than {@link MAX_FILE_NAME_RANGES_LENGTH} characters or there are no orders.
 * Keeps letters, digits and dashes of each range, so "#1201-1206" becomes
 * "1201-1206" and the name stays valid everywhere, S3 keys included.
 */
export function buildOrderRangesFileName(args: {
  baseName: string;
  orderNames: string[];
  timestamp: string;
  extension: string;
}): string {
  const ranges = formatOrderRanges(args.orderNames)
    .map((range) => range.replace(/[^A-Za-z0-9-]/g, ""))
    .filter(Boolean)
    .join("_");

  const suffix =
    ranges && ranges.length <= MAX_FILE_NAME_RANGES_LENGTH
      ? ranges
      : args.timestamp;

  return `${args.baseName}_${suffix}.${args.extension}`;
}
