const ORDER_NAME_PATTERN = /^(\D*)(\d+)(\D*)$/;

/**
 * Compresses order names into runs of consecutive numbers:
 * `#5 #6 #7 #9 #10 #11 #12 #16` → `["#5-7", "#9-12", "#16"]`.
 *
 * - Names only form a run with the same prefix and suffix ("#", "-B"...).
 * - Duplicates are dropped; two consecutive numbers already make a run.
 * - Names without a number are kept as they are, at the end.
 */
export function formatOrderRanges(orderNames: string[]): string[] {
  const numbersByAffixes = new Map<
    string,
    { prefix: string; suffix: string; numbers: Set<number> }
  >();
  const unparsedNames = new Set<string>();

  for (const name of orderNames) {
    const match = ORDER_NAME_PATTERN.exec(name.trim());
    if (!match) {
      if (name.trim()) unparsedNames.add(name.trim());
      continue;
    }

    const [, prefix, digits, suffix] = match;
    const key = `${prefix}\u0000${suffix}`;
    const group = numbersByAffixes.get(key) ?? {
      prefix,
      suffix,
      numbers: new Set<number>(),
    };
    group.numbers.add(Number(digits));
    numbersByAffixes.set(key, group);
  }

  const ranges: string[] = [];
  const groups = [...numbersByAffixes.values()].sort(
    (a, b) =>
      a.prefix.localeCompare(b.prefix) || a.suffix.localeCompare(b.suffix),
  );

  for (const { prefix, suffix, numbers } of groups) {
    const sorted = [...numbers].sort((a, b) => a - b);
    let runStart = sorted[0];
    let previous = sorted[0];

    for (const current of [...sorted.slice(1), Number.NaN]) {
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      ranges.push(
        runStart === previous
          ? `${prefix}${runStart}${suffix}`
          : `${prefix}${runStart}-${previous}${suffix}`,
      );
      runStart = current;
      previous = current;
    }
  }

  return [...ranges, ...[...unparsedNames].sort((a, b) => a.localeCompare(b))];
}
