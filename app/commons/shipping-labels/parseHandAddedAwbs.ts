/** The most AWBs one "Add by hand" can take. */
export const MAX_HAND_ADDED_AWBS = 200;

export type HandAddedLine = {
  /** 1-based, as the admin sees it in the box. */
  line: number;
  trackingNumber: string;
  /** `#1022`, or null when the line has no order. */
  orderName: string | null;
};

export type HandAddedLineError = {
  line: number;
  text: string;
  reason: "badAwb" | "badOrder" | "tooManyParts" | "duplicate";
};

const AWB_PATTERN = /^[A-Za-z0-9-]{5,40}$/;
const ORDER_PATTERN = /^#?[A-Za-z0-9-]{1,30}$/;

/**
 * Reads the "Add by hand" box: one AWB per line, optionally followed by its
 * order number, e.g. `6256347789 1022` or `6256347789 #1022`. Spaces, tabs,
 * commas and semicolons all separate, so a column pasted from Excel works.
 * Blank lines are skipped.
 */
export function parseHandAddedAwbs(text: string): {
  lines: HandAddedLine[];
  errors: HandAddedLineError[];
} {
  const lines: HandAddedLine[] = [];
  const errors: HandAddedLineError[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const value = raw.trim();
    if (!value) return;

    const parts = value.split(/[\s,;]+/).filter(Boolean);
    const [trackingNumber, order] = parts;

    if (parts.length > 2) {
      errors.push({ line, text: value, reason: "tooManyParts" });
    } else if (!AWB_PATTERN.test(trackingNumber)) {
      errors.push({ line, text: value, reason: "badAwb" });
    } else if (order !== undefined && !ORDER_PATTERN.test(order)) {
      errors.push({ line, text: value, reason: "badOrder" });
    } else if (seen.has(trackingNumber)) {
      errors.push({ line, text: value, reason: "duplicate" });
    } else {
      seen.add(trackingNumber);
      lines.push({
        line,
        trackingNumber,
        orderName: order ? `#${order.replace(/^#/, "")}` : null,
      });
    }
  });

  return { lines, errors };
}
