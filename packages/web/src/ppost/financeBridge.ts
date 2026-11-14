/**
 * PPOST ⇄ FINANCE CONNECTION POINT
 * ---------------------------------
 * Owned by the PPOST team. The finance pages (Class D Estimates, Financial Tracking,
 * Funding & Assistance — Daniel) use these functions instead of reaching into PPOST data.
 *
 *  Read  : getEstimateScopes()  → every tactic with its lineage, status and current cost
 *          getCostHistory(id)   → every cost entry for a tactic, oldest first
 *          getCostRollup()      → totals by priority and sector (finalized vs draft vs not estimated)
 *  Write : recordClassDEstimate(tacticId, {...}) → adds a new Class D revision (never overwrites)
 *  React : usePpostFinance()    → re-renders when PPOST data or costs change
 */
import { CellStatus, Priority, SectorId, Tactic } from 'ppost-engine';
import { getState, recordCost, StoreState, usePpost } from './store';
import { CostEntry, CostStatus } from './seedData';

/** Latest cost entry for a tactic (or undefined if never estimated). */
export function currentCost(s: StoreState, tacticId: string): CostEntry | undefined {
  let latest: CostEntry | undefined;
  for (const e of s.costs) if (e.tacticId === tacticId && (!latest || e.at >= latest.at)) latest = e;
  return latest;
}

export function getCostHistory(tacticId: string, s: StoreState = getState()): CostEntry[] {
  return s.costs.filter((e) => e.tacticId === tacticId).sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * "Finalized" = the tactic is approved in PPOST AND its latest cost is approved.
 * Everything else with a number is "draft / not finalized"; no number = "needs estimate".
 */
export type CostState = 'FINALIZED' | 'DRAFT' | 'NEEDS_ESTIMATE';
export function costState(t: Tactic, cost?: CostEntry): CostState {
  if (!cost) return 'NEEDS_ESTIMATE';
  return t.status === 'APPROVED' && cost.status === 'approved' ? 'FINALIZED' : 'DRAFT';
}

export interface CostRollup {
  total: number;
  finalized: number;
  draft: number;
  needsEstimate: string[]; // tactic ids
  tacticCount: number;
}
const empty = (): CostRollup => ({ total: 0, finalized: 0, draft: 0, needsEstimate: [], tacticCount: 0 });

/** Sum costs for a set of tactics. */
export function rollup(s: StoreState, tactics: Tactic[]): CostRollup {
  const r = empty();
  for (const t of tactics) {
    if (t.status === 'ARCHIVED') continue;
    r.tacticCount++;
    const cost = currentCost(s, t.id);
    const st = costState(t, cost);
    if (st === 'NEEDS_ESTIMATE') { r.needsEstimate.push(t.id); continue; }
    r.total += cost!.amount;
    if (st === 'FINALIZED') r.finalized += cost!.amount; else r.draft += cost!.amount;
  }
  return r;
}

/** Tactics that belong to a matrix cell: their problem has this priority + sector. */
export function tacticsForCell(s: StoreState, priorityId: string, sector: SectorId): Tactic[] {
  const problemIds = new Set(s.problems.filter((p) => p.priorityId === priorityId && p.sector === sector && p.status !== 'ARCHIVED').map((p) => p.id));
  const objectiveIds = new Set(s.objectives.filter((o) => o.status !== 'ARCHIVED' && o.problemIds.some((id) => problemIds.has(id))).map((o) => o.id));
  const strategyIds = new Set(s.strategies.filter((x) => x.status !== 'ARCHIVED' && objectiveIds.has(x.objectiveId)).map((x) => x.id));
  return s.tactics.filter((t) => t.status !== 'ARCHIVED' && strategyIds.has(t.strategyId));
}

export interface EstimateScope {
  tacticId: string;
  title: string;
  tacticStatus: Tactic['status'];
  priority?: Pick<Priority, 'id' | 'rank' | 'name'>;
  sector: SectorId;
  problemId?: string;
  objectiveId?: string;
  strategyId: string;
  current?: CostEntry;
  costState: CostState;
}

/** Everything the Class D page needs to show "Estimate for: T-014 (P6 › P-02 › O-04 › S-07)". */
export function getEstimateScopes(s: StoreState = getState()): EstimateScope[] {
  return s.tactics.filter((t) => t.status !== 'ARCHIVED').map((t) => {
    const strategy = s.strategies.find((x) => x.id === t.strategyId);
    const objective = s.objectives.find((o) => o.id === strategy?.objectiveId);
    const p = s.priorities.find((x) => x.id === t.primaryPriorityId);
    const current = currentCost(s, t.id);
    return {
      tacticId: t.id, title: t.title, tacticStatus: t.status, sector: t.sector, strategyId: t.strategyId,
      objectiveId: objective?.id, problemId: objective?.problemIds[0],
      priority: p && { id: p.id, rank: p.rank, name: p.name },
      current, costState: costState(t, current),
    };
  });
}

/** Totals by priority and by sector. Each tactic counts once, under its primary priority. */
export function getCostRollup(s: StoreState = getState()) {
  const live = s.tactics.filter((t) => t.status !== 'ARCHIVED');
  const byPriority: Record<string, CostRollup> = {};
  const bySector: Record<string, CostRollup> = {};
  for (const p of s.priorities) byPriority[p.id] = rollup(s, live.filter((t) => t.primaryPriorityId === p.id));
  for (const sec of Array.from(new Set(live.map((t) => t.sector)))) bySector[sec] = rollup(s, live.filter((t) => t.sector === sec));
  return { program: rollup(s, live), byPriority, bySector };
}

/** Called by the Class D Estimates page when an estimate for a tactic is saved. */
export function recordClassDEstimate(tacticId: string, est: {
  total: number; revision: string; status: CostStatus; preparedBy: string; note: string;
}): CostEntry {
  return recordCost({
    tacticId, amount: est.total, stage: 'CLASS_D', status: est.status, revision: est.revision,
    reason: est.note, by: est.preparedBy, source: 'CLASS_D_ESTIMATOR',
  });
}

/** React hook for finance pages. */
export function usePpostFinance() {
  const s = usePpost();
  return { scopes: getEstimateScopes(s), rollup: getCostRollup(s), history: (id: string) => getCostHistory(id, s) };
}

/* ---------- display helpers ---------- */
export const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
export const moneyFull = (n: number) => `$${n.toLocaleString('en-CA')}`;

export const STAGE_LABEL: Record<CostEntry['stage'], string> = {
  ALLOWANCE: 'Initial allowance', CLASS_D: 'Class D', REFINED: 'Refined', APPROVED_BUDGET: 'Approved budget',
};

/** Cell colour in the cost view: how much of the money is finalized. */
export function costCellStatus(r: CostRollup): CellStatus {
  if (r.tacticCount === 0) return 'NOT_ASSESSED';
  if (r.needsEstimate.length) return 'RED';
  return r.draft > 0 ? 'AMBER' : 'GREEN';
}
