/**
 * QUESTIONS FROM DOCUMENTS — PLACEHOLDER / INTEGRATION POINT
 * -----------------------------------------------------------
 * Today the assessment uses the built-in question set (assessmentQuestions.ts) plus
 * situation facts. When the AI service can read uploaded documents (SitReps, EOC briefings),
 * it registers here and its questions are added to the assessment, labelled "AI-suggested".
 *
 *   registerQuestionProvider({ name: 'PPOST AI', generate: async (ctx) => [...] });
 *
 * Generated questions use the same shape as built-in ones (QuestionUI), so the rules engine
 * (UNKNOWN → safety tactic / verification task) works on them unchanged.
 */
import { Answer } from 'ppost-engine';
import { QuestionUI } from './assessmentQuestions';
import { SituationFact } from './seedData';

export interface QuestionGenerationContext {
  event: { id: string; name: string; hazard: string; location: string };
  facts: SituationFact[];
  /** Documents the user uploaded at intake (owned by the Disaster Events / Documents pages). */
  documents: { name: string; text?: string }[];
  answers: Record<string, Answer | undefined>;
  /** IDs already in the assessment, so the AI doesn't repeat them. */
  existingQuestionIds: string[];
}

export interface QuestionProvider {
  name: string;
  generate(ctx: QuestionGenerationContext): Promise<QuestionUI[]>;
}

let provider: QuestionProvider | null = null;

export function registerQuestionProvider(p: QuestionProvider | null) {
  provider = p;
}

export function getQuestionProvider(): QuestionProvider | null {
  return provider;
}

/** Normalise what a provider returns: unique ids, labelled as AI, safe defaults. */
export function sanitizeGenerated(qs: QuestionUI[], existing: string[]): QuestionUI[] {
  const seen = new Set(existing);
  return qs
    .filter((q) => q.text?.trim() && q.sector && q.priorityId)
    .map((q, i) => {
      let id = q.id?.startsWith('Q-AI-') ? q.id : `Q-AI-${String(i + 1).padStart(2, '0')}`;
      while (seen.has(id)) id = `${id}x`;
      seen.add(id);
      return { ...q, id, origin: 'AI_FROM_DOCUMENTS' as const, hazards: q.hazards?.length ? q.hazards : ['ANY'], why: q.why || 'Suggested from your documents.' };
    });
}
