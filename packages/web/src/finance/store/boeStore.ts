/**
 * Basis of Estimate store — the BOE record for the current Class D estimate.
 * Saved in the browser for now; moves to a Supabase `basis_of_estimate`
 * table later.
 */
import type { BasisOfEstimate } from '../types';
import { createPersistentStore } from './persistentStore';
import { newId } from '../utils/calculations';

export function makeBlankBoe(): BasisOfEstimate {
  return {
    id: newId(),
    incidentId: 'Clearwater Ridge Wildfire',
    estimateClass: 'D',
    preparedBy: '',
    reviewedBy: '',
    preparedDate: new Date().toISOString().slice(0, 10),
    scopeDescription: '',
    assumptions: [],
    exclusions: [],
    accuracyRangePct: [-50, 100],
    costLines: [],
    revision: 0,
    status: 'draft',
  };
}

const store = createPersistentStore<BasisOfEstimate>(
  'ppost.finance.boe.v1',
  makeBlankBoe(),
  (v) => !!v && typeof v === 'object' && Array.isArray((v as BasisOfEstimate).assumptions),
);

export const useBoe = store.use;
export const getBoe = store.get;
export const setBoe = store.set;
