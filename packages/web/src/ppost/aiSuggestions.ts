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

/** What the user is looking at when asking for suggestions. */
export type SuggestionRequest =
  | { want: 'objective'; problem: Problem }
  | { want: 'strategy'; objective: Objective; problems: Problem[] }
  | { want: 'tactic'; strategy: Strategy; objective?: Objective; problem?: Problem }
  | { want: 'problem'; answers: { questionId: string; question: string; answer: Answer; sector: SectorId; priorityId: string }[] };

export interface PpostSuggestion {
  id: string;
  kind: 'problem' | 'objective' | 'strategy' | 'tactic';
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
