import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InitialRecoveryPlan from './InitialRecoveryPlan';
import { createMockRecoveryPlanApi } from '../recoveryPlan/mockApi';
import type { GenerateDraftResult, RecoveryPlanApi } from '../recoveryPlan/types';

/**
 * Regression: in development, src/index.tsx renders the app inside
 * <React.StrictMode>, which mounts, unmounts and re-mounts every component
 * once. Generation then stayed on "Generating draft…" forever.
 */
const strict = (ui: React.ReactElement) => render(<React.StrictMode>{ui}</React.StrictMode>);
const generateButton = () => screen.getByRole('button', { name: /Generate Initial Recovery Plan/ });
const preview = (timeout = 3000) =>
  screen.findByRole('article', { name: 'Initial Recovery Plan draft preview' }, { timeout });

describe('InitialRecoveryPlan under React.StrictMode', () => {
  it('completes generation with the default demo adapter, as in the running app', async () => {
    strict(<InitialRecoveryPlan />);

    userEvent.click(generateButton());
    expect(screen.getByRole('status')).toHaveTextContent('Generating draft from EV-2026-014');

    expect(await preview()).toBeInTheDocument();
    expect(screen.queryByText(/Generating draft/)).not.toBeInTheDocument();
  });

  it('shows the error and recovers on retry', async () => {
    let fail = true;
    const api = createMockRecoveryPlanApi({ delayMs: 0, shouldFail: () => fail });
    strict(<InitialRecoveryPlan api={api} />);

    userEvent.click(generateButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Simulated failure');

    fail = false;
    userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await preview()).toBeInTheDocument();
  });
});

describe('InitialRecoveryPlan cancellation', () => {
  function pendingApi() {
    const calls: { signal?: AbortSignal; resolve: (r: GenerateDraftResult) => void }[] = [];
    const api: RecoveryPlanApi = {
      isMock: true,
      generateDraft: (_disasterId, options) =>
        new Promise((resolve) => calls.push({ signal: options?.signal, resolve })),
    };
    return { api, calls };
  }

  it('aborts an in-flight generation when the page unmounts', () => {
    const { api, calls } = pendingApi();
    const { unmount } = strict(<InitialRecoveryPlan api={api} />);

    userEvent.click(generateButton());
    expect(calls).toHaveLength(1);
    expect(calls[0].signal?.aborted).toBe(false);

    unmount();
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it('ignores a result that arrives after the page unmounted', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { api, calls } = pendingApi();
      const { draft } = await createMockRecoveryPlanApi({ delayMs: 0 }).generateDraft('EV-2026-014');
      const { unmount } = strict(<InitialRecoveryPlan api={api} />);
      userEvent.click(generateButton());
      unmount();

      calls[0].resolve({ draftId: 'late', draft, promptVersion: 'irp-narrative-v1' });
      await Promise.resolve();

      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});

describe('mock adapter cancellation', () => {
  it('stops the simulated generation and rejects with an AbortError', async () => {
    jest.useFakeTimers();
    try {
      const api = createMockRecoveryPlanApi({ delayMs: 800 });
      const controller = new AbortController();
      const result = api.generateDraft('EV-2026-014', { signal: controller.signal });

      controller.abort();

      await expect(result).rejects.toMatchObject({ name: 'AbortError' });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
