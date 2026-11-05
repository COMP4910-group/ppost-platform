import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './Dashboard';

test('"Generate plan" opens the Initial Recovery Plan page', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/recovery-plan" element={<div>Recovery plan page</div>} />
      </Routes>
    </MemoryRouter>,
  );

  userEvent.click(screen.getByRole('button', { name: 'Generate plan ›' }));

  expect(screen.getByText('Recovery plan page')).toBeInTheDocument();
});
