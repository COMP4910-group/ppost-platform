/**
 * Rate store
 *
 * Holds the rate table in one place so every screen (Rate Table editor,
 * Class D Estimator) sees the same rates.
 *
 * For now rates are kept in the browser (localStorage) so they survive a
 * page refresh. When the Supabase `rates` table exists, swap the
 * load/save functions below for Supabase calls — the components won't
 * need to change.
 */
import { useSyncExternalStore } from 'react';
import type { RateEntry } from '../types';
import { DEFAULT_RATES } from '../data/defaultRates';
import { newId } from '../utils/calculations';

const STORAGE_KEY = 'ppost.finance.rates.v1';

function load(): RateEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as RateEntry[];
    }
  } catch {
    // storage unavailable or corrupted — fall back to defaults
  }
  return DEFAULT_RATES;
}

function save(next: RateEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — rates still work for this session
  }
}

let rates: RateEntry[] = load();
const listeners = new Set<() => void>();

function setRates(next: RateEntry[]): void {
  rates = next;
  save(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RateEntry[] {
  return rates;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** React hook: returns the current rate table and re-renders on change. */
export function useRates(): RateEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getRates(): RateEntry[] {
  return rates;
}

export function addRate(partial: Partial<RateEntry> = {}): RateEntry {
  const entry: RateEntry = {
    id: newId(),
    category: 'labour',
    resource: '',
    unit: 'hr',
    baseRate: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
    ...partial,
  };
  setRates([...rates, entry]);
  return entry;
}

export function updateRate(updated: RateEntry): void {
  setRates(rates.map((r) => (r.id === updated.id ? updated : r)));
}

export function deleteRate(id: string): void {
  setRates(rates.filter((r) => r.id !== id));
}

/** Throw away all edits and go back to the starter rates. */
export function resetRates(): void {
  setRates(DEFAULT_RATES);
}
