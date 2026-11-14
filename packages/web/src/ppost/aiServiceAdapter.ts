/**
 * Adapter between PPOST and @ppost/ai-service (Qiaomu).
 *
 * ai-service runs on a server (it needs the Anthropic API key), so the browser talks to it
 * through an HTTP route on the API (Earl). When REACT_APP_PPOST_AI_URL is set, this provider
 * is registered automatically and the "AI suggested objectives" panel goes live.
 *
 * Expected route (to be built by Earl / Qiaomu):
 *   POST {REACT_APP_PPOST_AI_URL}/ai/objective-proposals
 *   body:    ProblemContextInput      (same shape as ai-service's ProblemContextSchema)
 *   returns: { proposals: ObjectiveProposal[] }
 *   POST {REACT_APP_PPOST_AI_URL}/ai/assessment-insights
 *   body:    AssessmentInsightContext (aiSuggestions.ts)
 *   returns: { insights: PpostSuggestion[] }   kinds: 'problem' | 'tactic' (with parentStrategyId) | 'task'
 *
 * The types below mirror ai-service's zod schemas; they are copied (not imported) so the
 * browser bundle never pulls in server-only code.
 */
import { Problem, Severity } from 'ppost-engine';
import { getState } from './store';
import { CURRENT_EVENT } from './seedData';
import type { PpostSuggestion, SuggestionProvider } from './aiSuggestions';

export interface AiProblemContextInput {
  disaster: { id: string; name: string; hazardType?: string; location?: string; declaredOn?: string };
  priority: { id: string; name: string; recoveryArea?: string };
  problem: { id: string; code?: string; title: string; description: string; severity?: 'low' | 'medium' | 'high' | 'critical' };
  existingObjectives?: { id: string; title: string }[];
}

export interface AiObjectiveProposal {
  title: string;
  description: string;
  rationale: string;
  /** Returned by the model; NOT shown in the PPOST UI (design rule: no confidence %). */
  confidence: number;
  sourceProblemId: string;
}

const SEV: Record<Severity, AiProblemContextInput['problem']['severity']> = {
  CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low',
};

export function toProblemContext(problem: Problem): AiProblemContextInput {
  const s = getState();
  const priority = s.priorities.find((p) => p.id === problem.priorityId);
  return {
    disaster: { id: CURRENT_EVENT.id, name: CURRENT_EVENT.name, hazardType: CURRENT_EVENT.hazard.toLowerCase(), location: CURRENT_EVENT.location },
    priority: { id: problem.priorityId, name: priority?.name ?? problem.priorityId, recoveryArea: problem.sector },
    problem: {
      id: problem.id, code: problem.id, title: problem.title,
      description: problem.description?.trim() || problem.title, severity: SEV[problem.severity],
    },
    existingObjectives: s.objectives
      .filter((o) => o.status !== 'ARCHIVED' && o.problemIds.includes(problem.id))
      .map((o) => ({ id: o.id, title: o.title })),
  };
}

export function fromObjectiveProposals(proposals: AiObjectiveProposal[]): PpostSuggestion[] {
  return proposals.map((p, i) => ({
    id: `AI-${p.sourceProblemId}-${i + 1}`,
    kind: 'objective' as const,
    title: p.title,
    description: p.description,
    rationale: p.rationale,
    sources: [p.sourceProblemId],
  }));
}

/** Provider that calls the API route. Only objectives exist in ai-service today. */
export function createHttpSuggestionProvider(baseUrl: string): SuggestionProvider {
  return {
    name: 'PPOST AI service',
    async suggest(req) {
      const base = baseUrl.replace(/\/$/, '');
      if (req.want === 'assessment-insights') {
        const r = await fetch(`${base}/ai/assessment-insights`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.context),
        });
        if (!r.ok) throw new Error(`AI service error ${r.status}`);
        const out = (await r.json()) as { insights: PpostSuggestion[] };
        return (out.insights ?? []).map((x, i) => ({ ...x, id: x.id || `AI-INS-${i + 1}`, sources: x.sources ?? [] }));
      }
      if (req.want !== 'objective') return []; // strategies / tactics / problems: not built in ai-service yet
      const res = await fetch(`${base}/ai/objective-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toProblemContext(req.problem)),
      });
      if (!res.ok) throw new Error(`AI service error ${res.status}`);
      const body = (await res.json()) as { proposals: AiObjectiveProposal[] };
      return fromObjectiveProposals(body.proposals ?? []);
    },
  };
}
