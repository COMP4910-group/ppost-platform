import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ImpactAssessment from './ImpactAssessment';
import { getState, resetDemoData } from '../ppost/store';
import { AssessmentInsightContext, registerSuggestionProvider } from '../ppost/aiSuggestions';

const renderPage = () => render(<MemoryRouter><ImpactAssessment /></MemoryRouter>);
const answer = (qid: string, a: string) =>
  userEvent.click(within(screen.getByRole('radiogroup', { name: `Answer for ${qid}` })).getByRole('radio', { name: a }));
const panel = () => screen.getByLabelText('AI deeper tasks');

beforeEach(() => resetDemoData());
afterEach(() => registerSuggestionProvider(null));

test('without the AI service the panel says "not connected" and offers a labelled sample', async () => {
  renderPage();
  expect(panel()).toHaveTextContent(/not connected/i);
  answer('Q-H01', 'YES');
  userEvent.click(within(panel()).getByText('Preview with sample suggestions'));
  expect((await within(panel()).findAllByText('SAMPLE · not AI')).length).toBeGreaterThan(0);
  expect(panel()).toHaveTextContent('mental-health and grief support');
});

test('Add to PPOST creates a DRAFT problem; a tactic attaches to the suggested strategy; a task goes to the task list', async () => {
  renderPage();
  answer('Q-H01', 'YES');
  userEvent.click(within(panel()).getByText('Preview with sample suggestions'));

  const prob = await within(panel()).findByRole('article', { name: /mental-health/ });
  userEvent.click(within(prob).getByRole('button', { name: 'Add to PPOST' }));
  expect(within(prob).getByRole('status')).toHaveTextContent('Added to PPOST as draft P-11');
  expect(getState().problems.find((p) => p.id === 'P-11')).toMatchObject({ status: 'DRAFT', sector: 'HUMAN_WELLNESS', source: 'HUMAN_DECISION' });

  const tac = within(panel()).getByRole('article', { name: /re-entry information session/ });
  expect(tac).toHaveTextContent('Attach to: S-08');
  userEvent.click(within(tac).getByRole('button', { name: 'Add to PPOST' }));
  expect(getState().tactics.find((t) => t.title.startsWith('Hold a re-entry'))).toMatchObject({ strategyId: 'S-08', status: 'DRAFT' });
});

test('Edit as draft opens a pre-filled form; Dismiss hides it and Undo brings it back', async () => {
  renderPage();
  answer('Q-H01', 'YES');
  userEvent.click(within(panel()).getByText('Preview with sample suggestions'));
  const prob = await within(panel()).findByRole('article', { name: /mental-health/ });

  userEvent.click(within(prob).getByRole('button', { name: 'Dismiss' }));
  expect(within(panel()).queryByRole('article', { name: /mental-health/ })).not.toBeInTheDocument();
  userEvent.click(within(panel()).getByText('Show dismissed (1)'));
  userEvent.click(within(panel()).getByRole('button', { name: 'Undo' }));
  const back = within(panel()).getByRole('article', { name: /mental-health/ });

  userEvent.click(within(back).getByRole('button', { name: 'Edit as draft' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('New problem')).toBeInTheDocument();
  expect(within(dialog).getByLabelText(/Title/)).toHaveValue('Households who lost homes may need mental-health and grief support');
});

test('the AI receives answers, notes, rules-engine results and the current plan; its output is labelled AI', async () => {
  let seen: AssessmentInsightContext | undefined;
  registerSuggestionProvider({
    name: 'Test AI',
    suggest: async (req) => {
      if (req.want !== 'assessment-insights') return [];
      seen = req.context;
      return [{ id: 'X1', kind: 'task', title: 'Order bottled water for the care home', rationale: 'Care home on the unverified system.', sources: ['Q-W03'], assignedRole: 'Planning Section Chief', dueInHours: 12 }];
    },
  });
  renderPage();
  answer('Q-W03', '? UNKNOWN');
  userEvent.type(screen.getByLabelText('Note for Q-W03'), 'No pressure readings yet');
  userEvent.click(within(panel()).getByRole('button', { name: 'Analyze with AI' }));

  const card = await within(panel()).findByRole('article', { name: /bottled water/ });
  expect(card).toHaveTextContent('AI SUGGESTION');
  expect(seen!.answers).toContainEqual(expect.objectContaining({ questionId: 'Q-W03', answer: 'UNKNOWN', note: 'No pressure readings yet', safetySensitive: true }));
  expect(seen!.ruleResults.safetyTactics.map((t) => t.id)).toContain('T-Q-W03-SAFE');
  expect(seen!.existing.strategies.map((x) => x.id)).toContain('S-07');

  userEvent.click(within(card).getByRole('button', { name: 'Add task' }));
  expect(getState().tasks.find((t) => t.id === 'VT-AI-01')).toMatchObject({ title: 'Order bottled water for the care home', dueInHours: 12 });
});
