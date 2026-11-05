/** Blank records used by every "+ Add" button and by "Use as draft" on suggestions. */
import { Objective, Problem, Source, Strategy, Tactic } from 'ppost-engine';
import { nextId } from './store';
import { CURRENT_EVENT } from './seedData';

const now = () => new Date().toISOString();
const meta = (source: Source = 'HUMAN_DECISION') =>
  ({ disasterId: CURRENT_EVENT.id, source, status: 'DRAFT' as const, createdAt: now(), updatedAt: now() });

export const blankProblem = (priorityId: string, extra: Partial<Problem> = {}): Problem => ({
  id: nextId('problem'), title: '', priorityId, sector: 'HOUSING', severity: 'MEDIUM', ...meta(), ...extra,
});

export const blankObjective = (problemId: string, extra: Partial<Objective> = {}): Objective => ({
  id: nextId('objective'), title: '', problemIds: [problemId], horizon: 'IMMEDIATE', ...meta(), ...extra,
});

export const blankStrategy = (objectiveId: string, extra: Partial<Strategy> = {}): Strategy => ({
  id: nextId('strategy'), title: '', objectiveId, ...meta(), ...extra,
});

export const blankTactic = (strategy: Strategy, problem: Problem | undefined, extra: Partial<Tactic> = {}): Tactic => ({
  id: nextId('tactic'), title: '', strategyId: strategy.id,
  primaryPriorityId: problem?.priorityId ?? 'PR-1', sector: problem?.sector ?? 'HOUSING',
  fiveW1H: { why: { objectiveId: strategy.objectiveId } }, ...meta(), ...extra,
});
