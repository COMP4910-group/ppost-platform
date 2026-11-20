/**
 * Change history from the server: who changed what, and when.
 *  - <SyncStatusChip/>  "Saved to server · 10:42" / "Saving…" / "Offline — 3 waiting"
 *  - <HistoryPanel kind recordId/>  collapsible history of one record or question
 *  - <ActivityLog onClose/>  side panel with the latest changes (whole event, or Impact Assessment only)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { fetchHistory, HistoryEntry, NotSignedInError, RecordKind } from './api';
import { onSaved, safeId, SYNC_EVENT_ID, useSyncStatus } from './sync';
import { Button, Drawer, inputCls } from './ui';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const ACTION_LABEL: Record<HistoryEntry['action'], { text: string; cls: string }> = {
  create: { text: 'Created', cls: 'text-green-300' },
  update: { text: 'Changed', cls: 'text-blue-300' },
  delete: { text: 'Removed', cls: 'text-red-300' },
  restore: { text: 'Restored', cls: 'text-yellow-300' },
};

const KIND_LABEL: Record<RecordKind, string> = {
  priority: 'Priority', problem: 'Problem', objective: 'Objective', strategy: 'Strategy', tactic: 'Tactic',
  task: 'Task', cost: 'Cost entry', answer: 'Assessment answer', link: 'Question → problem link',
  ai_question: 'AI question', insight: 'AI insight', meta: 'Assessment info',
};

/** Value at "a.b.c" inside an object. */
function at(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function show(v: any): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'string') return v.length > 120 ? `${v.slice(0, 120)}…` : v;
  const s = JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** Fields that only change because something else changed (not worth listing). */
const NOISE = new Set(['updatedAt']);
/** Fields not worth showing on a "Created" line. */
const CREATE_HIDE = new Set(['id', 'questionId', 'createdAt', 'updatedAt', 'disasterId', 'source']);

export function HistoryEntryRow({ e, showRecord = false }: { e: HistoryEntry; showRecord?: boolean }) {
  const a = ACTION_LABEL[e.action];
  const fields = e.changed_fields.filter((f) => !NOISE.has(f));
  return (
    <li className="border-b border-gray-800 py-2 text-xs" data-testid="history-entry">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={`font-semibold ${a.cls}`}>{a.text}</span>
        {showRecord && (
          <span className="text-gray-300">
            {KIND_LABEL[e.kind] ?? e.kind} <span className="font-mono text-gray-400">{e.record_id}</span>
          </span>
        )}
        <span className="text-gray-400">
          by <span className="text-white">{e.user ?? 'unknown user'}</span> · {when(e.at)}
        </span>
        <span className="text-gray-600">v{e.version}</span>
      </div>
      {e.reason && <div className="text-gray-500 italic mt-0.5">{e.reason}</div>}
      {(e.action === 'create' || e.action === 'restore') && e.after && typeof e.after === 'object' && (
        <div className="mt-1 text-gray-400">
          {Object.entries(e.after)
            .filter(([k, v]) => !CREATE_HIDE.has(k) && v !== null && v !== '' && v !== false && typeof v !== 'object')
            .slice(0, 4)
            .map(([k, v]) => (
              <span key={k} className="mr-3"><span className="font-mono text-gray-300">{k}</span>: <span className="text-green-300">{show(v)}</span></span>
            ))}
        </div>
      )}
      {e.action === 'update' && fields.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {fields.slice(0, 8).map((f) => (
            <li key={f} className="text-gray-400">
              <span className="font-mono text-gray-300">{f}</span>: <span className="line-through text-red-300/80">{show(at(e.before, f))}</span>{' '}
              → <span className="text-green-300">{show(at(e.after, f))}</span>
            </li>
          ))}
          {fields.length > 8 && <li className="text-gray-500">…and {fields.length - 8} more fields</li>}
        </ul>
      )}
    </li>
  );
}

function useHistory(open: boolean, opts: { kind?: RecordKind; recordId?: string; limit?: number }) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { kind, recordId, limit } = opts;
  const load = useCallback(async () => {
    try {
      const res = await fetchHistory(SYNC_EVENT_ID, { kind, recordId: recordId ? safeId(recordId) : undefined, limit });
      setRows(res.changes);
      setError(null);
    } catch (e) {
      setError(e instanceof NotSignedInError ? 'Sign in to see the change history.' : 'Could not reach the server — history is unavailable right now.');
    }
  }, [kind, recordId, limit]);
  useEffect(() => {
    if (!open) return;
    void load();
    return onSaved(() => void load()); // refresh after each save
  }, [open, load]);
  return { rows, error, reload: load };
}

/** Collapsible history for one record (e.g. a tactic) or one assessment question. */
export function HistoryPanel({ kind, recordId, label = 'Change history' }: { kind: RecordKind; recordId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const { rows, error } = useHistory(open, { kind, recordId, limit: 50 });
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="text-[11px] text-gray-400 hover:text-white underline-offset-2 hover:underline">
        {open ? '▾' : '▸'} {label}
      </button>
      {open && (
        <div className="mt-1 rounded border border-gray-800 bg-gray-950 px-3 py-1">
          {error && <p className="text-[11px] text-yellow-300 py-2">{error}</p>}
          {!error && rows === null && <p className="text-[11px] text-gray-500 py-2">Loading…</p>}
          {!error && rows?.length === 0 && <p className="text-[11px] text-gray-500 py-2">No changes saved to the server yet.</p>}
          {!error && rows && rows.length > 0 && <ul>{rows.map((e) => <HistoryEntryRow key={e.id} e={e} />)}</ul>}
        </div>
      )}
    </div>
  );
}

/** Record types that belong to the Impact Assessment. */
export const ASSESSMENT_KINDS: RecordKind[] = ['answer', 'link', 'task', 'insight', 'ai_question', 'meta'];

const ACTION_FILTER: { value: HistoryEntry['action'] | ''; label: string }[] = [
  { value: '', label: 'All changes' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Changed' },
  { value: 'delete', label: 'Removed' },
  { value: 'restore', label: 'Restored' },
];

/** Does this change belong to question `qid`? (answers/links use the question id; tasks and insights carry it in their data) */
function aboutQuestion(e: HistoryEntry, qid: string): boolean {
  if (e.record_id === safeId(qid)) return true;
  const ref = (d: any) => d && (d.questionId === qid || (Array.isArray(d.suggestion?.sources) && d.suggestion.sources.includes(qid)));
  return ref(e.after) || ref(e.before);
}

/**
 * Side panel with the latest saved changes — who, what and when.
 * scope "assessment" limits it to Impact Assessment records and adds a question filter.
 */
export function ActivityLog({ onClose, scope = 'all', questions, initialQuestion, title = 'Activity log' }: {
  onClose: () => void;
  scope?: 'all' | 'assessment';
  /** Questions for the question filter (assessment scope). */
  questions?: { id: string; text: string }[];
  /** Open already filtered to this question. */
  initialQuestion?: string;
  title?: string;
}) {
  const kinds = scope === 'assessment' ? ASSESSMENT_KINDS : (Object.keys(KIND_LABEL) as RecordKind[]);
  const [kind, setKind] = useState<RecordKind | ''>('');
  const [who, setWho] = useState('');
  const [action, setAction] = useState<HistoryEntry['action'] | ''>('');
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const { rows, error, reload } = useHistory(true, { kind: kind || undefined, limit: scope === 'assessment' && !kind ? 500 : 200 });
  const inScope = (rows ?? []).filter((r) => kinds.includes(r.kind));
  const people = Array.from(new Set(inScope.map((r) => r.user ?? 'unknown user')));
  const shown = inScope.filter((r) =>
    (!who || (r.user ?? 'unknown user') === who)
    && (!action || r.action === action)
    && (!question || aboutQuestion(r, question)));
  const qText = questions?.find((q) => q.id === question)?.text;
  const subtitle = scope === 'assessment'
    ? 'Answers, notes, verification tasks and AI insight decisions — who changed what, and when. Newest first.'
    : `Every saved change for ${SYNC_EVENT_ID} — who, what and when (server time). Newest first.`;
  return (
    <Drawer onClose={onClose} width="w-[640px]"
      title={<div><div className="font-semibold text-white">{title}</div>
        <div className="text-[11px] text-gray-400">{subtitle}</div></div>}
      footer={<Button onClick={() => void reload()}>Refresh</Button>}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {scope === 'assessment' && questions && (
          <select aria-label="Filter by question" className={`${inputCls} col-span-2`} value={question} onChange={(e) => setQuestion(e.target.value)}>
            <option value="">All questions</option>
            {questions.map((q) => <option key={q.id} value={q.id}>{q.id} — {q.text.length > 70 ? `${q.text.slice(0, 70)}…` : q.text}</option>)}
          </select>
        )}
        <select aria-label="Filter by type" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as RecordKind | '')}>
          <option value="">All types</option>
          {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select aria-label="Filter by change" className={inputCls} value={action} onChange={(e) => setAction(e.target.value as HistoryEntry['action'] | '')}>
          {ACTION_FILTER.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select aria-label="Filter by person" className={`${inputCls} col-span-2`} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {question && qText && <p className="text-xs text-gray-300 mb-2">Showing history for <b>{question}</b>: {qText}</p>}
      {error && <p className="text-xs text-yellow-300">{error}</p>}
      {!error && rows === null && <p className="text-xs text-gray-500">Loading…</p>}
      {!error && rows && shown.length === 0 && <p className="text-xs text-gray-500">No changes match these filters yet.</p>}
      <ul>{shown.map((e) => <HistoryEntryRow key={e.id} e={e} showRecord />)}</ul>
    </Drawer>
  );
}

/** Small status chip for the page header. */
export function SyncStatusChip() {
  const st = useSyncStatus();
  const time = st.lastSavedAt ? new Date(st.lastSavedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  const view: Record<string, { text: string; cls: string; title: string }> = {
    off: { text: 'Server sync off', cls: 'text-gray-400 border-gray-700', title: 'Not connected to the backend yet.' },
    'signed-out': { text: 'Not signed in — saved in this browser only', cls: 'text-yellow-300 border-yellow-800', title: 'Log in so changes are saved to the server with your name.' },
    connecting: { text: 'Connecting…', cls: 'text-gray-300 border-gray-700', title: 'Loading saved data from the server.' },
    saving: { text: `Saving… (${st.pending})`, cls: 'text-blue-300 border-blue-800', title: 'Sending changes to the server.' },
    saved: { text: `Saved to server${time ? ` · ${time}` : ''}`, cls: 'text-green-300 border-green-800', title: 'All changes are saved on the server.' },
    offline: { text: `Offline — ${st.pending} waiting`, cls: 'text-yellow-300 border-yellow-800', title: 'Server not reachable. Changes are kept and sent automatically when it is back.' },
    error: { text: 'Some changes were rejected', cls: 'text-red-300 border-red-800', title: st.error ?? 'The server refused a change.' },
  };
  const v = view[st.mode];
  return (
    <span role="status" title={v.title} className={`text-[11px] px-2 py-1 rounded border ${v.cls}`} data-testid="sync-status">
      {v.text}
    </span>
  );
}
