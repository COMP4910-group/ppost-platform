/**
 * Keeps the PPOST store in step with the Django backend.
 *
 *  - After login the saved data is loaded from the server (GET /state/).
 *    The very first time (server empty) everything in this browser is uploaded.
 *  - Every change in the store (answer, note, new/edited/archived record, cost entry,
 *    AI insight decision…) is turned into a small "change" and sent to the server
 *    (POST /changes/). The server records WHO made it, WHEN (server clock),
 *    which fields changed, and the values before and after.
 *  - If the server can't be reached, changes wait in a queue (kept in localStorage)
 *    and are sent as soon as it is back.
 *
 * The pages keep using usePpost()/upsert()/setAnswer()… exactly as before.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { Answer } from 'ppost-engine';
import { getState, replaceState, StoreState, subscribe as subscribeStore } from './store';
import { CURRENT_EVENT } from './seedData';
import {
  ChangeIn, fetchState, hasLogin, NotSignedInError, postChanges, RecordKind, ServerError, ServerRecord,
} from './api';

export const SYNC_EVENT_ID = CURRENT_EVENT.id;
const QUEUE_KEY = 'ppost-sync-queue-v1';
const DEBOUNCE_MS = 1000;
const BATCH = 200;
const RETRY_MS = 15000;

/* ------------------------------------------------------------------ */
/* store  <->  server records                                          */
/* ------------------------------------------------------------------ */

export interface SyncRecord {
  kind: RecordKind;
  record_id: string;
  data: any;
}

/** The server accepts ids made of letters, digits and _ . : - (max 80). */
export function safeId(id: string): string {
  const clean = String(id).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);
  return clean || '_';
}

const keyOf = (kind: string, id: string) => `${kind}|${id}`;

/** Every piece of PPOST data, as separate server records. Drafts and open/closed UI state stay local. */
export function toRecords(s: StoreState): Map<string, SyncRecord> {
  const out = new Map<string, SyncRecord>();
  const put = (kind: RecordKind, id: string, data: any) => {
    const record_id = safeId(id);
    out.set(keyOf(kind, record_id), { kind, record_id, data });
  };
  s.priorities.forEach((r) => put('priority', r.id, r));
  s.problems.forEach((r) => put('problem', r.id, r));
  s.objectives.forEach((r) => put('objective', r.id, r));
  s.strategies.forEach((r) => put('strategy', r.id, r));
  s.tactics.forEach((r) => put('tactic', r.id, r));
  (s.tasks || []).forEach((r) => put('task', r.id, r));
  (s.costs || []).forEach((r) => put('cost', r.id, r));

  const a = s.assessment;
  const qids = new Set([...Object.keys(a.answers), ...Object.keys(a.notes), ...Object.keys(a.confirmedFromSituation)]);
  qids.forEach((q) =>
    put('answer', q, {
      questionId: q,
      answer: a.answers[q] ?? null,
      note: a.notes[q] ?? '',
      confirmedFromSituation: !!a.confirmedFromSituation[q],
    }),
  );
  Object.entries(a.linked).forEach(([q, problemId]) => put('link', q, { questionId: q, problemId }));
  (a.aiQuestions || []).forEach((q) => put('ai_question', q.id, q));
  const insightIds = new Set([...(a.insights || []).map((i) => i.id), ...Object.keys(a.insightState || {})]);
  insightIds.forEach((id) =>
    put('insight', id, {
      id,
      suggestion: (a.insights || []).find((i) => i.id === id) ?? null,
      state: a.insightState?.[id] ?? null,
    }),
  );
  if (a.insightsAt) put('meta', 'assessment', { insightsFrom: a.insightsFrom ?? null, insightsAt: a.insightsAt });
  return out;
}

/** Build the store from the server's records. Drafts and UI state are kept from `base`. */
export function fromRecords(records: { kind: string; data: any }[], base: StoreState): StoreState {
  const of = (k: string) => records.filter((r) => r.kind === k).map((r) => r.data);
  const answers: Record<string, Answer | undefined> = {};
  const notes: Record<string, string> = {};
  const confirmed: Record<string, boolean> = {};
  of('answer').forEach((d) => {
    if (d.answer) answers[d.questionId] = d.answer;
    if (d.note) notes[d.questionId] = d.note;
    if (d.confirmedFromSituation) confirmed[d.questionId] = true;
  });
  const linked: Record<string, string> = {};
  of('link').forEach((d) => (linked[d.questionId] = d.problemId));
  const insightRecs = of('insight');
  const insightState: StoreState['assessment']['insightState'] = {};
  insightRecs.forEach((d) => {
    if (d.state) insightState[d.id] = d.state;
  });
  const meta = of('meta')[0];
  return {
    ...base,
    priorities: of('priority').sort((x, y) => x.rank - y.rank),
    problems: of('problem'),
    objectives: of('objective'),
    strategies: of('strategy'),
    tactics: of('tactic'),
    tasks: of('task'),
    costs: of('cost').sort((x, y) => String(x.at).localeCompare(String(y.at))),
    assessment: {
      ...base.assessment,
      answers,
      notes,
      confirmedFromSituation: confirmed,
      linked,
      aiQuestions: of('ai_question'),
      insights: insightRecs.map((d) => d.suggestion).filter(Boolean),
      insightState,
      insightsFrom: meta?.insightsFrom ?? undefined,
      insightsAt: meta?.insightsAt ?? undefined,
    },
  };
}

/** JSON with sorted keys, so the same data always gives the same text. */
export function stableStringify(v: any): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v)
    .filter((k) => v[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
    .join(',')}}`;
}

/** Changes needed to go from `before` (what the server has) to `after` (the store now). */
export function diffRecords(before: Map<string, string>, after: Map<string, SyncRecord>, reason = ''): ChangeIn[] {
  const at = new Date().toISOString();
  const changes: ChangeIn[] = [];
  after.forEach((rec, key) => {
    if (before.get(key) !== stableStringify(rec.data)) {
      changes.push({ kind: rec.kind, record_id: rec.record_id, action: 'upsert', data: rec.data, client_at: at, reason });
    }
  });
  before.forEach((_, key) => {
    if (!after.has(key)) {
      const [kind, record_id] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)];
      changes.push({ kind: kind as RecordKind, record_id, action: 'delete', client_at: at, reason });
    }
  });
  return changes;
}

const snapshotOf = (m: Map<string, SyncRecord>) => {
  const s = new Map<string, string>();
  m.forEach((r, k) => s.set(k, stableStringify(r.data)));
  return s;
};

/* ------------------------------------------------------------------ */
/* status (shown in the "Saved to server" chip)                         */
/* ------------------------------------------------------------------ */

export type SyncMode = 'off' | 'signed-out' | 'connecting' | 'saving' | 'saved' | 'offline' | 'error';
export interface SyncStatus {
  mode: SyncMode;
  /** Changes not yet confirmed by the server. */
  pending: number;
  lastSavedAt?: string;
  error?: string;
}

let status: SyncStatus = { mode: 'off', pending: 0 };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch, pending: queue.length + sending.length };
  statusListeners.forEach((l) => l());
}
export function getSyncStatus() {
  return status;
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => {
        statusListeners.delete(l);
      };
    },
    () => status,
  );
}

/* ------------------------------------------------------------------ */
/* queue + engine                                                       */
/* ------------------------------------------------------------------ */

let queue: ChangeIn[] = loadQueue();
let sending: ChangeIn[] = [];
let snapshot = new Map<string, string>();
let hydrated = false;
let applying = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setInterval> | undefined;
let users = 0;
let unsubscribeStore: (() => void) | undefined;
/** Listeners notified after each successful save (history panels refresh themselves). */
const savedListeners = new Set<() => void>();
export function onSaved(l: () => void) {
  savedListeners.add(l);
  return () => {
    savedListeners.delete(l);
  };
}

function loadQueue(): ChangeIn[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveQueue() {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...sending, ...queue]));
  } catch {
    /* ignore */
  }
}

function enqueue(changes: ChangeIn[]) {
  if (!changes.length) return;
  queue = [...queue, ...changes];
  saveQueue();
  setStatus({});
}

/** Compare the store with what the server has and queue the differences. */
function captureChanges(reason = '') {
  const cur = toRecords(getState());
  const changes = diffRecords(snapshot, cur, reason);
  snapshot = snapshotOf(cur);
  enqueue(changes);
}

function onStoreChange() {
  if (!hydrated || applying) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    captureChanges();
    void flush();
  }, DEBOUNCE_MS);
}

/** Send waiting changes to the server. Safe to call any time. */
export async function flush(): Promise<void> {
  if (sending.length || !queue.length) return;
  if (!hasLogin()) {
    setStatus({ mode: 'signed-out' });
    return;
  }
  sending = queue.slice(0, BATCH);
  queue = queue.slice(sending.length);
  setStatus({ mode: 'saving' });
  try {
    const res = await postChanges(SYNC_EVENT_ID, sending);
    sending = [];
    saveQueue();
    setStatus({ mode: queue.length ? 'saving' : 'saved', lastSavedAt: res.server_time, error: undefined });
    savedListeners.forEach((l) => l());
    if (queue.length) await flush();
  } catch (e) {
    if (e instanceof ServerError) {
      // the server refused this batch (bad data) — drop it so the rest can go through
      // eslint-disable-next-line no-console
      console.error('[ppost sync] server rejected changes', e.message, sending);
      sending = [];
      saveQueue();
      setStatus({ mode: 'error', error: e.message });
    } else {
      queue = [...sending, ...queue];
      sending = [];
      saveQueue();
      setStatus({ mode: e instanceof NotSignedInError ? 'signed-out' : 'offline' });
    }
  }
}

/** Load the saved data from the server (first time: upload what this browser has). */
export async function hydrate(): Promise<void> {
  if (!hasLogin()) {
    hydrated = false;
    setStatus({ mode: 'signed-out' });
    return;
  }
  setStatus({ mode: 'connecting' });
  try {
    await flush(); // anything left from last time goes first
    if (queue.length || sending.length) return; // still offline — keep working locally
    const { records, server_time } = await fetchState(SYNC_EVENT_ID);
    if (!records.length) {
      snapshot = new Map();
      hydrated = true;
      captureChanges('First upload of the data in this browser');
      await flush();
      return;
    }
    applyServer(records);
    hydrated = true;
    setStatus({ mode: 'saved', lastSavedAt: server_time, error: undefined });
  } catch (e) {
    setStatus({ mode: e instanceof NotSignedInError ? 'signed-out' : e instanceof ServerError ? 'error' : 'offline', error: (e as Error).message });
  }
}

function applyServer(records: ServerRecord[]) {
  const next = fromRecords(records, getState());
  const nextRecs = toRecords(next);
  const nextSnap = snapshotOf(nextRecs);
  const curSnap = snapshotOf(toRecords(getState()));
  snapshot = nextSnap;
  const same = nextSnap.size === curSnap.size && Array.from(nextSnap).every(([k, v]) => curSnap.get(k) === v);
  if (same) return;
  applying = true;
  try {
    replaceState(next);
  } finally {
    applying = false;
  }
}

/** Pick up changes made by teammates (on window focus). */
async function refreshFromServer() {
  if (!hydrated || queue.length || sending.length || timer) return;
  try {
    const { records } = await fetchState(SYNC_EVENT_ID);
    if (queue.length || sending.length || timer) return; // user edited meanwhile
    applyServer(records);
  } catch {
    /* ignore — next focus will try again */
  }
}

const onFocus = () => void refreshFromServer();
const onOnline = () => void (hydrated ? flush() : hydrate());
const onLogin = () => {
  hydrated = false;
  void hydrate();
};

/** Start syncing (idempotent; pages call it through useServerSync). */
export function startSync() {
  users++;
  if (users > 1) return;
  unsubscribeStore = subscribeStore(onStoreChange);
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  window.addEventListener('auth:login', onLogin);
  retryTimer = setInterval(() => {
    if (!hasLogin()) return;
    if (!hydrated) void hydrate();
    else if (queue.length) void flush();
  }, RETRY_MS);
  void hydrate();
}

export function stopSync() {
  users = Math.max(0, users - 1);
  if (users > 0) return;
  unsubscribeStore?.();
  window.removeEventListener('focus', onFocus);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('auth:login', onLogin);
  if (retryTimer) clearInterval(retryTimer);
  // keep pending edits: capture now, they go out on the next start
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
    if (hydrated) captureChanges();
  }
}

/** React hook used by the three PPOST pages. */
export function useServerSync() {
  useEffect(() => {
    startSync();
    return () => stopSync();
  }, []);
}

/** For tests only. */
export function __resetSyncForTests() {
  queue = [];
  sending = [];
  snapshot = new Map();
  hydrated = false;
  applying = false;
  users = 0;
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (retryTimer) clearInterval(retryTimer);
  unsubscribeStore?.();
  status = { mode: 'off', pending: 0 };
  try {
    window.localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
}
