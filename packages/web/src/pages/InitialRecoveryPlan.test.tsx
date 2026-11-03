import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InitialRecoveryPlan from './InitialRecoveryPlan';
import { createMockRecoveryPlanApi } from '../recoveryPlan/mockApi';
import type { GenerateDraftResult, RecoveryPlanApi } from '../recoveryPlan/types';

const generateButton = () => screen.getByRole('button', { name: /Generate Initial Recovery Plan/ });

async function generateDraft() {
  userEvent.click(generateButton());
  return screen.findByRole('article', { name: 'Initial Recovery Plan draft preview' });
}

function section(preview: HTMLElement, title: string) {
  return within(preview).getByRole('region', { name: title });
}

/** An adapter whose generations resolve or reject only when the test says so. */
function controllableApi() {
  const pending: { resolve: (r: GenerateDraftResult) => void; reject: (e: Error) => void }[] = [];
  const api: RecoveryPlanApi & { generateDraft: jest.Mock } = {
    isMock: true,
    generateDraft: jest.fn(
      () => new Promise<GenerateDraftResult>((resolve, reject) => pending.push({ resolve, reject })),
    ),
  };
  return { api, pending };
}

describe('InitialRecoveryPlan demo', () => {
  it('states that the demo is synthetic, simulated and memory-only', () => {
    render(<InitialRecoveryPlan api={createMockRecoveryPlanApi({ delayMs: 0 })} />);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Demo mode: synthetic data, mock AI, nothing saved');
    expect(note).toHaveTextContent('not real client data');
    expect(note).toHaveTextContent('refreshing or leaving the page resets the demo');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows a loading state, then a readable preview of the generated draft', async () => {
    const { api, pending } = controllableApi();
    const { draft } = await createMockRecoveryPlanApi({ delayMs: 0 }).generateDraft('EV-2026-014');
    render(<InitialRecoveryPlan api={api} />);

    userEvent.click(generateButton());

    expect(screen.getByRole('status')).toHaveTextContent('Generating draft from EV-2026-014');
    expect(screen.queryByRole('button', { name: /Generate Initial Recovery Plan/ })).not.toBeInTheDocument();
    expect(api.generateDraft).toHaveBeenCalledTimes(1);
    expect(api.generateDraft).toHaveBeenCalledWith('EV-2026-014', { signal: expect.any(AbortSignal) });

    pending[0].resolve({ draftId: 'draft-a', draft, promptVersion: 'irp-narrative-v1' });
    const preview = await screen.findByRole('article', { name: 'Initial Recovery Plan draft preview' });
    expect(within(preview).getByRole('heading', { name: 'Initial Recovery Plan: Clearwater Ridge Wildfire' })).toBeInTheDocument();
    expect(screen.getByText(/Draft draft-a has not been approved/)).toBeInTheDocument();
  });

  it('distinguishes supplied facts, AI recommendations, missing information and source IDs', async () => {
    render(<InitialRecoveryPlan api={createMockRecoveryPlanApi({ delayMs: 0 })} />);
    const preview = await generateDraft();

    // Supplied facts, with their source record IDs.
    const event = section(preview, 'Event overview');
    expect(within(event).getByText('Interior British Columbia, Canada')).toBeInTheDocument();
    expect(within(event).getAllByTitle('Source record ID')[0]).toHaveTextContent('EV-2026-014');
    const t014 = preview.querySelector('[data-record-id="T-014"]') as HTMLElement;
    expect(within(t014).getAllByText('L. Tremblay')).toHaveLength(2);
    expect(within(t014).getByText('2026-10-12')).toBeInTheDocument();

    // AI recommendations are labelled and appear only in AI-bearing sections.
    const aiItems = within(preview).getAllByTestId('ai-item');
    expect(aiItems).toHaveLength(5);
    aiItems.forEach((item) => expect(item).toHaveTextContent('AI recommendation: not verified; requires human review'));
    expect(within(section(preview, 'Event overview')).queryAllByTestId('ai-item')).toHaveLength(0);
    expect(within(section(preview, 'Recommended next steps')).getByText('Resolve the water system UNKNOWN')).toBeInTheDocument();

    // Missing information and UNKNOWN answers.
    const q = preview.querySelector('[data-record-id="Q-W03"]') as HTMLElement;
    expect(within(q).getByText('UNKNOWN')).toHaveAttribute('data-status', 'REQUIRES_CONFIRMATION');
    expect(within(q).getByText('Requires confirmation')).toBeInTheDocument();
    const unanswered = preview.querySelector('[data-record-id="Q-F02"]') as HTMLElement;
    expect(within(unanswered).getByText('Not provided')).toHaveAttribute('data-status', 'NOT_PROVIDED');
  });

  it('shows an error with a working retry', async () => {
    const { api, pending } = controllableApi();
    const { draft } = await createMockRecoveryPlanApi({ delayMs: 0 }).generateDraft('EV-2026-014');
    render(<InitialRecoveryPlan api={api} />);

    userEvent.click(generateButton());
    pending[0].reject(new Error('Mock service unavailable'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The draft could not be generated.');
    expect(alert).toHaveTextContent('Mock service unavailable');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('status')).toHaveTextContent('Generating draft');
    pending[1].resolve({ draftId: 'draft-retry', draft, promptVersion: 'irp-narrative-v1' });

    expect(await screen.findByRole('article', { name: 'Initial Recovery Plan draft preview' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.generateDraft).toHaveBeenCalledTimes(2);
  });

  it('demonstrates the error state through the built-in failure toggle', async () => {
    jest.useFakeTimers();
    try {
      render(<InitialRecoveryPlan />);
      userEvent.click(screen.getByLabelText(/Simulate a generation failure/));
      userEvent.click(generateButton());
      jest.runAllTimers();
      expect(await screen.findByRole('alert')).toHaveTextContent('Simulated failure');
    } finally {
      jest.useRealTimers();
    }
  });

  it('approve only changes the in-memory demo status and offers no working download', async () => {
    render(<InitialRecoveryPlan api={createMockRecoveryPlanApi({ delayMs: 0 })} />);
    await generateDraft();

    userEvent.click(screen.getByRole('button', { name: 'Approve draft' }));

    expect(screen.getByRole('status')).toHaveTextContent('Approved (simulated).');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing was saved');
    expect(screen.queryByRole('button', { name: 'Approve draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeDisabled();
    expect(screen.getByText(/DOCX download is not available yet/)).toBeInTheDocument();
    // The approved draft stays visible for reference.
    expect(screen.getByRole('article', { name: 'Initial Recovery Plan draft preview' })).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(generateButton()).toBeInTheDocument();
  });

  it('reject discards the draft, and a new generation starts fresh', async () => {
    render(<InitialRecoveryPlan api={createMockRecoveryPlanApi({ delayMs: 0 })} />);
    await generateDraft();
    expect(screen.getByText(/Draft mock-draft-1 has not been approved/)).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Reject draft' }));

    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Draft rejected and discarded. Nothing was saved.');
    expect(screen.queryByText(/Approved \(simulated\)/)).not.toBeInTheDocument();

    await generateDraft();
    expect(screen.getByText(/Draft mock-draft-2 has not been approved/)).toBeInTheDocument();
  });

  it('never writes the draft to browser storage', async () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    try {
      render(<InitialRecoveryPlan api={createMockRecoveryPlanApi({ delayMs: 0 })} />);
      await generateDraft();
      userEvent.click(screen.getByRole('button', { name: 'Approve draft' }));
      await waitFor(() => expect(screen.getByText(/Approved \(simulated\)/)).toBeInTheDocument());

      expect(setItem).not.toHaveBeenCalled();
      expect(window.localStorage).toHaveLength(0);
      expect(window.sessionStorage).toHaveLength(0);
    } finally {
      setItem.mockRestore();
    }
  });
});
