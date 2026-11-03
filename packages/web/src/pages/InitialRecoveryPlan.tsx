import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderPlanDocument } from '../recoveryPlan/document';
import type { RenderPlanDocument } from '../recoveryPlan/document';
import { MOCK_DISASTER_ID, createMockRecoveryPlanApi } from '../recoveryPlan/mockApi';
import { PlanPreview, PreviewLegend } from '../recoveryPlan/PlanPreview';
import type { GenerateDraftResult, RecoveryPlanApi } from '../recoveryPlan/types';

/**
 * Initial Recovery Plan review. The draft and its DOCX live only in this
 * component's memory: no browser storage, no backend. Approval is simulated.
 */
type DocumentState =
  | { status: 'rendering' }
  | { status: 'ready'; url: string; filename: string; size: number }
  | { status: 'error'; message: string };

type DemoState =
  | { status: 'idle'; notice?: string }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'review'; result: GenerateDraftResult }
  | { status: 'approved'; result: GenerateDraftResult; approvedAt: string; document: DocumentState };

export interface InitialRecoveryPlanProps {
  /** Injected in tests; defaults to the demo mock adapter. */
  api?: RecoveryPlanApi;
  /** Injected in tests; defaults to the in-browser DOCX renderer. */
  renderDocument?: RenderPlanDocument;
  disasterId?: string;
}

const InitialRecoveryPlan = ({
  api,
  renderDocument = renderPlanDocument,
  disasterId = MOCK_DISASTER_ID,
}: InitialRecoveryPlanProps) => {
  const [state, setState] = useState<DemoState>({ status: 'idle' });
  const [simulateFailure, setSimulateFailure] = useState(false);
  const simulateFailureRef = useRef(simulateFailure);
  simulateFailureRef.current = simulateFailure;

  const defaultApi = useMemo(
    () => createMockRecoveryPlanApi({ shouldFail: () => simulateFailureRef.current }),
    [],
  );
  const planApi = api ?? defaultApi;

  // One controller per generation: leaving the page aborts it, and a result
  // from an aborted generation is ignored. (A plain "mounted" flag breaks
  // under StrictMode, which runs this cleanup once and then re-mounts.)
  const inFlight = useRef<AbortController | null>(null);

  // The downloadable document belongs to one approval of one draft. Bumping the
  // token invalidates it: a render still in progress is discarded on arrival.
  const approvalToken = useRef(0);
  const documentUrl = useRef<string | null>(null);
  const releaseDocument = () => {
    approvalToken.current += 1;
    if (documentUrl.current) URL.revokeObjectURL(documentUrl.current);
    documentUrl.current = null;
  };

  useEffect(
    () => () => {
      inFlight.current?.abort();
      approvalToken.current += 1;
      if (documentUrl.current) URL.revokeObjectURL(documentUrl.current);
      documentUrl.current = null;
    },
    [],
  );

  const generate = async () => {
    releaseDocument();
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ status: 'loading' });
    try {
      const result = await planApi.generateDraft(disasterId, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'review', result });
    } catch (error) {
      if (!controller.signal.aborted)
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Draft generation failed.' });
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  };

  /** Renders the exact draft under review, in memory, for this approval only. */
  const prepareDocument = async (result: GenerateDraftResult, approvedAt: string) => {
    releaseDocument();
    const token = approvalToken.current;
    setState({ status: 'approved', result, approvedAt, document: { status: 'rendering' } });
    try {
      const doc = await renderDocument(result.draft, {
        draftId: result.draftId,
        approval: { kind: 'SIMULATED', approvedAt },
      });
      if (token !== approvalToken.current) return;
      const url = URL.createObjectURL(doc.blob);
      documentUrl.current = url;
      setState({
        status: 'approved',
        result,
        approvedAt,
        document: { status: 'ready', url, filename: doc.filename, size: doc.blob.size },
      });
    } catch (error) {
      if (token !== approvalToken.current) return;
      setState({
        status: 'approved',
        result,
        approvedAt,
        document: { status: 'error', message: error instanceof Error ? error.message : 'The document could not be created.' },
      });
    }
  };

  const reject = () => {
    releaseDocument();
    setState({ status: 'idle', notice: 'Draft rejected and discarded. Nothing was saved.' });
  };
  const approve = () => {
    if (state.status === 'review') prepareDocument(state.result, new Date().toISOString());
  };
  const startOver = () => {
    releaseDocument();
    setState({ status: 'idle' });
  };

  return (
    <div className="p-6 bg-gray-950 min-h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Initial Recovery Plan</h1>
          <p className="text-sm text-gray-400 mt-1">
            Generate an AI-assisted draft from the disaster's planning data, review it, then approve or reject it.
          </p>
        </div>
        {(state.status === 'idle' || state.status === 'error') && (
          <button
            onClick={generate}
            className="bg-green-600 hover:bg-green-500 text-sm px-4 py-2 rounded text-white"
          >
            ✦ Generate Initial Recovery Plan
          </button>
        )}
      </div>

      {planApi.isMock && (
        <div role="note" className="border border-yellow-700 bg-yellow-950/40 text-yellow-200 text-xs rounded p-3 space-y-1">
          <div className="font-medium">Demo mode: synthetic data, mock AI, nothing saved</div>
          <div>
            Drafts come from a mock adapter using SYNTHETIC Clearwater Ridge data, not real client data. No AI model is
            called and nothing is sent to a server. Approval and rejection are simulated, and the draft exists only in
            this page's memory: refreshing or leaving the page resets the demo.
          </div>
          {!api && (
            <label className="flex items-center gap-2 pt-1 text-yellow-300">
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
              />
              Simulate a generation failure (to try the error and retry state)
            </label>
          )}
        </div>
      )}

      {state.status === 'idle' && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-sm text-gray-400">
          {state.notice ? (
            <p role="status" className="text-gray-200">{state.notice}</p>
          ) : (
            <p>No draft yet. Generating a draft never saves anything; a person must review it first.</p>
          )}
        </div>
      )}

      {state.status === 'loading' && (
        <div role="status" className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-sm text-gray-300 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
          Generating draft from {disasterId}…
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" className="bg-red-950/40 rounded-lg p-4 border border-red-800 text-sm space-y-2">
          <div className="text-red-300 font-medium">The draft could not be generated.</div>
          <div className="text-red-200 text-xs">{state.message}</div>
          <button
            onClick={generate}
            className="border border-red-700 text-red-200 text-xs px-3 py-1.5 rounded hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      )}

      {(state.status === 'review' || state.status === 'approved') && (
        <>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-3 sticky top-0 z-10">
            {state.status === 'review' ? (
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="text-white font-medium">Review required.</span>{' '}
                  <span className="text-gray-400">Draft {state.result.draftId} has not been approved.</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={reject}
                    className="border border-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-800 text-gray-300"
                  >
                    Reject draft
                  </button>
                  <button
                    onClick={approve}
                    className="bg-green-600 hover:bg-green-500 text-sm px-4 py-2 rounded text-white"
                  >
                    Approve draft
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div role="status" className="text-sm">
                  <span className="text-green-400 font-medium">Approved (simulated).</span>{' '}
                  <span className="text-gray-400">
                    Nothing was saved: this demo has no backend. In the real workflow, approval will save this exact
                    draft and check that the source data has not changed since generation.
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {state.document.status === 'ready' ? (
                    <a
                      href={state.document.url}
                      download={state.document.filename}
                      className="bg-green-600 hover:bg-green-500 text-sm px-4 py-2 rounded text-white"
                    >
                      Download DOCX
                    </a>
                  ) : (
                    <button
                      disabled
                      className="border border-gray-800 text-sm px-4 py-2 rounded text-gray-600 cursor-not-allowed"
                    >
                      {state.document.status === 'rendering' ? 'Preparing DOCX…' : 'Download DOCX'}
                    </button>
                  )}
                  <button
                    onClick={startOver}
                    className="border border-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-800 text-gray-300"
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}
            {state.status === 'approved' && state.document.status === 'ready' && (
              <p className="text-xs text-gray-500">
                {state.document.filename} ({Math.ceil(state.document.size / 1024)} KB) was created in this browser from
                the draft below and is marked SYNTHETIC DEMO with simulated approval. It is not stored anywhere:
                rejecting, starting over, generating a new draft or leaving the page discards it.
              </p>
            )}
            {state.status === 'approved' && state.document.status === 'error' && (
              <div role="alert" className="text-xs text-red-300 flex items-center gap-3">
                <span>The DOCX could not be created: {state.document.message}</span>
                <button
                  onClick={() => prepareDocument(state.result, state.approvedAt)}
                  className="border border-red-700 text-red-200 px-2 py-1 rounded hover:bg-red-900/40"
                >
                  Try again
                </button>
              </div>
            )}
            <PreviewLegend />
          </div>
          <PlanPreview draft={state.result.draft} />
        </>
      )}
    </div>
  );
};

export default InitialRecoveryPlan;
