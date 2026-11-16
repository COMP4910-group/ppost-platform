/**
 * AI SUGGESTIONS — PLACEHOLDER / INTEGRATION POINT
 * ------------------------------------------------
 * The real AI lives in packages/ai-service (not owned by the PPOST team).
 * This file only defines the contract the PPOST pages use, so the AI team can plug in
 * without touching the PPOST UI:
 *
 *   import { registerSuggestionProvider } from './ppost/aiSuggestions';
 *   registerSuggestionProvider({ suggest: async (req) => callAiService(req) });
 *
 * Rules the UI enforces (do not bypass):
 *   - Suggestions are always labelled as AI and never saved automatically.
 *   - "Use" opens a pre-filled DRAFT that a person must review and save.
 *   - No confidence percentages are shown.
 */
import { Answer, Objective, Problem, SectorId, Strategy, TimeHorizon } from 'ppost-engine';
import { createHttpSuggestionProvider } from './aiServiceAdapter';

/** What the user is looking at when asking for suggestions. */
export type SuggestionRequest =
  | { want: 'objective'; problem: Problem }
  | { want: 'strategy'; objective: Objective; problems: Problem[] }
  | { want: 'tactic'; strategy: Strategy; objective?: Objective; problem?: Problem }
  | { want: 'problem'; answers: { questionId: string; question: string; answer: Answer; sector: SectorId; priorityId: string }[] }
  | { want: 'assessment-insights'; context: AssessmentInsightContext };

/**
 * Everything the AI needs to find deeper / hidden tasks after an assessment:
 * the answers (with notes), what the PPOST rules engine already produced, and what is already in PPOST.
 * Route: POST {REACT_APP_PPOST_AI_URL}/ai/assessment-insights  body = this object, returns { insights: PpostSuggestion[] }
 */
export interface AssessmentInsightContext {
  event: { id: string; name: string; hazard: string; location: string };
  facts: { label: string; value: string | null }[];
  answers: {
    questionId: string; question: string; answer: Answer; note?: string;
    sector: SectorId; priorityId: string; safetySensitive: boolean; deeperOf?: string;
  }[];
  /** Output of the PPOST rules engine for these answers (already shown to the user). */
  ruleResults: {
    problems: { id: string; title: string; severity: string; questionId: string }[];
    safetyTactics: { id: string; title: string; questionId: string }[];
    verificationTasks: { id: string; title: string; assignedRole: string; dueInHours: number }[];
  };
  /** Current PPOST plan, so the AI does not repeat what exists and can attach tactics to a strategy. */
  existing: {
    problems: { id: string; title: string; priorityId: string; sector: SectorId }[];
    strategies: { id: string; title: string; objectiveId: string; problemId?: string; priorityId?: string }[];
    tactics: { id: string; title: string; strategyId: string }[];
  };
}

export interface PpostSuggestion {
  id: string;
  kind: 'problem' | 'objective' | 'strategy' | 'tactic' | 'task';
  title: string;
  description?: string;
  /** Why the AI suggests this — always shown to the user. */
  rationale: string;
  /** Records or documents the suggestion is based on, e.g. "Q-W03", "SitRep v3". */
  sources: string[];
  /** Optional pre-filled fields for the draft. */
  horizon?: TimeHorizon;
  sector?: SectorId;
  priorityId?: string;
  /** For kind 'tactic': an EXISTING strategy id to attach to (from context.existing.strategies). */
  parentStrategyId?: string;
  /** For kind 'task' (verification / follow-up task). */
  assignedRole?: string;
  dueInHours?: number;
}

export interface SuggestionProvider {
  /** Display name, e.g. "PPOST AI service". */
  name: string;
  suggest(req: SuggestionRequest): Promise<PpostSuggestion[]>;
}

let provider: SuggestionProvider | null = null;

/** Called by the AI service integration. Until then, the UI shows a "not connected" placeholder. */
export function registerSuggestionProvider(p: SuggestionProvider | null) {
  provider = p;
}

export function getSuggestionProvider(): SuggestionProvider | null {
  // Auto-connect to the AI API route when it is configured (see aiServiceAdapter.ts).
  const url = process.env.REACT_APP_PPOST_AI_URL;
  if (!provider && url) {
    provider = createHttpSuggestionProvider(url);
  }
  return provider;
}

/* ------------------------------------------------------------------ */
/* SAMPLE provider — canned examples so the UI can be demoed and tested. */
/* It is NOT AI and is clearly labelled "Sample" in the UI.              */
/* ------------------------------------------------------------------ */
let n = 0;
const sid = () => `SUG-${++n}`;

export const sampleSuggestionProvider: SuggestionProvider = {
  name: 'Sample suggestions (not AI)',
  async suggest(req) {
    switch (req.want) {
      case 'objective':
        return [
          {
            id: sid(), kind: 'objective', horizon: 'IMMEDIATE',
            title: `Stabilize the immediate impact of: ${req.problem.title.toLowerCase()}`,
            rationale: 'Severe problems usually need an immediate-horizon objective before longer-term recovery.',
            sources: [req.problem.id],
          },
          {
            id: sid(), kind: 'objective', horizon: 'MID_TERM',
            title: `Fully resolve: ${req.problem.title.toLowerCase()} within 12 months`,
            rationale: 'A mid-term objective gives the problem a measurable end state.',
            sources: [req.problem.id],
          },
        ];
      case 'strategy':
        return [
          {
            id: sid(), kind: 'strategy',
            title: 'Contract specialist services through emergency procurement',
            rationale: 'Commonly used when local crews lack capacity in the first 60 days.',
            sources: [req.objective.id],
          },
          {
            id: sid(), kind: 'strategy',
            title: 'Request mutual aid from neighbouring jurisdictions',
            rationale: 'Mutual aid can start faster than procurement when staff are the constraint.',
            sources: [req.objective.id],
          },
        ];
      case 'tactic':
        return [
          {
            id: sid(), kind: 'tactic',
            title: `Assign a lead and confirm scope for "${req.strategy.title}"`,
            rationale: 'Every strategy needs at least one owned, dated tactic before it can be reviewed.',
            sources: [req.strategy.id],
          },
          {
            id: sid(), kind: 'tactic',
            title: 'Field verification visit and photo evidence',
            rationale: 'Evidence supports funding claims and closes UNKNOWN assessments.',
            sources: [req.strategy.id, ...(req.problem ? [req.problem.id] : [])],
          },
        ];
      case 'assessment-insights':
        return sampleInsights(req.context);
      case 'problem':
        return req.answers
          .filter((a) => a.answer !== 'NO')
          .slice(0, 3)
          .map((a) => ({
            id: sid(), kind: 'problem' as const, sector: a.sector, priorityId: a.priorityId,
            title: a.answer === 'UNKNOWN' ? `Unconfirmed condition: ${a.question}` : `Impact identified: ${a.question}`,
            rationale: a.answer === 'UNKNOWN'
              ? 'Answer is UNKNOWN — consider recording a problem until it is verified.'
              : 'A YES answer usually indicates a recovery problem to plan for.',
            sources: [a.questionId],
          }));
    }
  },
};

/** SAMPLE (not AI): combines answers to show the kind of "hidden task" the AI is expected to find. */
function sampleInsights(ctx: AssessmentInsightContext): PpostSuggestion[] {
  const a = (id: string) => ctx.answers.find((x) => x.questionId === id)?.answer;
  const strat = (id: string) => ctx.existing.strategies.find((x) => x.id === id)?.id;
  const out: PpostSuggestion[] = [];
  const unknownSafety = ctx.answers.filter((x) => x.answer === 'UNKNOWN' && x.safetySensitive);

  if ((a('Q-W03') === 'UNKNOWN' || a('Q-W03') === 'YES') && !a('Q-W03-D1')) {
    out.push({
      id: sid(), kind: 'task', title: 'Confirm whether hospitals or care homes rely on the affected water system',
      rationale: 'The water system is not confirmed safe and nobody has checked critical health facilities yet.',
      sources: ['Q-W03'], assignedRole: 'Infrastructure Lead', dueInHours: 24,
    });
  }
  if (a('Q-H01') === 'YES') {
    out.push({
      id: sid(), kind: 'problem', sector: 'HUMAN_WELLNESS', priorityId: 'PR-3',
      title: 'Households who lost homes may need mental-health and grief support',
      rationale: 'Home loss is strongly linked to stress and grief; no wellness problem is recorded yet.',
      sources: ['Q-H01'],
    });
    out.push({
      id: sid(), kind: 'tactic', parentStrategyId: strat('S-08'),
      title: 'Hold a re-entry information session for owners of destroyed homes',
      rationale: 'Owners need one place to hear about debris removal, permits and insurance before rebuilding.',
      sources: ['Q-H01', 'S-08'],
    });
  }
  if (a('Q-E02') === 'YES' || a('Q-H01-D3') === 'NO' || a('Q-H01-D3') === 'UNKNOWN') {
    out.push({
      id: sid(), kind: 'tactic', parentStrategyId: strat('S-09'),
      title: 'Book a licensed asbestos abatement crew before debris removal starts',
      rationale: 'Hazardous materials are present or not screened; debris removal cannot start safely without it.',
      sources: ['Q-E02', 'Q-H01-D3', 'S-09'].filter((x) => x.startsWith('S') || a(x)),
    });
  }
  if (unknownSafety.length >= 2) {
    out.push({
      id: sid(), kind: 'task', title: 'Daily 15-minute review of open safety UNKNOWNs until all are verified',
      rationale: `${unknownSafety.length} safety questions are still UNKNOWN; a daily check stops them being forgotten.`,
      sources: unknownSafety.map((x) => x.questionId), assignedRole: 'Planning Section Chief', dueInHours: 24,
    });
  }
  if (!out.length) {
    out.push({
      id: sid(), kind: 'task', title: 'Check every verification task has an owner and a due date',
      rationale: 'A general follow-up while more answers are collected.', sources: ['Assessment'],
      assignedRole: 'Planning Section Chief', dueInHours: 48,
    });
  }
  return out;
}
