import { getState, recordCost, resetDemoData } from './store';
import { costState, currentCost, getCostHistory, getCostRollup, getEstimateScopes, recordClassDEstimate } from './financeBridge';
import { fromObjectiveProposals, toProblemContext } from './aiServiceAdapter';

beforeEach(() => resetDemoData());

test('cost history is kept; the latest entry is the current cost', () => {
  const h = getCostHistory('T-014');
  expect(h.map((e) => e.amount)).toEqual([1500000, 1704000, 2122900]);
  expect(currentCost(getState(), 'T-014')?.revision).toBe('v1.1');
});

test('Class D estimates from the finance page add a new revision, never overwrite', () => {
  recordClassDEstimate('T-020', { total: 46000, revision: 'v1.0', status: 'draft', preparedBy: 'R. Okafor', note: 'Two staff, 3 months' });
  recordClassDEstimate('T-020', { total: 52000, revision: 'v1.1', status: 'in_review', preparedBy: 'R. Okafor', note: 'Added translation' });
  const h = getCostHistory('T-020');
  expect(h).toHaveLength(2);
  expect(h[1]).toMatchObject({ amount: 52000, stage: 'CLASS_D', source: 'CLASS_D_ESTIMATOR' });
});

test('finalized only when tactic AND estimate are approved', () => {
  const s = getState();
  const t016 = s.tactics.find((t) => t.id === 'T-016')!; // approved tactic, approved estimate
  const t014 = s.tactics.find((t) => t.id === 'T-014')!; // in review
  expect(costState(t016, currentCost(s, 'T-016'))).toBe('FINALIZED');
  expect(costState(t014, currentCost(s, 'T-014'))).toBe('DRAFT');
  expect(costState(s.tactics.find((t) => t.id === 'T-020')!, undefined)).toBe('NEEDS_ESTIMATE');
});

test('roll-up by priority counts each tactic once under its primary priority', () => {
  recordCost({ tacticId: 'T-020', amount: 10000, stage: 'ALLOWANCE', status: 'draft', reason: 'test', by: 'me', source: 'PPOST' });
  const r = getCostRollup();
  const sum = Object.values(r.byPriority).reduce((n, x) => n + x.total, 0);
  expect(sum).toBe(r.program.total);
  expect(getEstimateScopes().find((x) => x.tacticId === 'T-014')).toMatchObject({ problemId: 'P-02', objectiveId: 'O-04', priority: { rank: 6 } });
});

test('AI adapter matches ai-service input/output and drops confidence', () => {
  const p = getState().problems.find((x) => x.id === 'P-02')!;
  const ctx = toProblemContext(p);
  expect(ctx.problem.severity).toBe('critical');
  expect(ctx.existingObjectives).toEqual([{ id: 'O-04', title: expect.any(String) }]);
  const out = fromObjectiveProposals([{ title: 'T', description: 'D', rationale: 'R', confidence: 0.9, sourceProblemId: 'P-02' }]);
  expect(out[0]).toEqual({ id: 'AI-P-02-1', kind: 'objective', title: 'T', description: 'D', rationale: 'R', sources: ['P-02'] });
});
