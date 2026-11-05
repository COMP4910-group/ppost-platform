import type {
  CostLine,
  CostCategory,
  CategorySubtotals,
  FundingSource,
  FundingGap,
} from '../types';

// ─── Line-level ───────────────────────────────────────────────────────────────

/**
 * Core Class D formula: Cost = Quantity × Unit Rate × Duration
 *
 * All three inputs must be non-negative finite numbers; returns 0 for
 * any invalid / missing input rather than NaN.
 */
export function computeLineCost(
  quantity: number,
  unitRate: number,
  duration: number,
): number {
  if (!isFinite(quantity) || !isFinite(unitRate) || !isFinite(duration)) {
    return 0;
  }
  return Math.max(0, quantity) * Math.max(0, unitRate) * Math.max(0, duration);
}

/**
 * Rehydrate `totalCost` on a cost line without mutating the original.
 */
export function recalculateLine(line: CostLine): CostLine {
  return {
    ...line,
    totalCost: computeLineCost(line.quantity, line.unitRate, line.duration),
  };
}

// ─── Subtotals ────────────────────────────────────────────────────────────────

const ZERO_SUBTOTALS: CategorySubtotals = {
  labour: 0,
  equipment: 0,
  materials: 0,
  subcontractors: 0,
  facility_rental: 0,
  overhead: 0,
  escalation: 0,
  engineering_allowance: 0,
  contingency: 0,
};

/**
 * Group cost lines by category and sum their totalCost values.
 */
export function computeSubtotals(lines: readonly CostLine[]): CategorySubtotals {
  return lines.reduce<CategorySubtotals>((acc, line) => {
    const cat = line.category as CostCategory;
    return { ...acc, [cat]: (acc[cat] ?? 0) + (line.totalCost ?? 0) };
  }, { ...ZERO_SUBTOTALS });
}

/**
 * Sum all category subtotals into a single grand total.
 */
export function computeGrandTotal(subtotals: CategorySubtotals): number {
  return Object.values(subtotals).reduce((sum, v) => sum + v, 0);
}

// ─── Funding Gap ─────────────────────────────────────────────────────────────

/**
 * Funding gap = Total Estimated Cost − Eligible Costs − External Grants
 *
 * A positive result means the local authority must fund that difference.
 * A negative result (over-funded) is clamped to 0 in localBurden.
 */
export function computeFundingGap(
  totalEstimatedCost: number,
  fundingSources: readonly FundingSource[],
): FundingGap {
  const totalEligibleCost = fundingSources
    .filter((s) => s.type === 'eligible')
    .reduce((sum, s) => sum + s.amount, 0);

  const totalExternalGrants = fundingSources
    .filter((s) => s.type === 'grant')
    .reduce((sum, s) => sum + s.amount, 0);

  const rawBurden =
    totalEstimatedCost - totalEligibleCost - totalExternalGrants;

  return {
    totalEstimatedCost,
    totalEligibleCost,
    totalExternalGrants,
    localBurden: Math.max(0, rawBurden),
    fundingSources: [...fundingSources],
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const CAD = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return CAD.format(value);
}

/**
 * Human-readable label for a duration period, e.g. "3 days"
 */
export function formatDuration(
  duration: number,
  unit: CostLine['durationUnit'],
): string {
  const labels: Record<CostLine['durationUnit'], string> = {
    hr: 'hr',
    day: 'day',
    wk: 'wk',
    mo: 'mo',
  };
  return `${duration} ${labels[unit]}${duration !== 1 ? 's' : ''}`;
}

/**
 * Generate a collision-resistant ID for a new cost line.
 * Uses crypto.randomUUID when available, otherwise a timestamp+random fallback.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
