import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ImpactAssessment from './ImpactAssessment';
import { getState, resetDemoData } from '../ppost/store';

const renderPage = () => render(<MemoryRouter><ImpactAssessment /></MemoryRouter>);
const answer = (qid: string, a: string) =>
  userEvent.click(within(screen.getByRole('radiogroup', { name: `Answer for ${qid}` })).getByRole('radio', { name: a }));

beforeEach(() => resetDemoData());

test('UNKNOWN on a safety question is treated as a hazard and stays UNKNOWN', () => {
  renderPage();
  answer('Q-P01', '? UNKNOWN');
  const card = screen.getByRole('article', { name: 'Q-P01' });
  expect(card).toHaveTextContent('Treated as a potential hazard');
  expect(card).toHaveTextContent('Treat all lines as energized');
  expect(getState().assessment.answers['Q-P01']).toBe('UNKNOWN');
});

test('UNKNOWN on a non-safety question only creates a verification task', () => {
  renderPage();
  answer('Q-F02', '? UNKNOWN');
  expect(screen.getByRole('article', { name: 'Q-F02' })).toHaveTextContent('Verify — no hazard assumed');
});

test('follow-up questions appear only after a YES', () => {
  renderPage();
  expect(screen.queryByRole('article', { name: 'Q-H07a' })).not.toBeInTheDocument();
  answer('Q-H07', 'YES');
  expect(screen.getByRole('article', { name: 'Q-H07a' })).toBeInTheDocument();
});

test('situation report facts are suggested, but a person must confirm them', () => {
  renderPage();
  const card = screen.getByRole('article', { name: 'Q-H01' });
  expect(card).toHaveTextContent('Homes destroyed: 42 (confirmed)');
  expect(getState().assessment.answers['Q-H01']).toBeUndefined();
  userEvent.click(within(card).getByRole('button', { name: 'Confirm YES' }));
  expect(getState().assessment.answers['Q-H01']).toBe('YES');
});

test('results are added to PPOST as drafts only when the button is pressed', () => {
  renderPage();
  answer('Q-P01', '? UNKNOWN');
  answer('Q-E02', 'YES');
  expect(getState().problems.some((p) => p.id === 'P-Q-P01-U')).toBe(false);

  userEvent.click(screen.getByRole('button', { name: /to PPOST as drafts/ }));
  const s = getState();
  expect(s.problems.find((p) => p.id === 'P-Q-P01-U')).toMatchObject({ status: 'DRAFT', fromUnknownQuestionId: 'Q-P01' });
  expect(s.problems.some((p) => p.id === 'P-Q-E02')).toBe(true);
  expect(s.tactics.find((t) => t.id === 'T-Q-P01-SAFE')).toMatchObject({ strategyId: 'S-Q-P01', safetyPrecaution: true });
  expect(s.tasks.map((t) => t.id)).toContain('VT-Q-P01');
  expect(screen.getByRole('button', { name: 'Nothing new to add' })).toBeDisabled();
});

test('an existing problem is not duplicated; its safety tactic is attached to it', () => {
  renderPage();
  answer('Q-W03', '? UNKNOWN'); // P-05 already exists for this question
  userEvent.click(screen.getByRole('button', { name: /to PPOST as drafts/ }));
  const s = getState();
  expect(s.problems.some((p) => p.id === 'P-Q-W03-U')).toBe(false);
  expect(s.objectives.find((o) => o.id === 'O-Q-W03')?.problemIds).toEqual(['P-05']);
});
