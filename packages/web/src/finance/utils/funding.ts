import type { FundingGap, FundingSource } from '../types';
import { computeFundingGap } from './calculations';

/** Class D accuracy range: actual cost may be 50 % lower or 100 % higher. */
export const CLASS_D_LOW_FACTOR = 0.5;
export const CLASS_D_HIGH_FACTOR = 2;

export interface FundingSummary extends FundingGap {
  /** total − all funding (can be negative when over-funded) */
  rawGap: number;
  /** How much funding exceeds the estimate (0 if it doesn't) */
  overFunded: number;
  /** Share of the estimate covered by funding, 0–100 */
  coveragePct: number;
  /** Local burden counting only confirmed funding */
  confirmedLocalBurden: number;
  /** Local burden if the real cost ends up at the low / high Class D bound */
  localBurdenRange: [number, number];
}

/**
 * Everything the Funding Gap Calculator shows.
 *
 * Local burden = Total estimated cost − Eligible costs − External grants
 *
 * The Class D range assumes funding amounts stay the same while the cost
 * moves within −50 % / +100 %.
 */
export function computeFundingSummary(
  totalEstimatedCost: number,
  sources: readonly FundingSource[],
): FundingSummary {
  const total = Math.max(0, isFinite(totalEstimatedCost) ? totalEstimatedCost : 0);
  const clean = sources.map((s) => ({
    ...s,
    amount: isFinite(s.amount) ? Math.max(0, s.amount) : 0,
  }));
  const gap = computeFundingGap(total, clean);
  const funded = gap.totalEligibleCost + gap.totalExternalGrants;
  const rawGap = total - funded;

  const confirmed = computeFundingGap(
    total,
    clean.filter((s) => s.confirmed),
  );

  return {
    ...gap,
    rawGap,
    overFunded: Math.max(0, -rawGap),
    coveragePct: total > 0 ? Math.min(100, (funded / total) * 100) : 0,
    confirmedLocalBurden: confirmed.localBurden,
    localBurdenRange: [
      Math.max(0, total * CLASS_D_LOW_FACTOR - funded),
      Math.max(0, total * CLASS_D_HIGH_FACTOR - funded),
    ],
  };
}
