/**
 * Estimate store — the current Class D estimate's cost lines.
 *
 * Shared so the Funding Gap Calculator can read the estimate total, and so
 * the estimate isn't lost when you switch pages.
 */
import type { CostLine } from '../types';
import { createPersistentStore } from './persistentStore';
import { computeGrandTotal, computeSubtotals } from '../utils/calculations';

const store = createPersistentStore<CostLine[]>(
  'ppost.finance.estimate.v1',
  [],
  Array.isArray,
);

export const getEstimateLines = store.get;
export const setEstimateLines = store.set;
export const useEstimateLines = store.use;

/** Total of the current Class D estimate. */
export function useEstimateTotal(): number {
  const lines = store.use();
  return computeGrandTotal(computeSubtotals(lines));
}
