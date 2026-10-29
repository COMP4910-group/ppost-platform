// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  CostCategory,
  CostLine,
  RateEntry,
  BasisOfEstimate,
  FundingSource,
  FundingGap,
  CategorySubtotals,
} from './types';
export { COST_CATEGORY_LABELS } from './types';

// ─── Calculation utilities ────────────────────────────────────────────────────
export {
  computeLineCost,
  recalculateLine,
  computeSubtotals,
  computeGrandTotal,
  computeFundingGap,
  formatCurrency,
  formatDuration,
  newId,
} from './utils/calculations';

// ─── Components ───────────────────────────────────────────────────────────────
export { ClassDEstimator } from './components';
export type { ClassDEstimatorProps } from './components';
