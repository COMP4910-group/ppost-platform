/**
 * One drawer that edits any PPOST record: Problem, Objective, Strategy or Tactic.
 *
 * - Everything typed is kept automatically as an unsaved draft (closing with ×, Esc or
 *   clicking outside keeps it). Only "Cancel" throws the changes away.
 * - Tactics get the full 5W1H form; "Submit for review" runs the engine's validation.
 * - Errors are shown at the top AND next to the buttons, so they're never off-screen.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiveW1H, Objective, Problem, RecordStatus, SECTORS, SectorId, Severity, Strategy, Tactic, TimeHorizon, validateTactic,
} from 'ppost-engine';
import { archive, discardDraft, EntityKind, getState, saveDraft, StoreState, upsert, usePpost } from './store';
import { blankObjective, blankStrategy, blankTactic } from './records';
import { AiSuggestionsPanel } from './AiSuggestionsPanel';
import { PpostSuggestion, SuggestionRequest } from './aiSuggestions';
import { Button, Drawer, Field, HORIZON_LABEL, IdChip, inputCls, StatusBadge } from './ui';

export type EditorTarget =
  | { kind: 'problem'; record: Problem; isNew?: boolean }
  | { kind: 'objective'; record: Objective; isNew?: boolean }
  | { kind: 'strategy'; record: Strategy; isNew?: boolean }
  | { kind: 'tactic'; record: Tactic; isNew?: boolean };

const KIND_LABEL: Record<EntityKind, string> = { problem: 'Problem', objective: 'Objective', strategy: 'Strategy', tactic: 'Tactic' };
const STATUSES: RecordStatus[] = ['DRAFT', 'IN_REVIEW', 'APPROVED'];
const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const HORIZONS: TimeHorizon[] = ['IMMEDIATE', 'MID_TERM', 'LONG_TERM'];
const PEOPLE = ['J. Miller', 'A. Singh', 'R. Okafor', 'L. Tremblay', 'M. Chen'];
const FIELD_LABEL: Record<string, string> = {
  title: 'Title', who: 'WHO', what: 'WHAT', when: 'WHEN', where: 'WHERE', why: 'WHY', how: 'HOW', successMeasure: 'Success measure',
};

type Issue = { field: string; message: string };

/** Priority › Problem › Objective › Strategy for any record. */
export function lineage(target: EditorTarget, s: StoreState): string[] {
  const prio = (id?: string) => s.priorities.find((p) => p.id === id);
  const prob = (id?: string) => s.problems.find((p) => p.id === id);
  const obj = (id?: string) => s.objectives.find((o) => o.id === id);
  const strat = (id?: string) => s.strategies.find((x) => x.id === id);
  const pLabel = (id?: string) => { const p = prio(id); return p ? `P${p.rank} ${p.name}` : '—'; };
  switch (target.kind) {
    case 'problem': return [pLabel(target.record.priorityId)];
    case 'objective': {
      const pr = prob(target.record.problemIds[0]);
      return [pLabel(pr?.priorityId), pr?.id ?? '—'];
    }
    case 'strategy': {
      const o = obj(target.record.objectiveId); const pr = prob(o?.problemIds[0]);
      return [pLabel(pr?.priorityId), pr?.id ?? '—', o?.id ?? '—'];
    }
    case 'tactic': {
      const st = strat(target.record.strategyId); const o = obj(st?.objectiveId); const pr = prob(o?.problemIds[0]);
      return [pLabel(target.record.primaryPriorityId), pr?.id ?? '—', o?.id ?? '—', st?.id ?? '—'];
    }
  }
}

/** Tactic's WHY always points at its strategy's objective. */
function normalize(target: EditorTarget, s: StoreState): any {
  if (target.kind !== 'tactic') return target.record;
  const objectiveId = s.strategies.find((x) => x.id === target.record.strategyId)?.objectiveId;
  const w = target.record.fiveW1H ?? {};
  return { ...target.record, fiveW1H: { ...w, why: { ...w.why, objectiveId: w.why?.objectiveId ?? objectiveId } } };
}

/** Missing 5W1H fields for a tactic (used for the "Incomplete" badge too). */
export const tacticIssues = (t: Tactic): Issue[] => validateTactic(t);

/**
 * @param onOpen  open another record (used by "Use as draft" on AI suggestions).
 *                The current form is kept as a draft, so nothing is lost.
 */
export function EntityEditor({ target, onClose, onOpen }: {
  target: EditorTarget; onClose: () => void; onOpen?: (t: EditorTarget) => void;
}) {
  const s = usePpost();
  const kind = target.kind;
  const isNew = !!target.isNew;

  const stored = getState().drafts[target.record.id];
  const baseline = useMemo(() => stored?.baseline ?? normalize(target, getState()), [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<any>(() => stored?.record ?? baseline);
  const [restoredAt, setRestoredAt] = useState<string | undefined>(stored?.savedAt);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const patch = (p: Record<string, unknown>) => setDraft((d: any) => ({ ...d, ...p }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  /* ---- keep unsaved work as a draft (debounced, flushed when the drawer closes) ---- */
  const done = useRef(false);
  const persist = useRef(() => {});
  persist.current = () => {
    if (done.current) return;
    if (JSON.stringify(draft) === JSON.stringify(baseline)) discardDraft(draft.id);
    else saveDraft(kind, draft, baseline, isNew);
  };
  useEffect(() => {
    const t = setTimeout(() => persist.current(), 400);
    return () => clearTimeout(t);
  }, [draft]);
  useEffect(() => {
    const flush = persist;
    return () => flush.current(); // flush on close
  }, []);

  // live re-check after a failed submit, so errors disappear as fields are filled
  const liveIssues = useMemo(() => collectIssues(kind, draft, true), [kind, draft]);
  const shownIssues = triedSubmit ? liveIssues : issues;

  const showErrors = (list: Issue[]) => {
    setIssues(list);
    // bring the error list into view (the buttons are at the bottom of a long form)
    requestAnimationFrame(() => {
      alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (list.some((i) => i.field === 'title')) titleRef.current?.focus();
    });
  };

  const saveDraftRecord = () => {
    const list = collectIssues(kind, draft, false);
    if (list.length) { showErrors(list); return; }
    done.current = true;
    upsert(kind, { ...draft, title: draft.title.trim() });
    onClose();
  };

  const submit = () => {
    setTriedSubmit(true);
    const list = collectIssues(kind, draft, true);
    if (list.length) { showErrors(list); return; }
    done.current = true;
    upsert(kind, { ...draft, title: draft.title.trim(), status: 'IN_REVIEW' });
    onClose();
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    done.current = true;
    discardDraft(draft.id);
    onClose();
  };

  const doArchive = () => {
    if (window.confirm(`Archive ${draft.id}? It will be hidden but kept in the record.`)) {
      done.current = true;
      archive(kind, draft.id);
      onClose();
    }
  };

  const discardRestored = () => {
    discardDraft(draft.id);
    setDraft(baseline);
    setRestoredAt(undefined);
  };

  /* ---- AI suggestions for the next level down (only for saved records) ---- */
  const aiRequest = useMemo((): SuggestionRequest | null => {
    if (isNew) return null;
    if (kind === 'problem') return { want: 'objective', problem: draft };
    if (kind === 'objective') return { want: 'strategy', objective: draft, problems: s.problems.filter((p) => draft.problemIds.includes(p.id)) };
    if (kind === 'strategy') {
      const objective = s.objectives.find((o) => o.id === draft.objectiveId);
      return { want: 'tactic', strategy: draft, objective, problem: s.problems.find((p) => p.id === objective?.problemIds[0]) };
    }
    return null;
  }, [isNew, kind, draft, s]);

  const applySuggestion = (sug: PpostSuggestion, isSample: boolean) => {
    if (!onOpen) return;
    const src = isSample ? 'HUMAN_DECISION' : 'AI_SUGGESTION';
    const extra = { title: sug.title, description: sug.rationale, source: src as any };
    if (kind === 'problem') onOpen({ kind: 'objective', isNew: true, record: blankObjective(draft.id, { ...extra, horizon: sug.horizon ?? 'IMMEDIATE' }) });
    if (kind === 'objective') onOpen({ kind: 'strategy', isNew: true, record: blankStrategy(draft.id, extra) });
    if (kind === 'strategy') {
      const objective = s.objectives.find((o) => o.id === draft.objectiveId);
      const problem = s.problems.find((p) => p.id === objective?.problemIds[0]);
      onOpen({ kind: 'tactic', isNew: true, record: blankTactic(draft, problem, extra) });
    }
  };

  const issueFor = (field: string) => shownIssues.find((i) => i.field === field)?.message;
  const crumbs = lineage({ kind, record: draft } as EditorTarget, s);
  const errorLine =
    shownIssues.length === 0 ? null
      : shownIssues.length === 1 ? shownIssues[0].message
        : `${shownIssues.length} fields need attention${triedSubmit && kind === 'tactic' ? ' before submitting — you can still Save draft' : ''}`;

  return (
    <Drawer
      width={kind === 'tactic' ? 'w-[640px]' : 'w-[480px]'}
      onClose={onClose}
      closeLabel="Close — your unsaved changes are kept as a draft"
      footer={
        <div className="w-full">
          {errorLine && (
            <button type="button" onClick={() => alertRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full text-left text-xs text-red-300 mb-2" role="status">
              ⚠ {errorLine} <span className="underline">Show</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            {!isNew && <Button variant="danger" onClick={doArchive}>Archive</Button>}
            <span className="text-[11px] text-gray-500 flex-1 truncate">
              {dirty ? 'Unsaved changes are kept automatically' : ''}
            </span>
            <Button variant="ghost" onClick={cancel}>Cancel</Button>
            <Button onClick={saveDraftRecord}>{kind === 'tactic' ? 'Save draft' : isNew ? 'Create' : 'Save'}</Button>
            {kind === 'tactic' && <Button variant="primary" onClick={submit}>Submit for review</Button>}
          </div>
        </div>
      }
      title={
        <div>
          <div className="text-[11px] text-gray-500 mb-1 truncate">{crumbs.join(' › ')}</div>
          <div className="flex items-center gap-2">
            <IdChip id={draft.id} />
            <span className="font-semibold text-white">{isNew ? `New ${KIND_LABEL[kind].toLowerCase()}` : KIND_LABEL[kind]}</span>
            <StatusBadge status={draft.status} />
          </div>
        </div>
      }
    >
      <div ref={alertRef} className="scroll-mt-4">
        {restoredAt && (
          <div className="mb-3 rounded border border-blue-800 bg-blue-950 px-3 py-2 text-xs text-blue-200 flex items-center justify-between gap-2">
            <span>Restored your unsaved changes from {new Date(restoredAt).toLocaleString()}.</span>
            <button onClick={discardRestored} className="underline whitespace-nowrap">Discard them</button>
          </div>
        )}
        {shownIssues.length > 0 && (
          <div role="alert" className="mb-4 rounded border border-red-800 bg-red-950 p-3 text-xs text-red-200">
            <div className="font-semibold mb-1">
              {triedSubmit && kind === 'tactic' ? 'Before this can be submitted for review:' : 'Please fix:'}
            </div>
            <ul className="list-disc ml-4">{shownIssues.map((i) => <li key={i.field}>{FIELD_LABEL[i.field] ?? i.field}: {i.message}</li>)}</ul>
          </div>
        )}
      </div>

      {/* ----- common fields ----- */}
      <Field label="Title" required error={issueFor('title')}>
        <input ref={titleRef} className={inputCls} value={draft.title ?? ''} autoFocus
          onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label="Description">
        <textarea className={inputCls} rows={2} value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} />
      </Field>

      {kind === 'problem' && <ProblemFields draft={draft} patch={patch} s={s} />}
      {kind === 'objective' && <ObjectiveFields draft={draft} patch={patch} s={s} />}
      {kind === 'strategy' && <StrategyFields draft={draft} patch={patch} s={s} />}
      {kind === 'tactic' && <TacticFields draft={draft} patch={patch} s={s} issueFor={issueFor} />}

      <div className="grid grid-cols-2 gap-3">
        {kind !== 'tactic' ? (
          <Field label="Owner">
            <select className={inputCls} value={draft.owner ?? ''} onChange={(e) => patch({ owner: e.target.value || undefined })}>
              <option value="">— No owner —</option>
              {PEOPLE.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        ) : <div className="text-[11px] text-gray-500 self-center">Owner is set in WHO above.</div>}
        <Field label="Status">
          <select className={inputCls} value={draft.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map((st) => <option key={st} value={st}>{st.replace('_', ' ').toLowerCase()}</option>)}
          </select>
        </Field>
      </div>
      <div className="text-[11px] text-gray-500 mb-4">
        Source: {draft.source?.replace('_', ' ').toLowerCase()} · Last saved {new Date(draft.updatedAt).toLocaleString()}
      </div>

      {aiRequest && onOpen && (
        <AiSuggestionsPanel request={aiRequest} onUse={applySuggestion} />
      )}
    </Drawer>
  );
}

/** Title is always required; tactics also need full 5W1H to be submitted. */
function collectIssues(kind: EntityKind, draft: any, forSubmit: boolean): Issue[] {
  const list: Issue[] = [];
  if (!draft.title?.trim()) list.push({ field: 'title', message: 'Title is required' });
  if (kind === 'tactic' && forSubmit) list.push(...tacticIssues(draft as Tactic));
  return list;
}

type FieldProps = { draft: any; patch: (p: Record<string, unknown>) => void; s: StoreState };

function ProblemFields({ draft, patch, s }: FieldProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Priority" required>
        <select className={inputCls} value={draft.priorityId} onChange={(e) => patch({ priorityId: e.target.value })}>
          {s.priorities.map((p) => <option key={p.id} value={p.id}>{p.rank}. {p.name}</option>)}
        </select>
      </Field>
      <Field label="Sector" required>
        <SectorSelect value={draft.sector} onChange={(v) => patch({ sector: v })} />
      </Field>
      <Field label="Severity" required>
        <select className={inputCls} value={draft.severity} onChange={(e) => patch({ severity: e.target.value })}>
          {SEVERITIES.map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}
        </select>
      </Field>
      <Field label="From UNKNOWN answer" hint="Set by the assessment engine">
        <input className={inputCls} value={draft.fromUnknownQuestionId ?? '—'} disabled />
      </Field>
    </div>
  );
}

function ObjectiveFields({ draft, patch, s }: FieldProps) {
  const firstProb = s.problems.find((p) => p.id === draft.problemIds[0]);
  const candidates = s.problems.filter((p) => p.status !== 'ARCHIVED' && (!firstProb || p.priorityId === firstProb.priorityId));
  const toggle = (id: string) => {
    const has = draft.problemIds.includes(id);
    const next = has ? draft.problemIds.filter((x: string) => x !== id) : [...draft.problemIds, id];
    if (next.length) patch({ problemIds: next });
  };
  return (
    <>
      <Field label="Time horizon" required>
        <select className={inputCls} value={draft.horizon} onChange={(e) => patch({ horizon: e.target.value })}>
          {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
        </select>
      </Field>
      <Field label="Addresses problem(s)" required hint="An objective can address more than one problem in the same priority">
        <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-gray-800 p-2">
          {candidates.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={draft.problemIds.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="font-mono text-xs text-gray-500">{p.id}</span> {p.title}
            </label>
          ))}
        </div>
      </Field>
    </>
  );
}

function StrategyFields({ draft, patch, s }: FieldProps) {
  return (
    <Field label="Achieves objective" required>
      <select className={inputCls} value={draft.objectiveId} onChange={(e) => patch({ objectiveId: e.target.value })}>
        {s.objectives.filter((o) => o.status !== 'ARCHIVED').map((o) => <option key={o.id} value={o.id}>{o.id} — {o.title}</option>)}
      </select>
    </Field>
  );
}

function SectorSelect({ value, onChange }: { value: SectorId; onChange: (v: SectorId) => void }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as SectorId)}>
      {SECTORS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
  );
}

const daysBetween = (a?: string, b?: string) =>
  a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) : undefined;

function TacticFields({ draft, patch, s, issueFor }: FieldProps & { issueFor: (f: string) => string | undefined }) {
  const w: FiveW1H = draft.fiveW1H ?? {};
  const strategy = s.strategies.find((x) => x.id === draft.strategyId);
  const objective = s.objectives.find((o) => o.id === strategy?.objectiveId);
  const set5 = <K extends keyof FiveW1H>(k: K, v: Partial<NonNullable<FiveW1H[K]>>) =>
    patch({ fiveW1H: { ...w, [k]: { ...(w[k] as object), ...v } } });
  const changeStrategy = (id: string) => {
    const st = s.strategies.find((x) => x.id === id);
    patch({ strategyId: id, fiveW1H: { ...w, why: { ...w.why, objectiveId: st?.objectiveId } } });
  };
  const days = daysBetween(w.when?.start, w.when?.end);
  const toggleSecondary = (id: string) => {
    const cur: string[] = draft.secondaryPriorityIds ?? [];
    patch({ secondaryPriorityIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Strategy" required>
          <select className={inputCls} value={draft.strategyId} onChange={(e) => changeStrategy(e.target.value)}>
            {s.strategies.filter((x) => x.status !== 'ARCHIVED').map((x) => <option key={x.id} value={x.id}>{x.id} — {x.title}</option>)}
          </select>
        </Field>
        <Field label="Sector" required>
          <SectorSelect value={draft.sector} onChange={(v) => patch({ sector: v })} />
        </Field>
        <Field label="Primary priority" required hint="Cost is counted once, under this priority">
          <select className={inputCls} value={draft.primaryPriorityId} onChange={(e) => patch({ primaryPriorityId: e.target.value })}>
            {s.priorities.map((p) => <option key={p.id} value={p.id}>{p.rank}. {p.name}</option>)}
          </select>
        </Field>
        <Field label="Also supports (no cost)">
          <div className="flex flex-wrap gap-1">
            {s.priorities.filter((p) => p.id !== draft.primaryPriorityId).map((p) => {
              const on = (draft.secondaryPriorityIds ?? []).includes(p.id);
              return (
                <button type="button" key={p.id} onClick={() => toggleSecondary(p.id)} title={p.name} aria-pressed={on}
                  className={`text-[11px] px-2 py-1 rounded border ${on ? 'border-blue-500 bg-blue-950 text-blue-200' : 'border-gray-700 text-gray-400'}`}>
                  P{p.rank}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <h3 className="text-sm font-semibold text-white mt-2 mb-1">5W1H action definition</h3>
      <p className="text-[11px] text-gray-500 mb-2">Fields marked * are needed to submit for review. You can save a draft any time.</p>
      <div className="grid grid-cols-2 gap-3">
        <Block letter="WHO" error={issueFor('who')}>
          <Field label="Accountable person" required>
            <select className={inputCls} value={w.who?.accountablePerson ?? draft.owner ?? ''}
              onChange={(e) => patch({ owner: e.target.value || undefined, fiveW1H: { ...w, who: { ...w.who, accountablePerson: e.target.value || undefined } } })}>
              <option value="">— Select —</option>
              {PEOPLE.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Team">
            <input className={inputCls} value={w.who?.team ?? ''} onChange={(e) => set5('who', { team: e.target.value })} />
          </Field>
        </Block>

        <Block letter="WHAT" error={issueFor('what')}>
          <Field label="Action" required>
            <textarea className={inputCls} rows={2} value={w.what?.action ?? ''} onChange={(e) => set5('what', { action: e.target.value })} />
          </Field>
          <Field label="Deliverable">
            <input className={inputCls} value={w.what?.deliverable ?? ''} onChange={(e) => set5('what', { deliverable: e.target.value })} />
          </Field>
        </Block>

        <Block letter="WHEN" error={issueFor('when')}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start" required>
              <input type="date" className={inputCls} value={w.when?.start ?? ''} onChange={(e) => set5('when', { start: e.target.value })} />
            </Field>
            <Field label="End" required>
              <input type="date" className={inputCls} value={w.when?.end ?? ''} onChange={(e) => set5('when', { end: e.target.value })} />
            </Field>
          </div>
          {days !== undefined && days >= 0 && <div className="text-[11px] text-gray-400 -mt-2 mb-2">{days} days</div>}
          <Field label="Horizon">
            <select className={inputCls} value={w.when?.horizon ?? ''} onChange={(e) => set5('when', { horizon: (e.target.value || undefined) as TimeHorizon })}>
              <option value="">— Select —</option>
              {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
            </select>
          </Field>
        </Block>

        <Block letter="WHERE" error={issueFor('where')}>
          <Field label="Location" required>
            <input className={inputCls} value={w.where?.location ?? ''} onChange={(e) => set5('where', { location: e.target.value })} />
          </Field>
          <Field label="Parcel IDs" hint="Comma-separated">
            <input className={inputCls} value={(w.where?.parcelIds ?? []).join(', ')}
              onChange={(e) => set5('where', { parcelIds: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </Field>
        </Block>

        <Block letter="WHY" error={issueFor('why')}>
          <Field label="Linked objective" hint="Auto-linked from the strategy">
            <input className={inputCls} disabled value={objective ? `${objective.id} — ${objective.title}` : '—'} />
          </Field>
          <Field label="Rationale">
            <textarea className={inputCls} rows={2} value={w.why?.rationale ?? ''}
              onChange={(e) => set5('why', { rationale: e.target.value, objectiveId: objective?.id })} />
          </Field>
        </Block>

        <Block letter="HOW" error={issueFor('how')}>
          <Field label="Approach" required>
            <textarea className={inputCls} rows={2} value={w.how?.approach ?? ''} onChange={(e) => set5('how', { approach: e.target.value })} />
          </Field>
          <Field label="Delivery method">
            <select className={inputCls} value={w.how?.deliveryMethod ?? ''}
              onChange={(e) => set5('how', { deliveryMethod: (e.target.value || undefined) as any })}>
              <option value="">— Select —</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="IN_HOUSE">In-house</option>
              <option value="PARTNER">Partner agency</option>
              <option value="MUTUAL_AID">Mutual aid</option>
            </select>
          </Field>
        </Block>
      </div>

      <Field label="Success measure" required error={issueFor('successMeasure')}>
        <input className={inputCls} placeholder="e.g. 42 units occupied by Nov 30" value={draft.successMeasure ?? ''}
          onChange={(e) => patch({ successMeasure: e.target.value })} />
      </Field>
    </>
  );
}

const Block = ({ letter, error, children }: { letter: string; error?: string; children: React.ReactNode }) => (
  <fieldset className={`rounded border p-3 ${error ? 'border-red-700' : 'border-gray-800'}`}>
    <legend className="px-1 text-[11px] font-bold tracking-wide text-green-400">{letter}</legend>
    {error && <div className="text-[11px] text-red-400 mb-2">{error}</div>}
    {children}
  </fieldset>
);
