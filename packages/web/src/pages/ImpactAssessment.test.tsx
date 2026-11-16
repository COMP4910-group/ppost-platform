import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ImpactAssessment from './ImpactAssessment';
import { getState, resetDemoData } from '../ppost/store';
import { registerQuestionProvider } from '../ppost/questionProviders';

const renderPage = () => render(<MemoryRouter><ImpactAssessment /></MemoryRouter>);
const answer = (qid: string, a: string) =>
  userEvent.click(within(screen.getByRole('radiogroup', { name: `Answer for ${qid}` })).getByRole('radio', { name: a }));
const note = (qid: string, text: string) => userEvent.type(screen.getByLabelText(`Note for ${qid}`), text);

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
  note('Q-P01', 'Utility has not confirmed the outage map');
  answer('Q-E02', 'YES');
  expect(getState().problems.some((p) => p.id === 'P-Q-P01-U')).toBe(false);

  userEvent.click(screen.getByRole('button', { name: /to PPOST as drafts/ }));
  const s = getState();
  expect(s.problems.find((p) => p.id === 'P-Q-P01-U')).toMatchObject({
    status: 'DRAFT', fromUnknownQuestionId: 'Q-P01', description: 'From assessment Q-P01: Utility has not confirmed the outage map',
  });
  expect(s.problems.some((p) => p.id === 'P-Q-E02')).toBe(true);
  expect(s.tactics.find((t) => t.id === 'T-Q-P01-SAFE')).toMatchObject({ strategyId: 'S-Q-P01', safetyPrecaution: true });
  expect(s.tasks.map((t) => t.id)).toContain('VT-Q-P01');
  expect(screen.getByRole('button', { name: 'Nothing new to add' })).toBeDisabled();
});

test('an existing problem is not duplicated; its safety tactic is attached to it', () => {
  renderPage();
  answer('Q-W03', '? UNKNOWN'); // P-05 already exists for this question
  note('Q-W03', 'No pressure readings yet');
  userEvent.click(screen.getByRole('button', { name: /to PPOST as drafts/ }));
  const s = getState();
  expect(s.problems.some((p) => p.id === 'P-Q-W03-U')).toBe(false);
  expect(s.objectives.find((o) => o.id === 'O-Q-W03')?.problemIds).toEqual(['P-05']);
});

test('notes are optional for YES/NO but required for UNKNOWN before adding to PPOST', () => {
  renderPage();
  answer('Q-H07', 'YES');
  expect(screen.getByRole('article', { name: 'Q-H07' })).not.toHaveTextContent('A note is required');

  answer('Q-CI04', '? UNKNOWN');
  const card = screen.getByRole('article', { name: 'Q-CI04' });
  expect(card).toHaveTextContent('A note is required for UNKNOWN answers');
  expect(screen.getByRole('alert')).toHaveTextContent('Q-CI04');

  userEvent.click(screen.getByRole('button', { name: /missing a note/ }));
  expect(getState().problems.some((p) => p.id === 'P-Q-CI04-U')).toBe(false); // blocked

  note('Q-CI04', 'Carrier outage map not received');
  userEvent.click(screen.getByRole('button', { name: /to PPOST as drafts/ }));
  expect(getState().problems.some((p) => p.id === 'P-Q-CI04-U')).toBe(true);
});

test('"Ask deeper questions" opens more precise follow-up questions', () => {
  renderPage();
  expect(screen.queryByRole('article', { name: 'Q-W03-D1' })).not.toBeInTheDocument();
  userEvent.click(within(screen.getByRole('article', { name: 'Q-W03' })).getByRole('button', { name: /Ask 3 deeper questions/ }));
  expect(screen.getByRole('article', { name: 'Q-W03-D1' })).toHaveTextContent('hospitals, care homes or clinics');

  answer('Q-W03-D2', 'NO');
  expect(screen.getByRole('article', { name: 'Q-W03-D2' })).toHaveTextContent('Creates problem: No alternate drinking-water supply');
});

test('shows the Disaster Situation Overview, without the developer "where questions come from" panel', () => {
  renderPage();
  const overview = screen.getByRole('region', { name: 'Disaster Situation Overview' });
  expect(overview).toHaveTextContent('Sample situation report');
  expect(overview).toHaveTextContent('Reported');
  expect(overview).toHaveTextContent('Unknown — needs verification');
  expect(screen.queryByText(/Where do these questions come from/)).not.toBeInTheDocument();
  expect(screen.queryByText(/SitRep v3/)).not.toBeInTheDocument();
  // AI button is hidden while the AI service is not connected
  expect(screen.queryByRole('button', { name: /Suggest questions from documents/ })).not.toBeInTheDocument();
});

test('history is not shown inside question cards; it opens in the Activity history side panel', () => {
  renderPage();
  expect(screen.queryByText(/Answer history/)).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'View history for Q-W03' }));
  const panel = screen.getByRole('dialog');
  expect(panel).toHaveTextContent('Activity history');
  expect((within(panel).getByLabelText('Filter by question') as HTMLSelectElement).value).toBe('Q-W03');
  userEvent.click(within(panel).getByRole('button', { name: 'Close' }));
  userEvent.click(screen.getByRole('button', { name: 'Activity history' }));
  expect((within(screen.getByRole('dialog')).getByLabelText('Filter by question') as HTMLSelectElement).value).toBe('');
});

test('when an AI question provider is registered, its questions are added and labelled', async () => {
  registerQuestionProvider({
    name: 'Test AI',
    generate: async () => [{
      id: 'x', text: 'Is the landfill accepting fire debris?', sector: 'ENVIRONMENT', priorityId: 'PR-7',
      unknownPolicy: 'VERIFY', why: 'Debris removal needs a place to go.', hazards: ['ANY'],
    }],
  });
  try {
    renderPage();
    userEvent.click(screen.getByRole('button', { name: /Suggest questions from documents/ }));
    const card = await screen.findByRole('article', { name: 'Q-AI-01' });
    expect(card).toHaveTextContent('AI-suggested from documents');
  } finally {
    registerQuestionProvider(null);
  }
});
