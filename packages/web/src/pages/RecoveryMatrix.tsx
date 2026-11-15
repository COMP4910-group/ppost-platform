import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildMatrix, CellStatus, MatrixCell, orderedPriorities, SECTORS, SectorId, TimeHorizon } from 'ppost-engine';
import { StoreState, usePpost } from '../ppost/store';
import { useServerSync } from '../ppost/sync';
import { SyncStatusChip } from '../ppost/HistoryPanel';
import { costCellStatus, costState, currentCost, money, moneyFull, rollup, STAGE_LABEL, tacticsForCell } from '../ppost/financeBridge';
import { EditorTarget, EntityEditor } from '../ppost/EntityEditor';
import { Button, CELL_STYLE, Drawer, HORIZON_LABEL, IdChip, SeverityBadge, StatusBadge, UnknownBadge, sectorLabel } from '../ppost/ui';

type View = 'grid' | 'table';
type Lens = 'status' | 'cost';
type PpostState = StoreState;

const COST_STYLE: Record<CellStatus, { cls: string; icon: string; label: string }> = {
  RED: { cls: 'bg-red-950 border-red-500 text-red-200', icon: '$?', label: 'Needs estimate' },
  AMBER: { cls: 'bg-amber-950 border-amber-500 text-amber-200', icon: '≈', label: 'Draft money' },
  GREEN: { cls: 'bg-green-950 border-green-500 text-green-200', icon: '✓', label: 'Finalized' },
  NOT_ASSESSED: { cls: 'bg-gray-900 border-gray-700 text-gray-500', icon: '○', label: 'No tactics' },
};

/** Keep only records in a time horizon (objectives carry the horizon). */
function filterByHorizon(s: PpostState, h: TimeHorizon | 'ALL'): PpostState {
  if (h === 'ALL') return s;
  const objectives = s.objectives.filter((o) => o.horizon === h);
  const objIds = new Set(objectives.map((o) => o.id));
  const strategies = s.strategies.filter((x) => objIds.has(x.objectiveId));
  const stratIds = new Set(strategies.map((x) => x.id));
  const problemIds = new Set(objectives.flatMap((o) => o.problemIds));
  return {
    ...s,
    // problems with no objective yet stay visible in every horizon so gaps aren't hidden
    problems: s.problems.filter((p) => problemIds.has(p.id) || !s.objectives.some((o) => o.problemIds.includes(p.id))),
    objectives, strategies,
    tactics: s.tactics.filter((t) => stratIds.has(t.strategyId)),
  };
}

const RecoveryMatrix = () => {
  useServerSync();
  const all = usePpost();
  const navigate = useNavigate();
  const [horizon, setHorizon] = useState<TimeHorizon | 'ALL'>('ALL');
  const [showGovernance, setShowGovernance] = useState(false);
  const [view, setView] = useState<View>('grid');
  const [lens, setLens] = useState<Lens>('status');
  const [selected, setSelected] = useState<MatrixCell | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);

  const s = useMemo(() => filterByHorizon(all, horizon), [all, horizon]);
  const priorities = useMemo(() => orderedPriorities(s.priorities), [s.priorities]);
  const sectors: SectorId[] = useMemo(() => SECTORS.filter((x) => showGovernance || !x.optional).map((x) => x.id), [showGovernance]);
  const grid = useMemo(() => buildMatrix(priorities, sectors, s), [priorities, sectors, s]);
  const flat = grid.flat();
  const count = (st: string) => flat.filter((c) => c.status === st).length;
  const cellCost = (c: MatrixCell) => rollup(s, tacticsForCell(s, c.priorityId, c.sector));
  const program = rollup(s, flat.flatMap((c) => tacticsForCell(s, c.priorityId, c.sector)));

  return (
    <div className="p-6 text-white">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Recovery Matrix</h1>
          <p className="text-sm text-gray-400 mt-1">
            {priorities.length} priorities × {sectors.length} sectors · click a cell to see its PPOST chain
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusChip />
          <div role="group" aria-label="Time horizon" className="flex rounded border border-gray-700 overflow-hidden">
            {(['ALL', 'IMMEDIATE', 'MID_TERM', 'LONG_TERM'] as const).map((h) => (
              <button key={h} onClick={() => setHorizon(h)} aria-pressed={horizon === h}
                className={`text-xs px-3 py-1.5 ${horizon === h ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                {h === 'ALL' ? 'All horizons' : HORIZON_LABEL[h].split(' (')[0]}
              </button>
            ))}
          </div>
          <div role="group" aria-label="View" className="flex rounded border border-gray-700 overflow-hidden">
            {(['grid', 'table'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                className={`text-xs px-3 py-1.5 capitalize ${view === v ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>{v}</button>
            ))}
          </div>
          <div role="group" aria-label="Show" className="flex rounded border border-gray-700 overflow-hidden">
            {(['status', 'cost'] as Lens[]).map((l) => (
              <button key={l} onClick={() => setLens(l)} aria-pressed={lens === l}
                className={`text-xs px-3 py-1.5 ${lens === l ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                {l === 'status' ? 'Planning status' : 'Cost ($)'}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowGovernance((g) => !g)}>
            {showGovernance ? 'Hide Governance' : 'Activate Governance'}
          </Button>
        </div>
      </div>

      {lens === 'cost' && (
        <section aria-label="Cost summary" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <CostTile label="Total estimated need" value={moneyFull(program.total)} sub={`${program.tacticCount} tactics in view`} />
          <CostTile label="Finalized" value={moneyFull(program.finalized)} sub="tactic approved + estimate approved" tone="text-green-300" />
          <CostTile label="Draft / not finalized" value={moneyFull(program.draft)} sub="allowances and estimates still in draft or review" tone="text-amber-300" />
          <CostTile label="Needs an estimate" value={`${program.needsEstimate.length} tactics`} sub={program.needsEstimate.join(', ') || 'none'} tone="text-red-300" />
        </section>
      )}

      {/* legend + summary */}
      {lens === 'cost' ? (
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          {(['RED', 'AMBER', 'GREEN', 'NOT_ASSESSED'] as const).map((st) => (
            <span key={st} className={`px-2 py-1 rounded border ${COST_STYLE[st].cls}`}>{COST_STYLE[st].icon} {COST_STYLE[st].label}</span>
          ))}
          <span className="text-gray-500 self-center">
            Numbers come from each tactic's latest cost: an initial allowance typed in PPOST, or a Class D estimate from the Class D Estimates page.
          </span>
        </div>
      ) : (
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {(['RED', 'AMBER', 'GREEN', 'NOT_ASSESSED'] as const).map((st) => (
          <span key={st} className={`px-2 py-1 rounded border ${CELL_STYLE[st].cls}`}>
            {CELL_STYLE[st].icon} {CELL_STYLE[st].label} · {count(st)}
          </span>
        ))}
        <span className="px-2 py-1 rounded border-2 border-dashed border-amber-400 text-amber-300">? Has unresolved UNKNOWN</span>
        <span className="text-gray-500 self-center">
          Red = safety UNKNOWN or high-severity problem with no objective · Amber = incomplete chain or missing owner · Green = complete chain with owners
        </span>
      </div>
      )}

      {view === 'grid' ? (
        <div className="overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: 6 }} aria-label="Recovery Matrix: priorities by sector">
            <thead>
              <tr>
                <th scope="col" className="text-left text-xs text-gray-500 font-medium w-56">Priority</th>
                {sectors.map((sec) => (
                  <th key={sec} scope="col" className="text-xs text-gray-300 font-semibold min-w-[150px] text-left px-1">{sectorLabel(sec)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priorities.map((p, r) => (
                <tr key={p.id}>
                  <th scope="row" className="text-left align-middle pr-2">
                    <button onClick={() => navigate(`/ppost?priority=${p.id}`)}
                      className="text-sm text-gray-200 hover:text-green-400 text-left" title="Open this priority in the PPOST Workspace">
                      <span className="text-gray-500 mr-1">{p.rank}.</span>{p.name}
                    </button>
                    {lens === 'cost' && (
                      <div className="text-[11px] text-gray-400">{money(grid[r].reduce((n, c) => n + cellCost(c).total, 0))}</div>
                    )}
                  </th>
                  {grid[r].map((cell) => {
                    const cr = lens === 'cost' ? cellCost(cell) : undefined;
                    const st = cr ? COST_STYLE[costCellStatus(cr)] : CELL_STYLE[cell.status];
                    const isSel = selected?.priorityId === cell.priorityId && selected?.sector === cell.sector;
                    return (
                      <td key={cell.sector} className="p-0">
                        <button
                          onClick={() => setSelected(cell)}
                          aria-label={cr
                            ? `${p.name} × ${sectorLabel(cell.sector)}: ${st.label}, ${moneyFull(cr.total)} total, ${moneyFull(cr.finalized)} finalized, ${cr.needsEstimate.length} need estimate`
                            : `${p.name} × ${sectorLabel(cell.sector)}: ${st.label}, ${cell.problemCount} problems, ${cell.objectiveCount} objectives, ${cell.tacticCount} tactics, ${cell.unknownCount} unknown`}
                          className={`w-full min-h-[76px] text-left rounded-lg p-2 text-xs ${st.cls} ${cell.unknownCount ? 'border-2 border-dashed !border-amber-400' : 'border'} ${isSel ? 'ring-2 ring-blue-500' : ''} hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                          <div className="font-semibold">{st.icon} {cr && cr.total > 0 ? money(cr.total) : st.label}</div>
                          {cr && cr.tacticCount > 0 && (
                            <div className="mt-0.5 opacity-90 leading-snug">
                              {cr.finalized > 0 && <div>✓ {money(cr.finalized)} final</div>}
                              {cr.draft > 0 && <div>≈ {money(cr.draft)} draft</div>}
                              {cr.needsEstimate.length > 0 && <div className="text-red-300">{cr.needsEstimate.length} need estimate</div>}
                            </div>
                          )}
                          {!cr && cell.problemCount > 0 && (
                            <>
                              <div className="mt-0.5 opacity-90">
                                {cell.problemCount}P · {cell.objectiveCount}O · {cell.tacticCount}T
                                {cell.unknownCount > 0 && <span className="ml-1 text-amber-300">· {cell.unknownCount}?</span>}
                              </div>
                              <div className="h-1 bg-gray-800 rounded mt-1.5" aria-hidden>
                                <div className="h-1 bg-green-500 rounded" style={{ width: `${cell.completeness}%` }} />
                              </div>
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <table className="w-full text-sm" aria-label="Recovery Matrix as table">
          <thead className="text-xs text-gray-400 border-b border-gray-800">
            <tr>{['Priority', 'Sector', 'Status', 'Problems', 'Objectives', 'Tactics', 'Unknown', 'Complete', 'Est. cost', 'Finalized', 'Why'].map((h) => <th key={h} className="text-left py-2 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {flat.filter((c) => c.status !== 'NOT_ASSESSED').map((c) => {
              const p = priorities.find((x) => x.id === c.priorityId)!;
              return (
                <tr key={c.priorityId + c.sector} className="border-b border-gray-800 hover:bg-gray-900 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="py-2 pr-3">{p.rank}. {p.name}</td>
                  <td className="pr-3">{sectorLabel(c.sector)}</td>
                  <td className="pr-3">{CELL_STYLE[c.status].icon} {CELL_STYLE[c.status].label}</td>
                  <td className="pr-3">{c.problemCount}</td><td className="pr-3">{c.objectiveCount}</td><td className="pr-3">{c.tacticCount}</td>
                  <td className="pr-3">{c.unknownCount || '—'}</td><td className="pr-3">{c.completeness}%</td>
                  <td className="pr-3 whitespace-nowrap">{moneyFull(cellCost(c).total)}</td>
                  <td className="pr-3 whitespace-nowrap">{moneyFull(cellCost(c).finalized)}</td>
                  <td className="text-xs text-gray-400">{c.reasons.join('; ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selected && !editing && (
        <CellDrawer cell={selected} s={s} onClose={() => setSelected(null)} onEdit={setEditing}
          onOpenWorkspace={() => navigate(`/ppost?priority=${selected.priorityId}`)} />
      )}
      {editing && <EntityEditor key={editing.record.id} target={editing} onClose={() => setEditing(null)} onOpen={setEditing} />}
    </div>
  );
};

/** Drill-down: Problems → Objectives → Strategies → Tactics for one cell. */
function CellDrawer({ cell, s, onClose, onEdit, onOpenWorkspace }: {
  cell: MatrixCell; s: PpostState; onClose: () => void; onEdit: (t: EditorTarget) => void; onOpenWorkspace: () => void;
}) {
  const p = s.priorities.find((x) => x.id === cell.priorityId)!;
  const st = CELL_STYLE[cell.status];
  const problems = s.problems.filter((x) => x.priorityId === cell.priorityId && x.sector === cell.sector && x.status !== 'ARCHIVED');
  return (
    <Drawer onClose={onClose} width="w-[520px]" title={
      <div>
        <div className="text-[11px] text-gray-500">P{p.rank} {p.name} × {sectorLabel(cell.sector)}</div>
        <div className="font-semibold text-white">{st.icon} {st.label} · {cell.completeness}% of chains complete</div>
      </div>
    }>
      <CellCostBox s={s} cell={cell} />
      {cell.reasons.length > 0 && (
        <div className="mb-4 rounded border border-gray-700 bg-gray-950 p-3 text-xs text-gray-300">
          <div className="font-semibold mb-1">Why this colour</div>
          <ul className="list-disc ml-4">{cell.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      {problems.length === 0 && <p className="text-sm text-gray-400">No problems recorded for this cell yet.</p>}
      {problems.map((pr) => {
        const objs = s.objectives.filter((o) => o.problemIds.includes(pr.id) && o.status !== 'ARCHIVED');
        return (
          <div key={pr.id} className="mb-4 rounded border border-gray-800 p-3">
            <button className="w-full text-left" onClick={() => onEdit({ kind: 'problem', record: pr })}>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="text-[10px] uppercase text-gray-500">Problem</span><IdChip id={pr.id} />
                <SeverityBadge severity={pr.severity} />
                {pr.fromUnknownQuestionId && <UnknownBadge questionId={pr.fromUnknownQuestionId} />}
              </div>
              <div className="text-sm text-white hover:underline">{pr.title}</div>
            </button>
            {objs.length === 0 && <div className="mt-2 text-xs text-red-300">⚠ No objective yet</div>}
            {objs.map((o) => (
              <div key={o.id} className="mt-2 ml-3 pl-3 border-l border-gray-700">
                <Row label="Objective" id={o.id} title={o.title} onClick={() => onEdit({ kind: 'objective', record: o })} />
                {s.strategies.filter((x) => x.objectiveId === o.id && x.status !== 'ARCHIVED').map((x) => (
                  <div key={x.id} className="ml-3 pl-3 border-l border-gray-700">
                    <Row label="Strategy" id={x.id} title={x.title} onClick={() => onEdit({ kind: 'strategy', record: x })} />
                    {s.tactics.filter((t) => t.strategyId === x.id && t.status !== 'ARCHIVED').map((t) => (
                      <div key={t.id} className="ml-3 pl-3 border-l border-gray-700">
                        <Row label="Tactic" id={t.id} title={t.title} onClick={() => onEdit({ kind: 'tactic', record: t })}
                          extra={<>{t.owner ? <span className="text-[11px] text-gray-400">{t.owner}</span> : <span className="text-[11px] text-red-300">⚠ No owner</span>}<StatusBadge status={t.status} /><TacticCostChip s={s} t={t} /></>} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
      <Button variant="primary" className="w-full py-2" onClick={onOpenWorkspace}>Open P{p.rank} in PPOST Workspace →</Button>
    </Drawer>
  );
}

const Row = ({ label, id, title, onClick, extra }: { label: string; id: string; title: string; onClick: () => void; extra?: React.ReactNode }) => (
  <button onClick={onClick} className="w-full text-left py-1 group">
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase text-gray-500 w-14">{label}</span><IdChip id={id} />
      <span className="text-xs text-gray-200 group-hover:underline">{title}</span>{extra}
    </div>
  </button>
);

const CostTile = ({ label, value, sub, tone = 'text-white' }: { label: string; value: string; sub: string; tone?: string }) => (
  <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
    <div className={`text-lg font-bold ${tone}`}>{value}</div>
    <div className="text-xs text-gray-300">{label}</div>
    <div className="text-[11px] text-gray-500 truncate" title={sub}>{sub}</div>
  </div>
);

function CellCostBox({ s, cell }: { s: PpostState; cell: MatrixCell }) {
  const r = rollup(s, tacticsForCell(s, cell.priorityId, cell.sector));
  if (!r.tacticCount) return null;
  return (
    <div className="mb-4 rounded border border-gray-700 bg-gray-950 p-3 text-xs text-gray-300">
      <div className="font-semibold mb-1">Money for this area</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>Total <b className="text-white">{moneyFull(r.total)}</b></span>
        <span className="text-green-300">Finalized {moneyFull(r.finalized)}</span>
        <span className="text-amber-300">Draft {moneyFull(r.draft)}</span>
        {r.needsEstimate.length > 0 && <span className="text-red-300">Needs estimate: {r.needsEstimate.join(', ')}</span>}
      </div>
    </div>
  );
}

function TacticCostChip({ s, t }: { s: PpostState; t: import('ppost-engine').Tactic }) {
  const cost = currentCost(s, t.id);
  const st = costState(t, cost);
  if (st === 'NEEDS_ESTIMATE') return <span className="text-[11px] px-1.5 py-0.5 rounded border border-red-800 text-red-300">$ needs estimate</span>;
  return (
    <span title={`${STAGE_LABEL[cost!.stage]}${cost!.revision ? ' ' + cost!.revision : ''} · ${cost!.status}`}
      className={`text-[11px] px-1.5 py-0.5 rounded ${st === 'FINALIZED' ? 'bg-green-950 text-green-300' : 'bg-amber-950 text-amber-300'}`}>
      {moneyFull(cost!.amount)} {st === 'FINALIZED' ? '✓' : '(draft)'}
    </span>
  );
}

export default RecoveryMatrix;
