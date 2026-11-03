import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InitialRecoveryPlan from './InitialRecoveryPlan';
import { createMockRecoveryPlanApi } from '../recoveryPlan/mockApi';
import mockDraftJson from '../recoveryPlan/mockDraft.json';
import type { PlanDocument, RenderPlanDocument } from '../recoveryPlan/document';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  // jsdom has no object URLs; record them instead.
  URL.createObjectURL = jest.fn(() => {
    const url = `blob:demo/${created.length + 1}`;
    created.push(url);
    return url;
  });
  URL.revokeObjectURL = jest.fn((url: string) => {
    revoked.push(url);
  });
});
afterEach(() => {
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

/** A renderer whose renders finish only when the test says so. */
function controllableRenderer() {
  const pending: { draftId: string; resolve: (d: PlanDocument) => void; reject: (e: Error) => void }[] = [];
  const renderDocument: jest.MockedFunction<RenderPlanDocument> = jest.fn(
    (_draft, options) =>
      new Promise<PlanDocument>((resolve, reject) => pending.push({ draftId: options.draftId, resolve, reject })),
  );
  const docFor = (draftId: string): PlanDocument => ({
    blob: new Blob(['docx bytes'], { type: DOCX }),
    filename: `SYNTHETIC-DEMO_Initial-Recovery-Plan_EV-2026-014_${draftId}.docx`,
  });
  return { renderDocument, pending, docFor };
}

const setup = (renderDocument?: RenderPlanDocument) =>
  render(<InitialRecoveryPlan api={createMockRecoveryPlanApi({ delayMs: 0 })} renderDocument={renderDocument} />);
const generate = async () => {
  userEvent.click(screen.getByRole('button', { name: /Generate Initial Recovery Plan/ }));
  await screen.findByRole('article', { name: 'Initial Recovery Plan draft preview' });
};
const approve = () => userEvent.click(screen.getByRole('button', { name: 'Approve draft' }));
const downloadLink = () => screen.queryByRole('link', { name: 'Download DOCX' });

describe('Initial Recovery Plan DOCX download', () => {
  it('renders the exact reviewed draft with a simulated approval, then enables the download', async () => {
    const r = controllableRenderer();
    setup(r.renderDocument);
    await generate();
    expect(r.renderDocument).not.toHaveBeenCalled();

    approve();

    expect(screen.getByRole('button', { name: 'Preparing DOCX…' })).toBeDisabled();
    expect(downloadLink()).not.toBeInTheDocument();
    expect(r.renderDocument).toHaveBeenCalledTimes(1);
    const [draft, options] = r.renderDocument.mock.calls[0];
    expect(draft).toEqual(mockDraftJson);
    expect(draft.isSynthetic).toBe(true);
    expect(options.draftId).toBe('mock-draft-1');
    expect(options.approval.kind).toBe('SIMULATED');
    expect(Number.isNaN(Date.parse(options.approval.approvedAt))).toBe(false);

    r.pending[0].resolve(r.docFor('mock-draft-1'));
    const link = await screen.findByRole('link', { name: 'Download DOCX' });
    expect(link).toHaveAttribute('href', 'blob:demo/1');
    expect(link).toHaveAttribute('download', 'SYNTHETIC-DEMO_Initial-Recovery-Plan_EV-2026-014_mock-draft-1.docx');
    expect(screen.getByText(/is marked SYNTHETIC DEMO with simulated approval\. It is not stored anywhere/)).toBeInTheDocument();
  });

  it('never renders a document before approval or after rejection', async () => {
    const r = controllableRenderer();
    setup(r.renderDocument);
    await generate();

    userEvent.click(screen.getByRole('button', { name: 'Reject draft' }));

    expect(r.renderDocument).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
    expect(downloadLink()).not.toBeInTheDocument();
  });

  it('start over revokes the download, and a new draft gets its own document', async () => {
    const r = controllableRenderer();
    setup(r.renderDocument);
    await generate();
    approve();
    r.pending[0].resolve(r.docFor('mock-draft-1'));
    await screen.findByRole('link', { name: 'Download DOCX' });

    userEvent.click(screen.getByRole('button', { name: 'Start over' }));

    expect(revoked).toEqual(['blob:demo/1']);
    expect(downloadLink()).not.toBeInTheDocument();

    await generate();
    expect(downloadLink()).not.toBeInTheDocument();
    approve();
    expect(r.renderDocument.mock.calls[1][1].draftId).toBe('mock-draft-2');
    r.pending[1].resolve(r.docFor('mock-draft-2'));
    const link = await screen.findByRole('link', { name: 'Download DOCX' });
    expect(link).toHaveAttribute('href', 'blob:demo/2');
    expect(link).toHaveAttribute('download', expect.stringContaining('mock-draft-2'));
  });

  it('discards a render that finishes after the approval was invalidated', async () => {
    const r = controllableRenderer();
    setup(r.renderDocument);
    await generate();
    approve();

    userEvent.click(screen.getByRole('button', { name: 'Start over' }));
    r.pending[0].resolve(r.docFor('mock-draft-1'));
    await Promise.resolve();
    await Promise.resolve();

    expect(created).toHaveLength(0);
    expect(downloadLink()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Initial Recovery Plan/ })).toBeInTheDocument();
  });

  it('shows a document error with a working retry', async () => {
    const r = controllableRenderer();
    setup(r.renderDocument);
    await generate();
    approve();

    r.pending[0].reject(new Error('Renderer unavailable'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The DOCX could not be created: Renderer unavailable');
    expect(downloadLink()).not.toBeInTheDocument();

    userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(r.renderDocument).toHaveBeenCalledTimes(2);
    expect(r.renderDocument.mock.calls[1][1].approval.approvedAt).toBe(r.renderDocument.mock.calls[0][1].approval.approvedAt);
    r.pending[1].resolve(r.docFor('mock-draft-1'));
    expect(await screen.findByRole('link', { name: 'Download DOCX' })).toBeInTheDocument();
  });

  it('revokes the document when the page is left', async () => {
    const r = controllableRenderer();
    const { unmount } = setup(r.renderDocument);
    await generate();
    approve();
    r.pending[0].resolve(r.docFor('mock-draft-1'));
    await screen.findByRole('link', { name: 'Download DOCX' });

    unmount();

    expect(revoked).toEqual(['blob:demo/1']);
  });

  it('produces a real DOCX with the default in-browser renderer', async () => {
    setup();
    await generate();
    approve();

    const link = await screen.findByRole('link', { name: 'Download DOCX' }, { timeout: 5000 });
    expect(link).toHaveAttribute('download', 'SYNTHETIC-DEMO_Initial-Recovery-Plan_EV-2026-014_mock-draft-1.docx');
    const blob = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blob.type).toBe(DOCX);
    expect(blob.size).toBeGreaterThan(5000);
    await waitFor(() => expect(screen.getByText(/KB\) was created in this browser/)).toBeInTheDocument());
  });
});
