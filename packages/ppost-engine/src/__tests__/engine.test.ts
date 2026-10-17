import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  DEFAULT_PRIORITIES, SAMPLE_PPOST, SAMPLE_QUESTIONS, RecoveryMatrix,
  buildCell, evaluateAssessment, orderedPriorities, validateTactic,
} from '../index';

describe('priority hierarchy', () => {
  it('has 8 tiers in rank order', () => {
    const p = orderedPriorities(DEFAULT_PRIORITIES);
    expect(p).toHaveLength(8);
    expect(p[0].name).toBe('Responder Safety & Health');
    expect(p[7].rank).toBe(8);
  });
});

describe('assessment engine', () => {
  it('UNKNOWN on a safety question creates problem + safety tactic + verification task', () => {
    const r = evaluateAssessment('EV-2026-014', SAMPLE_QUESTIONS, { 'Q-W03': 'UNKNOWN' });
    expect(r.unknownQuestionIds).toEqual(['Q-W03']);
    expect(r.tactics[0]).toMatchObject({ id: 'T-Q-W03-SAFE', safetyPrecaution: true });
    expect(r.tasks[0]).toMatchObject({ id: 'VT-Q-W03', assignedRole: 'Infrastructure Lead', dueInHours: 48 });
    expect(r.problems[0]).toMatchObject({ severity: 'CRITICAL', fromUnknownQuestionId: 'Q-W03' });
  });

  it('UNKNOWN is never treated as NO or YES', () => {
    const r = evaluateAssessment('EV', SAMPLE_QUESTIONS, { 'Q-W03': 'UNKNOWN' });
    // the normal YES-problem must not be created
    expect(r.problems.find((p) => p.id === 'P-Q-W03')).toBeUndefined();
  });

  it('UNKNOWN on a VERIFY question creates only a task (no hazard)', () => {
    const r = evaluateAssessment('EV', SAMPLE_QUESTIONS, { 'Q-F02': 'UNKNOWN' });
    expect(r.tasks).toHaveLength(1);
    expect(r.tactics).toHaveLength(0);
    expect(r.problems).toHaveLength(0);
  });

  it('NO creates nothing; unanswered is not UNKNOWN', () => {
    const r = evaluateAssessment('EV', SAMPLE_QUESTIONS, { 'Q-W03': 'NO' });
    expect(r.problems).toHaveLength(0);
    expect(r.unknownQuestionIds).toHaveLength(0);
  });

  it('follow-up questions only appear when parent = YES', () => {
    expect(evaluateAssessment('EV', SAMPLE_QUESTIONS, {}).visibleQuestionIds).not.toContain('Q-H07a');
    const yes = evaluateAssessment('EV', SAMPLE_QUESTIONS, { 'Q-H07': 'YES', 'Q-H07a': 'NO' });
    expect(yes.visibleQuestionIds).toContain('Q-H07a');
    expect(yes.problems.map((p) => p.id)).toEqual(['P-Q-H07', 'P-Q-H07a']);
  });

  it('is idempotent (same ids on re-run)', () => {
    const a = evaluateAssessment('EV', SAMPLE_QUESTIONS, { 'Q-W03': 'UNKNOWN' }, 'x');
    const b = evaluateAssessment('EV', SAMPLE_QUESTIONS, { 'Q-W03': 'UNKNOWN' }, 'x');
    expect(a).toEqual(b);
  });
});

describe('recovery matrix', () => {
  it('Priority 6 × Housing is RED (unknown safety-ish problem with no objective)', () => {
    const cell = buildCell('PR-6', 'HOUSING', SAMPLE_PPOST);
    expect(cell.status).toBe('RED');
    expect(cell.problemCount).toBe(2);
    expect(cell.unknownCount).toBe(1);
    expect(cell.completeness).toBe(50);
  });

  it('empty cell is NOT_ASSESSED', () => {
    expect(buildCell('PR-1', 'ECONOMY', SAMPLE_PPOST).status).toBe('NOT_ASSESSED');
  });

  it('missing owner makes the cell AMBER', () => {
    const data = {
      ...SAMPLE_PPOST,
      problems: [SAMPLE_PPOST.problems[0]],
      tactics: [{ ...SAMPLE_PPOST.tactics[0], owner: undefined }],
    };
    expect(buildCell('PR-6', 'HOUSING', data).status).toBe('AMBER');
  });

  it('renders 8 rows x 5 sector columns', () => {
    const html = renderToString(React.createElement(RecoveryMatrix, { priorities: DEFAULT_PRIORITIES, data: SAMPLE_PPOST }));
    expect((html.match(/<button/g) ?? []).length).toBe(40);
    expect(html).toContain('Protect Property');
  });
});

describe('5W1H validation', () => {
  it('T-014 is complete', () => {
    expect(validateTactic(SAMPLE_PPOST.tactics[0])).toEqual([]);
  });
  it('flags missing owner and dates', () => {
    const t = { ...SAMPLE_PPOST.tactics[0], owner: undefined, fiveW1H: { what: { action: 'x' } } };
    const fields = validateTactic(t).map((i) => i.field);
    expect(fields).toContain('who');
    expect(fields).toContain('when');
  });
});
