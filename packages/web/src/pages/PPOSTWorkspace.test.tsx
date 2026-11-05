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
  userEvent.click(within(drawer).getByRole('button', { name: 'Save & submit for review' }));

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
