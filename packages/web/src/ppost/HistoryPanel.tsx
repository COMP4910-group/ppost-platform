/**
 * Change history from the server: who changed what, and when.
 *  - <SyncStatusChip/>  "Saved to server · 10:42" / "Saving…" / "Offline — 3 waiting"
 *  - <HistoryPanel kind recordId/>  collapsible history of one record or question
 *  - <ActivityLog onClose/>  drawer with the latest changes across the whole event
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

/** Drawer with the latest changes for the whole event, filterable by type and person. */
export function ActivityLog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<RecordKind | ''>('');
  const { rows, error, reload } = useHistory(true, { kind: kind || undefined, limit: 200 });
  const [who, setWho] = useState('');
  const people = Array.from(new Set((rows ?? []).map((r) => r.user ?? 'unknown user')));
  const shown = (rows ?? []).filter((r) => !who || (r.user ?? 'unknown user') === who);
  return (
    <Drawer onClose={onClose} width="w-[640px]"
      title={<div><div className="font-semibold text-white">Activity log</div>
        <div className="text-[11px] text-gray-400">Every saved change for {SYNC_EVENT_ID} — who, what and when (server time). Newest first.</div></div>}
      footer={<Button onClick={() => void reload()}>Refresh</Button>}>
      <div className="flex gap-2 mb-3">
        <select aria-label="Filter by type" className={`${inputCls} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as RecordKind | '')}>
          <option value="">All types</option>
          {(Object.keys(KIND_LABEL) as RecordKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select aria-label="Filter by person" className={`${inputCls} w-auto`} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-yellow-300">{error}</p>}
      {!error && rows === null && <p className="text-xs text-gray-500">Loading…</p>}
      {!error && rows && shown.length === 0 && <p className="text-xs text-gray-500">No changes yet.</p>}
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
