/**
 * Funding store — funding sources for the Funding Gap Calculator, plus an
 * optional manual override of the total estimated cost.
 */
import type { FundingSource } from '../types';
import { createPersistentStore } from './persistentStore';
import { newId } from '../utils/calculations';

export interface FundingState {
  sources: FundingSource[];
  /** null = use the Class D estimate total */
  totalOverride: number | null;
}

const store = createPersistentStore<FundingState>(
  'ppost.finance.funding.v1',
  { sources: [], totalOverride: null },
  (v) => !!v && typeof v === 'object' && Array.isArray((v as FundingState).sources),
);

export const useFunding = store.use;
export const getFunding = store.get;

export function addFundingSource(type: FundingSource['type']): void {
  const s = store.get();
  store.set({
    ...s,
    sources: [
      ...s.sources,
      { id: newId(), name: '', type, amount: 0, confirmed: false },
    ],
  });
}

export function updateFundingSource(updated: FundingSource): void {
  const s = store.get();
  store.set({ ...s, sources: s.sources.map((x) => (x.id === updated.id ? updated : x)) });
}

export function deleteFundingSource(id: string): void {
  const s = store.get();
  store.set({ ...s, sources: s.sources.filter((x) => x.id !== id) });
}

export function setTotalOverride(total: number | null): void {
  store.set({ ...store.get(), totalOverride: total });
}
