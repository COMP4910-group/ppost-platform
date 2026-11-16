/**
 * Impact Assessment → AI "deeper / hidden tasks".
 * The rules engine already proposes problems, safety tactics and verification tasks.
 * The AI reads the answers + notes + those results + the current PPOST plan and suggests what was missed.
 * Every suggestion needs a person: Add to PPOST (as DRAFT), Edit as draft, or Dismiss.
 */
import React, { useState } from 'react';
import { AssessmentInsightContext, getSuggestionProvider, PpostSuggestion, sampleSuggestionProvider } from './aiSuggestions';
import { clearInsight, markInsight, setInsights, usePpost } from './store';
import { addInsightToPpost, canAddDirectly, draftTargetFor } from './assessmentInsights';
import type { EditorTarget } from './EntityEditor';

const KIND_LABEL: Record<string, string> = { problem: 'Problem', tactic: 'Tactic', task: 'Task', objective: 'Objective', strategy: 'Strategy' };

export function AiInsightsPanel({ buildContext, onDraft, answeredCount }: {
  buildContext: () => AssessmentInsightContext;
  onDraft: (t: EditorTarget) => void;
  answeredCount: number;
}) {
  const s = usePpost();
  const provider = getSuggestionProvider();
  const { insights, insightsFrom, insightsAt, insightState } = s.assessment;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const isSample = insightsFrom === 'SAMPLE';

  const run = async (sample: boolean) => {
    const p = sample ? sampleSuggestionProvider : provider;
    if (!p) return;
    setLoading(true); setError('');
    try {
      const out = await p.suggest({ want: 'assessment-insights', context: buildContext() });
      setInsights(out, sample ? 'SAMPLE' : 'AI');
    } catch {
      setError('Could not get AI suggestions. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const add = (sug: PpostSuggestion) => {
    const id = addInsightToPpost(sug, isSample);
    if (id) markInsight(sug.id, { status: 'added', recordId: id });
  };
  const draft = (sug: PpostSuggestion) => {
    const t = draftTargetFor(sug, isSample);
    if (!t) return;
    markInsight(sug.id, { status: 'drafted', recordId: t.record.id });
    onDraft(t);
  };

  const active = insights.filter((i) => insightState[i.id]?.status !== 'dismissed');
  const dismissed = insights.filter((i) => insightState[i.id]?.status === 'dismissed');
  const label = isSample ? 'SAMPLE · not AI' : 'AI SUGGESTION';

  return (
    <section aria-label="AI deeper tasks" className="rounded-lg border border-violet-700 bg-violet-950/30 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-xs font-semibold text-violet-200">✦ AI: deeper or hidden tasks</h3>
        {provider ? (
          <button onClick={() => run(false)} disabled={loading || answeredCount === 0}
            className="text-[11px] px-2 py-1 rounded border border-violet-600 text-violet-200 hover:bg-violet-900 disabled:opacity-50">
            {loading ? 'Analyzing…' : insights.length && !isSample ? 'Re-analyze' : 'Analyze with AI'}
          </button>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-violet-300/80 border border-violet-800 rounded px-1.5 py-0.5">not connected</span>
        )}
      </div>
      <p className="text-[11px] text-violet-200/80 mb-2">
        Reads your answers, notes and the rules-engine results above, and suggests tasks that may have been missed.
        Nothing is added unless you choose it.
      </p>

      {!provider && (
        <button onClick={() => run(true)} disabled={loading} className="text-[11px] text-violet-300 underline hover:text-violet-100">
          {insights.length && isSample ? 'Refresh sample suggestions' : 'Preview with sample suggestions'}
        </button>
      )}
      {answeredCount === 0 && provider && <div className="text-[11px] text-violet-200/70">Answer some questions first.</div>}
      {error && <div className="text-[11px] text-red-300 mt-1">{error}</div>}
      {insightsAt && (
        <div className="text-[10px] text-gray-500 mt-1">
          {isSample ? 'Sample' : 'AI'} suggestions from {new Date(insightsAt).toLocaleTimeString()} — re-run after changing answers.
        </div>
      )}

      {active.map((sug) => {
        const st = insightState[sug.id];
        const direct = canAddDirectly(sug, s);
        const canDraft = sug.kind === 'problem' || sug.kind === 'tactic';
        const parent = sug.parentStrategyId && s.strategies.find((x) => x.id === sug.parentStrategyId);
        return (
          <article key={sug.id} aria-label={`Insight: ${sug.title}`} className="mt-2 rounded border border-violet-800 bg-gray-950 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[10px] font-semibold tracking-wide text-violet-300">{label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{KIND_LABEL[sug.kind]}</span>
            </div>
            <div className="text-sm text-gray-100">{sug.title}</div>
            <div className="text-[11px] text-gray-400 mt-1">{sug.rationale}</div>
            {sug.kind === 'tactic' && (
              <div className="text-[11px] text-gray-500 mt-1">
                {parent ? <>Attach to: <span className="font-mono">{parent.id}</span> {parent.title}</> : 'No strategy chosen — use "Edit as draft" to pick one.'}
              </div>
            )}
            {sug.kind === 'task' && sug.assignedRole && (
              <div className="text-[11px] text-gray-500 mt-1">→ {sug.assignedRole}{sug.dueInHours ? `, due ${sug.dueInHours}h` : ''}</div>
            )}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              <span className="text-[10px] text-gray-500">Based on:</span>
              {sug.sources.map((src) => <span key={src} className="font-mono text-[10px] bg-gray-800 text-gray-300 px-1 rounded">{src}</span>)}
            </div>

            {st?.status === 'added' ? (
              <div role="status" className="mt-2 text-[11px] text-green-300">✓ Added to PPOST as draft <span className="font-mono">{st.recordId}</span></div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => add(sug)} disabled={!direct}
                  title={direct ? 'Adds it as a DRAFT you can edit later' : 'Pick where it belongs with "Edit as draft"'}
                  className="text-[11px] px-2 py-1 rounded bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-40">
                  {sug.kind === 'task' ? 'Add task' : 'Add to PPOST'}
                </button>
                {canDraft && (
                  <button onClick={() => draft(sug)} className="text-[11px] px-2 py-1 rounded border border-violet-600 text-violet-200 hover:bg-violet-900">
                    Edit as draft
                  </button>
                )}
                <button onClick={() => markInsight(sug.id, { status: 'dismissed' })} className="text-[11px] px-2 py-1 rounded text-gray-400 hover:text-white">
                  Dismiss
                </button>
                {st?.status === 'drafted' && <span className="text-[11px] text-blue-300 self-center">Draft opened ({st.recordId})</span>}
              </div>
            )}
          </article>
        );
      })}

      {dismissed.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowDismissed(!showDismissed)} className="text-[11px] text-gray-400 hover:text-white">
            {showDismissed ? 'Hide' : 'Show'} dismissed ({dismissed.length})
          </button>
          {showDismissed && dismissed.map((sug) => (
            <div key={sug.id} className="flex items-center justify-between gap-2 text-[11px] text-gray-500 mt-1">
              <span className="line-through truncate">{sug.title}</span>
              <button onClick={() => clearInsight(sug.id)} className="underline">Undo</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
