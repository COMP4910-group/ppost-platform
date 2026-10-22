import { Answer, Problem, SectorId, Severity, Tactic, VerificationTask } from '../model/types';

/**
 * What happens when a question is answered UNKNOWN.
 *  - SAFETY: treat as a potential hazard → precautionary problem + safety tactic + verification task
 *  - VERIFY: no hazard, just create a verification task (e.g. "was a funding application submitted?")
 *  - NONE:   record UNKNOWN only
 */
export type UnknownPolicy = 'SAFETY' | 'VERIFY' | 'NONE';

export interface AssessmentQuestion {
  id: string;                 // "Q-W03"
  text: string;
  sector: SectorId;
  priorityId: string;         // priority the resulting problem belongs to
  unknownPolicy: UnknownPolicy;
  /** Answer that indicates a problem exists (usually YES). */
  problemWhen?: Answer;
  problemTitle?: string;
  severity?: Severity;
  /** Used when unknownPolicy = SAFETY. */
  safetyTactic?: { title: string; strategyId: string };
  verification?: { title: string; assignedRole: string; dueInHours: number };
  /** Follow-up questions shown only when the parent has a given answer. */
  followUps?: { showWhen: Answer; questionIds: string[] }[];
}

export type AnswerMap = Record<string, Answer | undefined>;

export interface AssessmentResult {
  problems: Problem[];
  tactics: Tactic[];
  tasks: VerificationTask[];
  /** Questions still UNKNOWN — always reported, never hidden. */
  unknownQuestionIds: string[];
  /** Which question ids should currently be visible (branching). */
  visibleQuestionIds: string[];
}

const nowIso = () => new Date().toISOString();

/**
 * Pure function: answers in → generated records out.
 * IDs are derived from the question id so re-running is idempotent
 * (the backend can upsert instead of duplicating).
 */
export function evaluateAssessment(
  disasterId: string,
  questions: AssessmentQuestion[],
  answers: AnswerMap,
  now: string = nowIso(),
): AssessmentResult {
  const result: AssessmentResult = {
    problems: [], tactics: [], tasks: [], unknownQuestionIds: [], visibleQuestionIds: [],
  };

  // 1. Branching: follow-ups are hidden unless their parent has the trigger answer.
  const hidden = new Set<string>();
  for (const q of questions) {
    for (const f of q.followUps ?? []) {
      if (answers[q.id] !== f.showWhen) f.questionIds.forEach((id) => hidden.add(id));
    }
  }
  const visible = questions.filter((q) => !hidden.has(q.id));
  result.visibleQuestionIds = visible.map((q) => q.id);

  // 2. Apply each visible answer.
  for (const q of visible) {
    const answer = answers[q.id];
    if (answer === undefined) continue; // unanswered ≠ UNKNOWN

    const base = { disasterId, owner: undefined, createdAt: now, updatedAt: now };

    if (answer === (q.problemWhen ?? 'YES') && q.problemTitle) {
      result.problems.push({
        ...base, id: `P-${q.id}`, title: q.problemTitle, source: 'RULE', status: 'DRAFT',
        priorityId: q.priorityId, sector: q.sector, severity: q.severity ?? 'MEDIUM',
      });
    }

    if (answer !== 'UNKNOWN') continue;
    result.unknownQuestionIds.push(q.id);

    if (q.unknownPolicy === 'NONE') continue;

    if (q.verification) {
      result.tasks.push({
        id: `VT-${q.id}`, disasterId, questionId: q.id, status: 'OPEN', ...q.verification,
      });
    }

    if (q.unknownPolicy === 'SAFETY') {
      // Precautionary problem: we don't know it's fine, so plan as if it might not be.
      result.problems.push({
        ...base, id: `P-${q.id}-U`, source: 'RULE', status: 'DRAFT',
        title: `Unverified: ${q.problemTitle ?? q.text}`,
        priorityId: q.priorityId, sector: q.sector, severity: 'CRITICAL',
        fromUnknownQuestionId: q.id,
      });
      if (q.safetyTactic) {
        result.tactics.push({
          ...base, id: `T-${q.id}-SAFE`, title: q.safetyTactic.title, source: 'RULE', status: 'DRAFT',
          strategyId: q.safetyTactic.strategyId, primaryPriorityId: q.priorityId,
          sector: q.sector, safetyPrecaution: true,
          fiveW1H: { why: { rationale: `Precaution: ${q.id} answered UNKNOWN` }, when: { horizon: 'IMMEDIATE' } },
        });
      }
    }
  }
  return result;
}
