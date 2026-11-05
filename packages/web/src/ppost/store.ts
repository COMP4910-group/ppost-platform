/**
 * PPOST workspace store — one shared source of truth for the Recovery Matrix
 * and PPOST Workspace pages. Saves to the browser (localStorage) for now.
 *
 * Later: replace load()/save() with Supabase calls; the pages won't change.
 */
import { useSyncExternalStore } from 'react';
import { Objective, Priority, Problem, Strategy, Tactic } from 'ppost-engine';
import { PpostState, SEED } from './seedData';

export type EntityKind = 'problem' | 'objective' | 'strategy' | 'tactic';

const KEY = 'ppost-workspace-v1';

function load(): PpostState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as PpostState;
  } catch {
    /* storage unavailable — fall back to seed data */
  }
  return SEED;
}

let state: PpostState = load();
const listeners = new Set<() => void>();

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore — data stays in memory */
  }
}

function set(next: PpostState) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** React hook: re-renders whenever the PPOST data changes. */
export function usePpost(): PpostState {
  return useSyncExternalStore(subscribe, () => state);
}

const PREFIX: Record<EntityKind, string> = { problem: 'P', objective: 'O', strategy: 'S', tactic: 'T' };
const LIST: Record<EntityKind, keyof Omit<PpostState, 'priorities'>> = {
  problem: 'problems', objective: 'objectives', strategy: 'strategies', tactic: 'tactics',
};

/** Next free ID, e.g. P-11, O-11, S-15, T-025. */
export function nextId(kind: EntityKind): string {
  const nums = (state[LIST[kind]] as { id: string }[])
    .map((r) => parseInt(r.id.split('-')[1], 10))
    .filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const width = kind === 'tactic' ? 3 : 2;
  return `${PREFIX[kind]}-${String(n).padStart(width, '0')}`;
}

type AnyRecord = Problem | Objective | Strategy | Tactic;

/** Create or update a record (matched by id). */
export function upsert(kind: EntityKind, record: AnyRecord) {
  const key = LIST[kind];
  const list = state[key] as AnyRecord[];
  const now = new Date().toISOString();
  const exists = list.some((r) => r.id === record.id);
  const saved = { ...record, updatedAt: now, createdAt: exists ? record.createdAt : now };
  set({
    ...state,
    [key]: exists ? list.map((r) => (r.id === record.id ? saved : r)) : [...list, saved],
  });
}

/** Archive instead of delete — nothing is ever thrown away. */
export function archive(kind: EntityKind, id: string) {
  const key = LIST[kind];
  const list = state[key] as AnyRecord[];
  set({
    ...state,
    [key]: list.map((r) => (r.id === id ? { ...r, status: 'ARCHIVED', updatedAt: new Date().toISOString() } : r)),
  });
}

export function setPriorities(priorities: Priority[]) {
  set({ ...state, priorities });
}

/** Restore the synthetic demo data. */
export function resetDemoData() {
  set(SEED);
}

export function getState() {
  return state;
}
