/**
 * Assessment → PPOST.
 * Runs the engine's rule evaluation (not AI) and turns the result into DRAFT records.
 * Nothing is added until the user presses "Add to PPOST as drafts".
 */
import { evaluateAssessment, Objective, Problem, Strategy, Tactic, VerificationTask } from 'ppost-engine';
import { addMany, addTasks, AnyRecord, EntityKind, linkQuestions, StoreState } from './store';
import { CURRENT_EVENT } from './seedData';
import { QuestionUI } from './assessmentQuestions';

export interface Proposal {
  questionId: string;
  problem: Problem;
  /** For UNKNOWN safety answers: a precautionary chain so the matrix shows it. */
  safetyChain?: { objective: Objective; strategy: Strategy; tactic: Tactic };
  /** Problem already recorded in PPOST for this question. */
  alreadyIn?: string;
  /** Safety tactic already in PPOST. */
  chainIn?: boolean;
}

export interface AssessmentPreview {
  proposals: Proposal[];
  tasks: (VerificationTask & { alreadyIn: boolean })[];
  unknownIds: string[];
  visibleIds: string[];
  /** Problems created from an UNKNOWN whose answer has since changed. */
  needsReview: { questionId: string; problemId: string; answer: string }[];
}

const qidOf = (p: Problem) => p.fromUnknownQuestionId ?? p.id.replace(/^P-/, '');

export function previewAssessment(s: StoreState, questions: QuestionUI[]): AssessmentPreview {
  const r = evaluateAssessment(CURRENT_EVENT.id, questions, s.assessment.answers);
  const live = (id: string) => s.problems.some((p) => p.id === id && p.status !== 'ARCHIVED');

  const proposals: Proposal[] = r.problems.map((problem) => {
    const questionId = qidOf(problem);
    const linked = s.assessment.linked[questionId];
    const proposal: Proposal = { questionId, problem, alreadyIn: linked && live(linked) ? linked : undefined };
    const tactic = r.tactics.find((t) => t.id === `T-${questionId}-SAFE`);
    if (problem.fromUnknownQuestionId && tactic) {
      const meta = { disasterId: problem.disasterId, source: 'RULE' as const, status: 'DRAFT' as const, createdAt: problem.createdAt, updatedAt: problem.updatedAt };
      const objective: Objective = {
        ...meta, id: `O-${questionId}`, problemIds: [proposal.alreadyIn ?? problem.id], horizon: 'IMMEDIATE',
        title: `Keep people safe until "${problem.title.replace(/^Unverified: /, '')}" is verified`,
      };
      const strategy: Strategy = { ...meta, id: `S-${questionId}`, objectiveId: objective.id, title: 'Precautionary measures until verified' };
      proposal.chainIn = s.tactics.some((t) => t.id === tactic.id);
      proposal.safetyChain = {
        objective, strategy,
        tactic: { ...tactic, strategyId: strategy.id, fiveW1H: { ...tactic.fiveW1H, why: { ...tactic.fiveW1H.why, objectiveId: objective.id } } },
      };
    }
    return proposal;
  });

  const needsReview = Object.entries(s.assessment.linked).flatMap(([questionId, problemId]) => {
    const p = s.problems.find((x) => x.id === problemId && x.status !== 'ARCHIVED');
    const answer = s.assessment.answers[questionId];
    return p?.fromUnknownQuestionId && answer && answer !== 'UNKNOWN' ? [{ questionId, problemId, answer }] : [];
  });

  return {
    proposals,
    tasks: r.tasks.map((t) => ({ ...t, alreadyIn: s.tasks.some((x) => x.id === t.id) })),
    unknownIds: r.unknownQuestionIds,
    visibleIds: r.visibleQuestionIds,
    needsReview,
  };
}

/** Adds every not-yet-added proposal and task. Returns counts for the confirmation message. */
export function applyAssessment(preview: AssessmentPreview) {
  const items: { kind: EntityKind; record: AnyRecord }[] = [];
  const links: Record<string, string> = {};
  let tactics = 0;
  for (const p of preview.proposals) {
    if (!p.alreadyIn) {
      items.push({ kind: 'problem', record: p.problem });
      links[p.questionId] = p.problem.id;
    }
    if (p.safetyChain && !p.chainIn) {
      tactics++;
      items.push({ kind: 'objective', record: p.safetyChain.objective });
      items.push({ kind: 'strategy', record: p.safetyChain.strategy });
      items.push({ kind: 'tactic', record: p.safetyChain.tactic });
    }
  }
  const added = addMany(items);
  linkQuestions(links);
  const tasks = addTasks(preview.tasks.filter((t) => !t.alreadyIn).map(({ alreadyIn, ...t }) => t));
  return {
    problems: Object.keys(links).length,
    tactics,
    records: added,
    tasks,
  };
}
