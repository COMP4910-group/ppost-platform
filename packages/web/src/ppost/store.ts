/**
 * PPOST workspace store — one shared source of truth for the Recovery Matrix,
 * PPOST Workspace and Impact Assessment pages. Saves to the browser (localStorage) for now.
 *
 * Later: replace load()/save() with Supabase calls; the pages won't change.
 */
import { useSyncExternalStore } from 'react';
import { Answer, Objective, Priority, Problem, Strategy, Tactic, VerificationTask } from 'ppost-engine';
import { CostEntry, PpostState, SEED, SEED_COSTS } from './seedData';
import type { QuestionUI } from './assessmentQuestions';
import type { PpostSuggestion } from './aiSuggestions';

export interface InsightState {
  status: 'added' | 'drafted' | 'dismissed';
  /** Record created from it (problem / tactic / task id). */
  recordId?: string;
  reason?: string;
}

export type { CostEntry } from './seedData';

export type EntityKind = 'problem' | 'objective' | 'strategy' | 'tactic';
export type AnyRecord = Problem | Objective | Strategy | Tactic;

/** Unsaved form contents, kept until the user saves or presses Cancel. */
export interface EditorDraft {
  kind: EntityKind;
  record: AnyRecord;
  /** The record as it was before editing (to tell whether anything changed). */
  baseline: AnyRecord;
  isNew: boolean;
  savedAt: string;
}

export interface AssessmentState {
  answers: Record<string, Answer | undefined>;
  notes: Record<string, string>;
  /** Situation facts the user confirmed as answers (question id → true). */
  confirmedFromSituation: Record<string, boolean>;
  /** Question id → problem already recorded in PPOST for it (prevents duplicates). */
  linked: Record<string, string>;
  /** Questions whose "deeper questions" are open. */
  expanded: Record<string, boolean>;
  /** Questions suggested by the AI from uploaded documents (empty until the AI is connected). */
  aiQuestions: QuestionUI[];
  /** AI "deeper / hidden task" insights for this assessment, and what the user did with each. */
  insights: PpostSuggestion[];
  insightsFrom?: 'AI' | 'SAMPLE';
  insightsAt?: string;
  insightState: Record<string, InsightState>;
}

export interface StoreState extends PpostState {
  drafts: Record<string, EditorDraft>;
  assessment: AssessmentState;
  tasks: VerificationTask[];
  /** Append-only cost history per tactic (allowances, Class D revisions…). Never edited, only added to. */
  costs: CostEntry[];
}

const KEY = 'ppost-workspace-v1';

const EMPTY_EXTRAS = {
  drafts: {} as Record<string, EditorDraft>,
  assessment: {
    answers: {}, notes: {}, confirmedFromSituation: {}, expanded: {}, aiQuestions: [], insights: [], insightState: {},
    // demo problems that were entered before the assessment existed
    linked: { 'Q-H01': 'P-02', 'Q-H02': 'P-04', 'Q-W03': 'P-05', 'Q-H07': 'P-06', 'Q-HW01': 'P-07', 'Q-R01': 'P-08', 'Q-E01': 'P-09', 'Q-EC01': 'P-10' },
  } as AssessmentState,
  tasks: [] as VerificationTask[],
  costs: SEED_COSTS,
};
const initial = (): StoreState => ({ ...SEED, ...EMPTY_EXTRAS });

function load(): StoreState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // older saves don't have drafts/assessment/tasks yet
      return { ...initial(), ...saved, assessment: { ...EMPTY_EXTRAS.assessment, ...saved.assessment } };
    }
  } catch {
    /* storage unavailable or corrupt — fall back to seed data */
  }
  return initial();
}

let state: StoreState = load();
const listeners = new Set<() => void>();

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore — data stays in memory */
  }
}

function set(next: StoreState) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** React hook: re-renders whenever the PPOST data changes. */
export function usePpost(): StoreState {
  return useSyncExternalStore(subscribe, () => state);
}

export function getState() {
  return state;
}

const PREFIX: Record<EntityKind, string> = { problem: 'P', objective: 'O', strategy: 'S', tactic: 'T' };
const LIST: Record<EntityKind, 'problems' | 'objectives' | 'strategies' | 'tactics'> = {
  problem: 'problems', objective: 'objectives', strategy: 'strategies', tactic: 'tactics',
};

/** Next free ID, e.g. P-11, O-11, S-15, T-025 (skips IDs held by unsaved drafts). */
export function nextId(kind: EntityKind): string {
  const ids = [
    ...(state[LIST[kind]] as { id: string }[]).map((r) => r.id),
    ...Object.values(state.drafts).filter((d) => d.kind === kind).map((d) => d.record.id),
  ];
  const nums = ids.map((id) => parseInt(id.split('-')[1], 10)).filter((n) => !isNaN(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${PREFIX[kind]}-${String(n).padStart(kind === 'tactic' ? 3 : 2, '0')}`;
}

/* ---------- records ---------- */

/** Create or update a record (matched by id). Also clears its unsaved draft. */
export function upsert(kind: EntityKind, record: AnyRecord) {
  const key = LIST[kind];
  const list = state[key] as AnyRecord[];
  const now = new Date().toISOString();
  const exists = list.some((r) => r.id === record.id);
  const saved = { ...record, updatedAt: now, createdAt: exists ? record.createdAt : now };
  const { [record.id]: _done, ...drafts } = state.drafts;
  set({
    ...state,
    drafts,
    [key]: exists ? list.map((r) => (r.id === record.id ? saved : r)) : [...list, saved],
  });
}

/** Add several records at once; existing IDs are left untouched. Returns how many were added. */
export function addMany(items: { kind: EntityKind; record: AnyRecord }[]): number {
  let next = { ...state };
  let added = 0;
  for (const { kind, record } of items) {
    const key = LIST[kind];
    const list = next[key] as AnyRecord[];
    if (list.some((r) => r.id === record.id)) continue;
    next = { ...next, [key]: [...list, record] };
    added++;
  }
  set(next);
  return added;
}

/** Archive instead of delete — nothing is ever thrown away. */
export function archive(kind: EntityKind, id: string) {
  const key = LIST[kind];
  const list = state[key] as AnyRecord[];
  const { [id]: _done, ...drafts } = state.drafts;
  set({
    ...state,
    drafts,
    [key]: list.map((r) => (r.id === id ? { ...r, status: 'ARCHIVED', updatedAt: new Date().toISOString() } : r)),
  });
}

export function setPriorities(priorities: Priority[]) {
  set({ ...state, priorities });
}

/* ---------- unsaved drafts ---------- */

export function saveDraft(kind: EntityKind, record: AnyRecord, baseline: AnyRecord, isNew: boolean) {
  set({ ...state, drafts: { ...state.drafts, [record.id]: { kind, record, baseline, isNew, savedAt: new Date().toISOString() } } });
}

export function discardDraft(id: string) {
  if (!state.drafts[id]) return;
  const { [id]: _gone, ...drafts } = state.drafts;
  set({ ...state, drafts });
}

/* ---------- assessment ---------- */

export function setAnswer(questionId: string, answer: Answer | undefined) {
  set({ ...state, assessment: { ...state.assessment, answers: { ...state.assessment.answers, [questionId]: answer } } });
}

export function setNote(questionId: string, note: string) {
  set({ ...state, assessment: { ...state.assessment, notes: { ...state.assessment.notes, [questionId]: note } } });
}

export function confirmFromSituation(questionId: string, answer: Answer) {
  set({
    ...state,
    assessment: {
      ...state.assessment,
      answers: { ...state.assessment.answers, [questionId]: answer },
      confirmedFromSituation: { ...state.assessment.confirmedFromSituation, [questionId]: true },
    },
  });
}

export function linkQuestions(map: Record<string, string>) {
  set({ ...state, assessment: { ...state.assessment, linked: { ...state.assessment.linked, ...map } } });
}

export function addTasks(tasks: VerificationTask[]): number {
  const fresh = tasks.filter((t) => !state.tasks.some((x) => x.id === t.id));
  if (fresh.length) set({ ...state, tasks: [...state.tasks, ...fresh] });
  return fresh.length;
}

export function setAiQuestions(qs: QuestionUI[]) {
  set({ ...state, assessment: { ...state.assessment, aiQuestions: qs } });
}

export function setInsights(insights: PpostSuggestion[], from: 'AI' | 'SAMPLE') {
  set({ ...state, assessment: { ...state.assessment, insights, insightsFrom: from, insightsAt: new Date().toISOString() } });
}

export function markInsight(id: string, st: InsightState) {
  set({ ...state, assessment: { ...state.assessment, insightState: { ...state.assessment.insightState, [id]: st } } });
}

export function clearInsight(id: string) {
  const { [id]: _gone, ...rest } = state.assessment.insightState;
  set({ ...state, assessment: { ...state.assessment, insightState: rest } });
}

export function setExpanded(questionId: string, open: boolean) {
  set({ ...state, assessment: { ...state.assessment, expanded: { ...state.assessment.expanded, [questionId]: open } } });
}

/* ---------- costs ---------- */

let costSeq = 0;
/** Adds a new cost entry for a tactic. Earlier entries are kept as history. */
export function recordCost(entry: Omit<CostEntry, 'id' | 'at'> & { at?: string }): CostEntry {
  const saved: CostEntry = { ...entry, id: `C-${Date.now()}-${++costSeq}`, at: entry.at ?? new Date().toISOString() };
  set({ ...state, costs: [...state.costs, saved] });
  return saved;
}

/** Restore the synthetic demo data (clears drafts and assessment answers too). */
export function resetDemoData() {
  set(initial());
}
