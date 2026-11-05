import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the app shell and dashboard', () => {
  render(<App />);
  expect(screen.getByText('PPOST RecoveryOS')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Clearwater Ridge Wildfire' })).toBeInTheDocument();
  expect(screen.getByText('Initial Recovery Plan')).toBeInTheDocument();
});
