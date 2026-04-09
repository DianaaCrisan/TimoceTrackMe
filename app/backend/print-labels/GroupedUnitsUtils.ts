import { GroupedUnits } from "./models/GroupedUnits";
import { LabelUnitDetails } from "./models/LabelUnitDetails";
import { LineItem } from "./models/LineItem";

export class GroupedUnitsUtils {
  /**
   * Groups label units by an identical item summary and returns them
   * in a deterministic, product-aware order.
   *
   * Grouping rules:
   * - Units are grouped if their line items, after aggregation, have:
   *   - the same variant IDs
   *   - the same country of origin per variant
   *   - the same total quantity per variant
   *
   * Ordering rules (high level):
   * 1) Groups are arranged so that groups sharing at least one product
   *    (variantId) appear next to each other.
   * 2) When multiple candidate groups qualify equally, groups with more
   *    labels (units) are preferred.
   * 3) Final tie-breaker is the group key, to guarantee deterministic output.
   *
   * Units inside each group are sorted by displayName, then unitId.
   */
  static groupUnitsBySummary(units: LabelUnitDetails[]): GroupedUnits[] {
    const map = new Map<string, GroupedUnits>();

    for (const u of units) {
      const canonicalItems = this.aggregateAndSort(u.lineItems);
      const key = this.buildKey(canonicalItems);

      const existing = map.get(key);
      if (existing) {
        existing.units.push(u);
      } else {
        map.set(key, { key, items: canonicalItems, units: [u] });
      }
    }

    const groups = Array.from(map.values());

    // Ensure deterministic ordering of units within each group
    for (const g of groups) {
      g.units.sort(
        (a, b) =>
          a.displayName.localeCompare(b.displayName) ||
          a.unitId.localeCompare(b.unitId),
      );
    }

    return this.orderGroupsByOverlap(groups);
  }

  /**
   * Orders already-grouped units so that groups sharing common products
   * (variantIds) are placed adjacent to each other.
   *
   * Algorithm:
   * - Start with the most "significant" group (more labels first).
   * - Repeatedly select the next group that shares the largest number
   *   of variantIds with the previously placed group.
   * - If no remaining group shares any variantIds, fall back to a
   *   deterministic ordering based on label count and group key.
   *
   * This produces stable output while clustering related products together,
   * improving batching and visual coherence.
   */
  private static orderGroupsByOverlap(groups: GroupedUnits[]): GroupedUnits[] {
    if (groups.length <= 1) return groups;

    // Precompute variantId sets per group key
    const variantSetByKey = new Map<string, Set<string>>();
    for (const g of groups) {
      variantSetByKey.set(g.key, new Set(g.items.map((it) => it.variantId)));
    }

    /**
     * Deterministic group priority used when overlap alone is insufficient.
     * Groups with more labels are preferred; keys ensure stable ordering.
     */
    const groupPriority = (a: GroupedUnits, b: GroupedUnits) =>
      b.units.length - a.units.length || a.key.localeCompare(b.key);

    /**
     * Counts how many variantIds two groups have in common.
     */
    const sharedVariantCount = (a: GroupedUnits, b: GroupedUnits): number => {
      const sa = variantSetByKey.get(a.key)!;
      const sb = variantSetByKey.get(b.key)!;

      // iterate smaller set for efficiency
      const [small, large] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
      let count = 0;
      for (const v of small) if (large.has(v)) count++;
      return count;
    };

    const remaining = [...groups].sort(groupPriority); // deterministic start pool
    const ordered: GroupedUnits[] = [];

    // Seed with the most significant group
    ordered.push(remaining.shift()!);

    while (remaining.length > 0) {
      const prev = ordered[ordered.length - 1];

      let bestIdx = 0;
      let bestOverlap = sharedVariantCount(prev, remaining[0]);

      for (let i = 1; i < remaining.length; i++) {
        const overlap = sharedVariantCount(prev, remaining[i]);

        if (
          overlap > bestOverlap ||
          (overlap === bestOverlap &&
            groupPriority(remaining[i], remaining[bestIdx]) < 0)
        ) {
          bestIdx = i;
          bestOverlap = overlap;
        }
      }

      // If there is no product overlap at all, restart ordering from
      // the most significant remaining group.
      if (bestOverlap === 0) {
        remaining.sort(groupPriority);
        ordered.push(remaining.shift()!);
      } else {
        ordered.push(remaining.splice(bestIdx, 1)[0]);
      }
    }
    return ordered;
  }

  /**
   * If the same variant appears multiple times in items,
   * it adds quantities together into one entry
   * In theory, this is not used since in one order the items should already be grouped
   */
  static aggregateAndSort(items: LineItem[]): LineItem[] {
    const agg = new Map<string, LineItem>(); // key = variantId + origins

    for (const item of items) {
      const key = item.getKey();
      const prev = agg.get(key);

      if (prev) {
        prev.quantity += item.quantity;
      } else {
        agg.set(key, item.clone());
      }
    }
    return [...agg.values()].sort((a, b) =>
      a.getKey().localeCompare(b.getKey()),
    );
  }

  /**
   * Build the grouping key from
   * VARIANT IDs + country of origin + quantities.
   */
  static buildKey(items: LineItem[]): string {
    return items
      .map((item) => {
        return `${item.getKey()}::${item.quantity}`;
      })
      .join("|");
  }
}
