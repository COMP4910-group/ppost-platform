import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RecoveryMatrix from './RecoveryMatrix';
import { resetDemoData } from '../ppost/store';

const ShowLocation = () => {
  const loc = useLocation();
  return <div>at {loc.pathname + loc.search}</div>;
};

const renderMatrix = () =>
  render(
    <MemoryRouter initialEntries={['/matrix']}>
      <Routes>
        <Route path="/matrix" element={<RecoveryMatrix />} />
        <Route path="/ppost" element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => resetDemoData());

test('shows all 8 priorities and flags the unverified water system as critical', () => {
  renderMatrix();
  const grid = screen.getByRole('table', { name: /priorities by sector/i });
  expect(within(grid).getAllByRole('rowheader')).toHaveLength(8);
  expect(
    screen.getByRole('button', { name: /Protect Public Health × Critical Infrastructure: Critical.*1 unknown/ }),
  ).toBeInTheDocument();
});

test('clicking a cell opens its PPOST chain and links to the workspace', () => {
  renderMatrix();
  userEvent.click(screen.getByRole('button', { name: /Protect Property × Housing:/ }));
  const drawer = screen.getByRole('dialog');
  expect(within(drawer).getByText('Install interim modular housing on 42 destroyed lots')).toBeInTheDocument();
  expect(within(drawer).getByText(/P-02: tactic missing owner/)).toBeInTheDocument();

  userEvent.click(within(drawer).getByRole('button', { name: /Open P6 in PPOST Workspace/ }));
  expect(screen.getByText('at /ppost?priority=PR-6')).toBeInTheDocument();
});
