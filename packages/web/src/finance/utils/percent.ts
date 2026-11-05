/**
 * Percentage-based cost lines.
 *
 * Some costs are a percentage of other costs (e.g. "10 % contingency").
 * Each percentage category applies to everything that comes BEFORE it:
 *
 *   level 0  Direct costs  (labour, equipment, materials, subcontractors,
 *                           facility rental)
 *   level 1  Overhead               % of level 0
 *   level 2  Escalation             % of levels 0–1
 *   level 3  Engineering allowance  % of levels 0–2
 *   level 4  Contingency            % of levels 0–3
 *
 * Because a percentage never includes its own level or anything after it,
 * there are no circular calculations.
 */
import type { CostCategory, CostLine } from '../types';
import { COST_CATEGORY_LABELS } from '../types';
import { computeLineCost } from './calculations';

/** Categories that may be priced as a percentage, in calculation order. */
export const PERCENT_CATEGORIES: readonly CostCategory[] = [
  'overhead',
  'escalation',
  'engineering_allowance',
  'contingency',
];

/** Categories that start as a percentage line when quick-added. */
export const DEFAULT_PERCENT_CATEGORIES: readonly CostCategory[] = [
  'escalation',
  'engineering_allowance',
  'contingency',
];

export function canBePercent(category: CostCategory): boolean {
  return PERCENT_CATEGORIES.includes(category);
}

/** 0 for direct costs, 1–4 for the percentage categories. */
export function categoryLevel(category: CostCategory): number {
  const i = PERCENT_CATEGORIES.indexOf(category);
  return i === -1 ? 0 : i + 1;
}

export function isPercentLine(line: CostLine): boolean {
  return line.pricing === 'percent' && canBePercent(line.category);
}

/** Plain-English description of what a category's percentage applies to. */
export function percentBaseLabel(category: CostCategory): string {
  const level = categoryLevel(category);
  if (level <= 1) return 'direct costs';
  const parts = ['direct', ...PERCENT_CATEGORIES.slice(0, level - 1).map(
    (c) => COST_CATEGORY_LABELS[c].toLowerCase(),
  )];
  return parts.join(' + ');
}

/**
 * Work out every line's totalCost, including percentage lines.
 *
 * Returns new line objects; the input is not changed. A percentage line in
 * a category that can't be a percentage (e.g. labour) is switched back to
 * unit pricing.
 */
export function resolveLineCosts(lines: readonly CostLine[]): CostLine[] {
  // 1. Unit-priced lines are independent — calculate them first.
  const resolved: CostLine[] = lines.map((l) => {
    if (l.pricing === 'percent' && !canBePercent(l.category)) {
      const fixed: CostLine = { ...l, pricing: 'unit' };
      return { ...fixed, totalCost: computeLineCost(fixed.quantity, fixed.unitRate, fixed.duration) };
    }
    if (isPercentLine(l)) return { ...l, totalCost: 0 };
    return { ...l, totalCost: computeLineCost(l.quantity, l.unitRate, l.duration) };
  });

  // 2. Percentage lines, one level at a time, each on the levels below it.
  for (let level = 1; level <= PERCENT_CATEGORIES.length; level++) {
    const base = percentBase(resolved, level);
    resolved.forEach((l, i) => {
      if (isPercentLine(l) && categoryLevel(l.category) === level) {
        const pct = isFinite(l.percent ?? NaN) ? Math.max(0, l.percent as number) : 0;
        resolved[i] = { ...l, totalCost: (base * pct) / 100 };
      }
    });
  }

  return resolved;
}

/** Sum of all lines below the given level (the amount a % is taken from). */
function percentBase(lines: readonly CostLine[], level: number): number {
  return lines
    .filter((l) => categoryLevel(l.category) < level)
    .reduce((sum, l) => sum + (l.totalCost || 0), 0);
}

/** The amount a percentage line in this category is applied to. */
export function percentBaseFor(lines: readonly CostLine[], category: CostCategory): number {
  return percentBase(lines, categoryLevel(category));
}
