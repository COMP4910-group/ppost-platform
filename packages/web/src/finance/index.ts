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
export {
  ClassDEstimator,
  RateTable,
  FundingGapCalculator,
  BasisOfEstimateForm,
} from './components';
export type {
  ClassDEstimatorProps,
  RateTableProps,
  FundingGapCalculatorProps,
  BasisOfEstimateFormProps,
} from './components';

// ─── Rates ────────────────────────────────────────────────────────────────────
export { effectiveRate, applyRateToLine } from './utils/rates';
export {
  useRates,
  getRates,
  addRate,
  updateRate,
  deleteRate,
  resetRates,
} from './store/rateStore';
export { DEFAULT_RATES } from './data/defaultRates';

// ─── Estimate + funding state ─────────────────────────────────────────────────
export {
  getEstimateLines,
  setEstimateLines,
  useEstimateLines,
  useEstimateTotal,
} from './store/estimateStore';
export {
  useFunding,
  getFunding,
  addFundingSource,
  updateFundingSource,
  deleteFundingSource,
  setTotalOverride,
} from './store/fundingStore';
export type { FundingState } from './store/fundingStore';
export { computeFundingSummary } from './utils/funding';
export type { FundingSummary } from './utils/funding';

// ─── Basis of Estimate ────────────────────────────────────────────────────────
export { useBoe, getBoe, setBoe, makeBlankBoe } from './store/boeStore';
export {
  boeChecklist,
  canSubmitForReview,
  reviewerProblem,
  accuracyBounds,
  estimateChangedSinceSnapshot,
} from './utils/boe';
export type { ChecklistItem } from './utils/boe';
