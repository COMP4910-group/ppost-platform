import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  buildMatrix, CellStatus, Objective, orderedPriorities, Priority, Problem, SECTORS, Strategy,
} from 'ppost-engine';
import { discardDraft, resetDemoData, setPriorities, StoreState, usePpost } from '../ppost/store';
import { useServerSync } from '../ppost/sync';
import { ActivityLog, SyncStatusChip } from '../ppost/HistoryPanel';
import { EditorTarget, EntityEditor, tacticIssues } from '../ppost/EntityEditor';
import { blankObjective, blankProblem, blankStrategy, blankTactic } from '../ppost/records';
import {
  Button, CELL_STYLE, Drawer, HORIZON_LABEL, IdChip, inputCls, SeverityBadge, StatusBadge, UnknownBadge, sectorLabel,
} from '../ppost/ui';

const ALL = 'ALL';
const live = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status !== 'ARCHIVED');
type PpostState = StoreState;

/** Worst cell status in a priority row → colour of its chip. */
function rowStatus(cells: { status: CellStatus }[]): CellStatus {
  for (const st of ['RED', 'AMBER', 'GREEN'] as CellStatus[]) if (cells.some((c) => c.status === st)) return st;
  return 'NOT_ASSESSED';
}

const PPOSTWorkspace = () => {
  useServerSync();
  const s = usePpost();
  const [showLog, setShowLog] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const scope = params.get('priority') ?? ALL;
  const setScope = (id: string) => setParams(id === ALL ? {} : { priority: id });
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const [managing, setManaging] = useState(false);
  const [gapsOnly, setGapsOnly] = useState(false);

  const priorities = useMemo(() => orderedPriorities(s.priorities), [s.priorities]);
  const sectorIds = useMemo(() => SECTORS.map((x) => x.id), []);
  const grid = useMemo(() => buildMatrix(priorities, sectorIds, s), [priorities, sectorIds, s]);
  const statusOf = (pid: string) => rowStatus(grid[priorities.findIndex((p) => p.id === pid)] ?? []);

  const inScope = scope === ALL ? priorities : priorities.filter((p) => p.id === scope);
  const summary = useMemo(() => summarize(s, inScope.map((p) => p.id)), [s, inScope]);

  return (
    <div className="p-6 text-white">
      {/* title */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">PPOST Workspace</h1>
          <p className="text-sm text-gray-400 mt-1">Priority → Problem → Objective → Strategy → Tactic</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusChip />
          <Button onClick={() => setShowLog(true)}>Activity log</Button>
          <Button variant="ghost" onClick={() => { if (window.confirm('Reset all PPOST data to the synthetic demo data?')) resetDemoData(); }}>Reset demo data</Button>
          <Button onClick={() => setManaging(true)}>Manage priorities</Button>
          <Button onClick={() => navigate('/matrix')}>Open Recovery Matrix</Button>
        </div>
      </div>

      {/* priority scope bar */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-400" htmlFor="prio-select">Priority</label>
          <select id="prio-select" className={`${inputCls} w-auto min-w-[280px]`} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value={ALL}>All priorities (program view)</option>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.rank}. {p.name}</option>)}
          </select>
          <div className="flex gap-1" role="group" aria-label="Quick priority switch">
            {priorities.map((p) => {
              const st = CELL_STYLE[statusOf(p.id)];
              const on = scope === p.id;
              return (
                <button key={p.id} onClick={() => setScope(on ? ALL : p.id)} aria-pressed={on}
                  title={`${p.name} — ${st.label}`}
                  className={`text-xs w-9 py-1 rounded border ${on ? 'bg-white text-gray-900 border-white font-semibold' : st.cls}`}>
                  P{p.rank}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} /> Show only gaps
          </label>
        </div>
        <div className="mt-3 text-xs text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
          <span><b className="text-white">{summary.problems}</b> problems</span>
          <span><b className="text-white">{summary.objectives}</b> objectives</span>
          <span><b className="text-white">{summary.strategies}</b> strategies</span>
          <span><b className="text-white">{summary.tactics}</b> tactics</span>
          <span className={summary.unknowns ? 'text-amber-300' : ''}><b>{summary.unknowns}</b> from UNKNOWN</span>
          <span className={summary.noOwner ? 'text-red-300' : ''}><b>{summary.noOwner}</b> tactics without owner</span>
          <span>Chain completeness <b className="text-white">{summary.completeness}%</b></span>
        </div>
      </div>

      <DraftsBar s={s} onResume={setEditing} />

      {/* PPOST matrix per priority */}
      {inScope.map((p) => (
        <PriorityBlock key={p.id} priority={p} s={s} gapsOnly={gapsOnly} collapsible={scope === ALL}
          onEdit={setEditing} onFocus={() => setScope(p.id)} />
      ))}

      {showLog && <ActivityLog onClose={() => setShowLog(false)} />}
      {editing && (
        <EntityEditor key={editing.record.id} target={editing} onClose={() => setEditing(null)} onOpen={setEditing} />
      )}
      {managing && <ManagePriorities priorities={s.priorities} onClose={() => setManaging(false)} />}
    </div>
  );
};

function summarize(s: PpostState, priorityIds: string[]) {
  const problems = live(s.problems).filter((p) => priorityIds.includes(p.priorityId));
  const pIds = new Set(problems.map((p) => p.id));
  const objectives = live(s.objectives).filter((o) => o.problemIds.some((id) => pIds.has(id)));
  const oIds = new Set(objectives.map((o) => o.id));
  const strategies = live(s.strategies).filter((x) => oIds.has(x.objectiveId));
  const sIds = new Set(strategies.map((x) => x.id));
  const tactics = live(s.tactics).filter((t) => sIds.has(t.strategyId));
  const complete = problems.filter((p) => {
    const os = objectives.filter((o) => o.problemIds.includes(p.id)).map((o) => o.id);
    const ts = tactics.filter((t) => strategies.some((x) => x.id === t.strategyId && os.includes(x.objectiveId)));
    return ts.length > 0 && ts.every((t) => t.owner);
  }).length;
  return {
    problems: problems.length, objectives: objectives.length, strategies: strategies.length, tactics: tactics.length,
    unknowns: problems.filter((p) => p.fromUnknownQuestionId).length,
    noOwner: tactics.filter((t) => !t.owner).length,
    completeness: problems.length ? Math.round((complete / problems.length) * 100) : 0,
  };
}

/* ---------- one priority: header + 4-column PPOST matrix ---------- */
function PriorityBlock({ priority, s, gapsOnly, collapsible, onEdit, onFocus }: {
  priority: Priority; s: PpostState; gapsOnly: boolean; collapsible: boolean;
  onEdit: (t: EditorTarget) => void; onFocus: () => void;
}) {
  const [open, setOpen] = useState(true);
  const problems = live(s.problems).filter((p) => p.priorityId === priority.id);

  return (
    <section className="mb-5 rounded-lg border border-gray-800 bg-gray-900">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-800">
        {collapsible && (
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-gray-400 hover:text-white w-5">{open ? '▾' : '▸'}</button>
        )}
        <h2 className="font-semibold">
          <span className="text-gray-500 mr-1">P{priority.rank}</span>{priority.name}
        </h2>
        <span className="text-xs text-gray-400">{problems.length} problem{problems.length === 1 ? '' : 's'}</span>
        <div className="flex-1" />
        {collapsible && <Button variant="ghost" onClick={onFocus}>Focus</Button>}
        <Button variant="primary" onClick={() => onEdit({ kind: 'problem', record: blankProblem(priority.id), isNew: true })}>+ Add problem</Button>
      </header>
      {open && (problems.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">
          No problems for this priority yet. Add one, or run the Impact Assessment to generate them.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="text-xs text-gray-400">
              <tr className="border-b border-gray-800">
                {['Problem', 'Objective', 'Strategy', 'Tactic', 'Owner', 'Horizon', 'Status'].map((h) => (
                  <th key={h} scope="col" className="text-left font-medium px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{buildRows(problems, s, gapsOnly, onEdit)}</tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

/** Builds table rows with merged (rowSpan) cells so each problem visibly branches. */
function buildRows(problems: Problem[], s: PpostState, gapsOnly: boolean, onEdit: (t: EditorTarget) => void) {
  const rows: React.ReactNode[] = [];
  const objsOf = (p: Problem) => live(s.objectives).filter((o) => o.problemIds.includes(p.id));
  const stratsOf = (o: Objective) => live(s.strategies).filter((x) => x.objectiveId === o.id);
  const tacticsOf = (x: Strategy) => live(s.tactics).filter((t) => t.strategyId === x.id);
  const isShared = (o: Objective, p: Problem) => o.problemIds[0] !== p.id && problems.some((q) => q.id === o.problemIds[0]);

  const leafS = (x: Strategy) => Math.max(1, tacticsOf(x).length);
  const leafO = (o: Objective, p: Problem) => (isShared(o, p) ? 1 : Math.max(1, stratsOf(o).reduce((n, x) => n + leafS(x), 0)));
  const leafP = (p: Problem) => Math.max(1, objsOf(p).reduce((n, o) => n + leafO(o, p), 0));

  const hasGap = (p: Problem) => {
    const os = objsOf(p);
    if (!os.length) return true;
    return os.some((o) => !isShared(o, p) && (!stratsOf(o).length || stratsOf(o).some((x) => !tacticsOf(x).length || tacticsOf(x).some((t) => !t.owner || tacticIssues(t).length > 0))));
  };

  const cellCls = 'align-top px-3 py-2 border-b border-r border-gray-800';
  const gap = (text: string, label: string, onAdd: () => void, colSpan: number) => (
    <td colSpan={colSpan} className={`${cellCls} `}>
      <div className="rounded border border-dashed border-red-800 px-2 py-1.5 text-xs text-red-300 flex items-center justify-between gap-2">
        <span>⚠ {text}</span>
        <button onClick={onAdd} className="text-green-400 hover:underline whitespace-nowrap">+ Add {label}</button>
      </div>
    </td>
  );

  for (const p of problems) {
    if (gapsOnly && !hasGap(p)) continue;
    let firstP = true;
    const pCell = (
      <td rowSpan={leafP(p)} className={`${cellCls} w-[22%]`}>
        <Card id={p.id} title={p.title} onClick={() => onEdit({ kind: 'problem', record: p })}
          badges={<><SeverityBadge severity={p.severity} />{p.fromUnknownQuestionId && <UnknownBadge questionId={p.fromUnknownQuestionId} />}{s.drafts[p.id] && <UnsavedChip />}</>}
          sub={sectorLabel(p.sector)}
          add={{ label: 'objective', onClick: () => onEdit({ kind: 'objective', record: blankObjective(p.id), isNew: true }) }}
          dashed={!!p.fromUnknownQuestionId} />
      </td>
    );
    const takeP = () => { const c = firstP ? pCell : null; firstP = false; return c; };

    const objs = objsOf(p);
    if (!objs.length) {
      rows.push(<tr key={p.id}>{takeP()}{gap('No objective yet', 'objective', () => onEdit({ kind: 'objective', record: blankObjective(p.id), isNew: true }), 6)}</tr>);
      continue;
    }
    for (const o of objs) {
      let firstO = true;
      const oCell = (
        <td rowSpan={leafO(o, p)} className={`${cellCls} w-[20%]`}>
          <Card id={o.id} title={o.title} onClick={() => onEdit({ kind: 'objective', record: o })} sub={HORIZON_LABEL[o.horizon]}
            badges={s.drafts[o.id] ? <UnsavedChip /> : undefined}
            add={{ label: 'strategy', onClick: () => onEdit({ kind: 'strategy', record: blankStrategy(o.id), isNew: true }) }} />
        </td>
      );
      const takeO = () => { const c = firstO ? oCell : null; firstO = false; return c; };

      if (isShared(o, p)) {
        rows.push(<tr key={p.id + o.id}>{takeP()}{takeO()}<td colSpan={5} className={`${cellCls} text-xs text-gray-500 italic`}>Shared objective — strategies and tactics are shown under {o.problemIds[0]}</td></tr>);
        continue;
      }
      const strats = stratsOf(o);
      if (!strats.length) {
        rows.push(<tr key={p.id + o.id}>{takeP()}{takeO()}{gap('No strategy yet', 'strategy', () => onEdit({ kind: 'strategy', record: blankStrategy(o.id), isNew: true }), 5)}</tr>);
        continue;
      }
      for (const x of strats) {
        let firstS = true;
        const sCell = (
          <td rowSpan={leafS(x)} className={`${cellCls} w-[18%]`}>
            <Card id={x.id} title={x.title} onClick={() => onEdit({ kind: 'strategy', record: x })}
              badges={s.drafts[x.id] ? <UnsavedChip /> : undefined}
              add={{ label: 'tactic', onClick: () => onEdit({ kind: 'tactic', record: blankTactic(x, p), isNew: true }) }} />
          </td>
        );
        const takeS = () => { const c = firstS ? sCell : null; firstS = false; return c; };
        const ts = tacticsOf(x);
        if (!ts.length) {
          rows.push(<tr key={p.id + o.id + x.id}>{takeP()}{takeO()}{takeS()}{gap('No tactic yet', 'tactic', () => onEdit({ kind: 'tactic', record: blankTactic(x, p), isNew: true }), 4)}</tr>);
          continue;
        }
        for (const t of ts) {
          const h = t.fiveW1H?.when?.horizon;
          rows.push(
            <tr key={p.id + o.id + x.id + t.id} className="hover:bg-gray-950/40">
              {takeP()}{takeO()}{takeS()}
              <td className={`${cellCls} w-[22%]`}>
                <Card id={t.id} title={t.title} onClick={() => onEdit({ kind: 'tactic', record: t })}
                  badges={t.safetyPrecaution ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-950 text-red-300">safety precaution</span> : undefined} />
              </td>
              <td className={`${cellCls} text-xs whitespace-nowrap`}>{t.owner ?? <span className="text-red-300">⚠ No owner</span>}</td>
              <td className={`${cellCls} text-xs text-gray-300 whitespace-nowrap`}>{h ? HORIZON_LABEL[h].split(' (')[0] : '—'}</td>
              <td className={`${cellCls} border-r-0`}><TacticStatus t={t} unsaved={!!s.drafts[t.id]} /></td>
            </tr>,
          );
        }
      }
    }
  }
  if (!rows.length) rows.push(<tr key="none"><td colSpan={7} className="p-4 text-center text-xs text-gray-500">No gaps in this priority 🎉</td></tr>);
  return rows;
}

const Card = ({ id, title, sub, badges, onClick, add, dashed }: {
  id: string; title: string; sub?: string; badges?: React.ReactNode; onClick: () => void;
  add?: { label: string; onClick: () => void }; dashed?: boolean;
}) => (
  <div className={`group rounded ${dashed ? 'border border-dashed border-amber-500 p-1.5 -m-1.5' : ''}`}>
    <button onClick={onClick} className="text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
      <div className="flex flex-wrap items-center gap-1 mb-0.5"><IdChip id={id} />{badges}</div>
      <div className="text-sm text-gray-100 group-hover:underline">{title || <span className="text-gray-500">Untitled</span>}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </button>
    {add && (
      <button onClick={add.onClick} className="mt-1 text-[11px] text-green-400 hover:underline opacity-60 group-hover:opacity-100 focus:opacity-100">
        + Add {add.label}
      </button>
    )}
  </div>
);

const UnsavedChip = () => (
  <span title="Has unsaved changes — open it to continue" className="text-[11px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">✎ unsaved</span>
);

/** Draft tactics missing 5W1H fields show as "Incomplete" so they aren't mistaken for ready ones. */
function TacticStatus({ t, unsaved }: { t: import('ppost-engine').Tactic; unsaved: boolean }) {
  const missing = tacticIssues(t).length;
  return (
    <div className="flex flex-col items-start gap-1">
      {t.status === 'DRAFT' && missing > 0 ? (
        <span title={tacticIssues(t).map((i) => i.message).join('\n')}
          className="text-[11px] px-1.5 py-0.5 rounded border border-amber-600 text-amber-300 whitespace-nowrap">
          ⚠ Incomplete · {missing} missing
        </span>
      ) : <StatusBadge status={t.status} />}
      {unsaved && <UnsavedChip />}
    </div>
  );
}

/** Work that was typed but not saved yet — never lost unless the user presses Cancel/Discard. */
function DraftsBar({ s, onResume }: { s: PpostState; onResume: (t: EditorTarget) => void }) {
  const drafts = Object.values(s.drafts);
  if (!drafts.length) return null;
  return (
    <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-3 mb-4" aria-label="Unsaved drafts">
      <div className="text-xs font-semibold text-blue-200 mb-2">
        {drafts.length} unsaved draft{drafts.length === 1 ? '' : 's'} — your typing was kept
      </div>
      {drafts.map((d) => (
        <div key={d.record.id} className="flex items-center gap-2 text-xs py-1">
          <IdChip id={d.record.id} />
          <span className="text-gray-400 capitalize">{d.isNew ? `new ${d.kind}` : d.kind}</span>
          <span className="text-gray-100 truncate flex-1">{d.record.title || <i className="text-gray-500">Untitled</i>}</span>
          <span className="text-gray-500 hidden md:inline">{new Date(d.savedAt).toLocaleTimeString()}</span>
          <Button onClick={() => onResume({ kind: d.kind, record: d.record, isNew: d.isNew } as EditorTarget)}>Resume</Button>
          <Button variant="ghost" onClick={() => { if (window.confirm('Discard this unsaved draft?')) discardDraft(d.record.id); }}>Discard</Button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Manage priorities: rename, reorder, activate ---------- */
function ManagePriorities({ priorities, onClose }: { priorities: Priority[]; onClose: () => void }) {
  const [list, setList] = useState(() => [...priorities].sort((a, b) => a.rank - b.rank));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };
  const save = () => {
    if (list.some((p) => !p.name.trim())) return;
    setPriorities(list.map((p, i) => ({ ...p, name: p.name.trim(), rank: i + 1 })));
    onClose();
  };
  return (
    <Drawer onClose={onClose} title={<div className="font-semibold text-white">Manage priorities</div>}>
      <p className="text-xs text-gray-400 mb-3">Priorities are configurable. Order sets the rank (1 = highest). Inactive priorities are hidden from the matrix.</p>
      {list.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2 mb-2">
          <span className="w-6 text-right text-xs text-gray-500">{i + 1}.</span>
          <input className={inputCls} value={p.name} aria-label={`Priority ${i + 1} name`}
            onChange={(e) => setList(list.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
          <button onClick={() => move(i, -1)} aria-label="Move up" className="text-gray-400 hover:text-white px-1">↑</button>
          <button onClick={() => move(i, 1)} aria-label="Move down" className="text-gray-400 hover:text-white px-1">↓</button>
          <label className="flex items-center gap-1 text-xs text-gray-400">
            <input type="checkbox" checked={p.active} onChange={(e) => setList(list.map((x) => (x.id === p.id ? { ...x, active: e.target.checked } : x)))} />
            Active
          </label>
        </div>
      ))}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save priorities</Button>
      </div>
    </Drawer>
  );
}

export default PPOSTWorkspace;
