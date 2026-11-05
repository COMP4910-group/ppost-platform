import { Objective, Priority, Problem, SectorId, Strategy, Tactic } from '../model/types';

export type CellStatus = 'RED' | 'AMBER' | 'GREEN' | 'NOT_ASSESSED';

export interface MatrixCell {
  priorityId: string;
  sector: SectorId;
  status: CellStatus;
  problemCount: number;
  objectiveCount: number;
  tacticCount: number;
  unknownCount: number;
  /** % of problems that have a full chain down to an owned tactic. */
  completeness: number;
  reasons: string[];   // human-readable explanation for the colour
}

export interface PpostData {
  problems: Problem[];
  objectives: Objective[];
  strategies: Strategy[];
  tactics: Tactic[];
}

/** Does this problem have Objective → Strategy → Tactic (with an owner)? */
function chainFor(problem: Problem, d: PpostData) {
  const objectives = d.objectives.filter((o) => o.problemIds.includes(problem.id) && o.status !== 'ARCHIVED');
  const strategies = d.strategies.filter((s) => objectives.some((o) => o.id === s.objectiveId) && s.status !== 'ARCHIVED');
  const tactics = d.tactics.filter((t) => strategies.some((s) => s.id === t.strategyId) && t.status !== 'ARCHIVED');
  const complete = tactics.length > 0 && tactics.every((t) => !!t.owner);
  return { objectives, strategies, tactics, complete };
}

export function buildCell(priorityId: string, sector: SectorId, d: PpostData): MatrixCell {
  const problems = d.problems.filter(
    (p) => p.priorityId === priorityId && p.sector === sector && p.status !== 'ARCHIVED',
  );
  const cell: MatrixCell = {
    priorityId, sector, status: 'NOT_ASSESSED', problemCount: problems.length,
    objectiveCount: 0, tacticCount: 0, unknownCount: 0, completeness: 0, reasons: [],
  };
  if (problems.length === 0) return cell;

  const objectiveIds = new Set<string>();
  const tacticIds = new Set<string>();
  let completeChains = 0;
  let red = false;
  let amber = false;

  for (const p of problems) {
    const c = chainFor(p, d);
    c.objectives.forEach((o) => objectiveIds.add(o.id));
    c.tactics.forEach((t) => tacticIds.add(t.id));
    if (c.complete) completeChains++;

    if (p.fromUnknownQuestionId) {
      cell.unknownCount++;
      if (p.severity === 'CRITICAL') {
        red = true;
        cell.reasons.push(`${p.id}: unresolved UNKNOWN on a safety item`);
      }
    }
    if ((p.severity === 'CRITICAL' || p.severity === 'HIGH') && c.objectives.length === 0) {
      red = true;
      cell.reasons.push(`${p.id}: high-severity problem with no objective`);
    } else if (!c.complete) {
      amber = true;
      const missingOwner = c.tactics.some((t) => !t.owner);
      cell.reasons.push(`${p.id}: ${missingOwner ? 'tactic missing owner' : 'incomplete PPOST chain'}`);
    }
  }

  cell.objectiveCount = objectiveIds.size;
  cell.tacticCount = tacticIds.size;
  cell.completeness = Math.round((completeChains / problems.length) * 100);
  cell.status = red ? 'RED' : amber ? 'AMBER' : 'GREEN';
  return cell;
}

/** Full grid: rows = priorities (in rank order), columns = sectors. */
export function buildMatrix(priorities: Priority[], sectors: SectorId[], d: PpostData): MatrixCell[][] {
  return priorities.map((p) => sectors.map((s) => buildCell(p.id, s, d)));
}

/** PPOST chain rows for one priority (used by the PPOST Matrix view). */
export function chainsForPriority(priorityId: string, d: PpostData) {
  return d.problems
    .filter((p) => p.priorityId === priorityId)
    .map((problem) => {
      const objectives = d.objectives.filter((o) => o.problemIds.includes(problem.id));
      return {
        problem,
        objectives: objectives.map((objective) => ({
          objective,
          strategies: d.strategies
            .filter((s) => s.objectiveId === objective.id)
            .map((strategy) => ({
              strategy,
              tactics: d.tactics.filter((t) => t.strategyId === strategy.id),
            })),
        })),
      };
    });
}
