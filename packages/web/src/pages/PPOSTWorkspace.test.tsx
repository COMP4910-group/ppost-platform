import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PPOSTWorkspace from './PPOSTWorkspace';
import { getState, resetDemoData } from '../ppost/store';

const renderWorkspace = (url = '/ppost?priority=PR-6') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ppost" element={<PPOSTWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => resetDemoData());

test('selecting a priority shows its Problem → Objective → Strategy → Tactic matrix', () => {
  renderWorkspace();
  expect(screen.getByLabelText('Priority')).toHaveValue('PR-6');
  expect(screen.getByText('42 homes destroyed; households cannot return')).toBeInTheDocument();
  expect(screen.getByText('Deploy prefabricated modular units')).toBeInTheDocument();
  expect(screen.getByText('Install interim modular housing on 42 destroyed lots')).toBeInTheDocument();
  // other priorities are not shown
  expect(screen.queryByText('Install temporary modular bridge')).not.toBeInTheDocument();
});

test('a tactic with missing 5W1H fields cannot be submitted for review', () => {
  renderWorkspace();
  userEvent.click(screen.getByText('Insurance and damage documentation support'));
  const drawer = screen.getByRole('dialog');
  userEvent.click(within(drawer).getByRole('button', { name: 'Submit for review' }));

  const alert = within(drawer).getByRole('alert');
  expect(alert).toHaveTextContent('WHO: Accountable person is required');
  expect(alert).toHaveTextContent('WHEN: Start and end dates are required');
  expect(getState().tactics.find((t) => t.id === 'T-020')?.status).toBe('DRAFT');
});

test('adding a problem creates a new record with a gap placeholder', () => {
  renderWorkspace();
  userEvent.click(screen.getByRole('button', { name: '+ Add problem' }));
  const drawer = screen.getByRole('dialog');
  userEvent.type(within(drawer).getByLabelText(/Title/), 'Septic systems on burned lots not inspected');
  userEvent.click(within(drawer).getByRole('button', { name: 'Create' }));

  expect(screen.getByText('Septic systems on burned lots not inspected')).toBeInTheDocument();
  expect(screen.getAllByText(/No objective yet/).length).toBeGreaterThan(0);
  expect(getState().problems.some((p) => p.id === 'P-11' && p.priorityId === 'PR-6')).toBe(true);
});

test('typing is kept as a draft when the drawer is closed, and can be resumed', () => {
  renderWorkspace();
  userEvent.click(screen.getAllByRole('button', { name: '+ Add tactic' })[0]);
  let drawer = screen.getByRole('dialog');
  userEvent.type(within(drawer).getByLabelText(/Title/), 'Deliver units in two phases');
  userEvent.keyboard('{Escape}');

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const bar = screen.getByLabelText('Unsaved drafts');
  expect(bar).toHaveTextContent('Deliver units in two phases');

  userEvent.click(within(bar).getByRole('button', { name: 'Resume' }));
  drawer = screen.getByRole('dialog');
  expect(within(drawer).getByLabelText(/Title/)).toHaveValue('Deliver units in two phases');
  expect(within(drawer).getByText(/Restored your unsaved changes/)).toBeInTheDocument();

  // saving a draft with missing 5W1H marks the tactic Incomplete
  userEvent.click(within(drawer).getByRole('button', { name: 'Save draft' }));
  expect(screen.queryByLabelText('Unsaved drafts')).not.toBeInTheDocument();
  const row = screen.getByText('Deliver units in two phases').closest('tr')!;
  expect(within(row).getByText(/Incomplete/)).toBeInTheDocument();
});

test('Cancel throws away unsaved changes', () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  renderWorkspace();
  userEvent.click(screen.getByText('Temporary fencing and lot security'));
  const drawer = screen.getByRole('dialog');
  const title = within(drawer).getByLabelText(/Title/);
  userEvent.clear(title);
  userEvent.type(title, 'Changed');
  userEvent.click(within(drawer).getByRole('button', { name: 'Cancel' }));

  expect(screen.getByText('Temporary fencing and lot security')).toBeInTheDocument();
  expect(screen.queryByLabelText('Unsaved drafts')).not.toBeInTheDocument();
  expect(getState().drafts['T-016']).toBeUndefined();
});

test('errors are shown next to the buttons, not only at the top', () => {
  renderWorkspace();
  userEvent.click(screen.getAllByRole('button', { name: '+ Add tactic' })[0]);
  const drawer = screen.getByRole('dialog');
  userEvent.click(within(drawer).getByRole('button', { name: 'Submit for review' }));
  expect(within(drawer).getByRole('status')).toHaveTextContent(/fields need attention/);
  expect(within(drawer).getByRole('alert')).toHaveTextContent('Title: Title is required');
});

test('AI suggestions are a labelled placeholder; using one opens a draft for review', async () => {
  renderWorkspace();
  userEvent.click(screen.getByText('42 homes destroyed; households cannot return'));
  const drawer = screen.getByRole('dialog');
  const ai = within(drawer).getByLabelText('AI suggestions');
  expect(ai).toHaveTextContent(/not connected/i);

  userEvent.click(within(ai).getByText('Preview with sample suggestions'));
  expect(await within(ai).findAllByText('SAMPLE · not AI')).toHaveLength(2);
  userEvent.click(within(ai).getAllByRole('button', { name: 'Use as draft' })[0]);

  const next = screen.getByRole('dialog');
  expect(within(next).getByText('New objective')).toBeInTheDocument();
  // nothing saved until the person presses Create
  expect(getState().objectives.some((o) => o.title.startsWith('Stabilize the immediate impact'))).toBe(false);
});
