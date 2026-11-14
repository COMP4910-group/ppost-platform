/**
 * Violet panel = AI. Shows "not connected" until the AI service registers a provider
 * (see aiSuggestions.ts). Nothing here is ever saved without a person pressing "Use" and then Save.
 */
import React, { useState } from 'react';
import { getSuggestionProvider, PpostSuggestion, sampleSuggestionProvider, SuggestionRequest } from './aiSuggestions';

const KIND_PLURAL: Record<SuggestionRequest['want'], string> = {
  objective: 'objectives', strategy: 'strategies', tactic: 'tactics', problem: 'problems', 'assessment-insights': 'tasks',
};

export function AiSuggestionsPanel({ request, onUse }: {
  request: SuggestionRequest;
  onUse: (s: PpostSuggestion, isSample: boolean) => void;
}) {
  const provider = getSuggestionProvider();
  const [items, setItems] = useState<PpostSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSample, setIsSample] = useState(false);

  const run = async (sample: boolean) => {
    const p = sample ? sampleSuggestionProvider : provider;
    if (!p) return;
    setLoading(true); setError(''); setIsSample(sample);
    try {
      setItems(await p.suggest(request));
    } catch {
      setError('Could not get suggestions. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const label = isSample ? 'SAMPLE · not AI' : 'AI SUGGESTION';

  return (
    <section aria-label="AI suggestions" className="rounded-lg border border-violet-700 bg-violet-950/30 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold text-violet-200">✦ AI suggested {KIND_PLURAL[request.want]}</h3>
        {provider ? (
          <button onClick={() => run(false)} disabled={loading}
            className="text-[11px] px-2 py-1 rounded border border-violet-600 text-violet-200 hover:bg-violet-900 disabled:opacity-50">
            {loading ? 'Thinking…' : items ? 'Refresh' : 'Get suggestions'}
          </button>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-violet-300/80 border border-violet-800 rounded px-1.5 py-0.5">not connected</span>
        )}
      </div>

      {!provider && !items && (
        <div className="text-[11px] text-violet-200/80">
          The AI service isn't connected to PPOST yet. When it is, it will suggest {KIND_PLURAL[request.want]} here for you to review.
          Nothing is added unless you choose it and save.
          <button onClick={() => run(true)} className="block mt-2 text-violet-300 underline hover:text-violet-100">
            Preview with sample suggestions
          </button>
        </div>
      )}

      {error && <div className="text-[11px] text-red-300">{error}</div>}
      {items && items.length === 0 && <div className="text-[11px] text-violet-200/80">No suggestions right now.</div>}

      {items?.map((sug) => (
        <div key={sug.id} className="mt-2 rounded border border-violet-800 bg-gray-950 p-2.5">
          <div className="text-[10px] font-semibold tracking-wide text-violet-300 mb-1">{label}</div>
          <div className="text-sm text-gray-100">{sug.title}</div>
          <div className="text-[11px] text-gray-400 mt-1">{sug.rationale}</div>
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <span className="text-[10px] text-gray-500">Based on:</span>
            {sug.sources.map((src) => (
              <span key={src} className="font-mono text-[10px] bg-gray-800 text-gray-300 px-1 rounded">{src}</span>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onUse(sug, isSample)}
              className="text-[11px] px-2 py-1 rounded bg-violet-700 hover:bg-violet-600 text-white">Use as draft</button>
            <button onClick={() => setItems(items.filter((x) => x.id !== sug.id))}
              className="text-[11px] px-2 py-1 rounded text-gray-400 hover:text-white">Dismiss</button>
          </div>
        </div>
      ))}
    </section>
  );
}
