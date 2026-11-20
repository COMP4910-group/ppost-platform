/**
 * AI "deeper / hidden tasks" for the Impact Assessment.
 * Builds the context sent to the AI (answers + notes + rules-engine results + current PPOST),
 * and turns an accepted insight into a DRAFT record. Nothing is added without a person clicking.
 */
import { Problem, Strategy, VerificationTask } from 'ppost-engine';
import { addMany, addTasks, getState, StoreState } from './store';
import { CURRENT_EVENT } from './seedData';
import { QuestionUI } from './assessmentQuestions';
import { AssessmentPreview } from './assessmentBridge';
import { AssessmentInsightContext, PpostSuggestion } from './aiSuggestions';
import { blankProblem, blankTactic } from './records';
import type { EditorTarget } from './EntityEditor';

const live = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status !== 'ARCHIVED');

export function buildInsightContext(s: StoreState, questions: QuestionUI[], preview: AssessmentPreview): AssessmentInsightContext {
  const answered = questions.filter((q) => s.assessment.answers[q.id] !== undefined);
  return {
    event: { id: CURRENT_EVENT.id, name: CURRENT_EVENT.name, hazard: CURRENT_EVENT.hazard, location: CURRENT_EVENT.location },
    facts: CURRENT_EVENT.facts.map((f) => ({ label: f.label, value: f.value })),
    answers: answered.map((q) => ({
      questionId: q.id, question: q.text, answer: s.assessment.answers[q.id]!,
      note: s.assessment.notes[q.id]?.trim() || undefined,
      sector: q.sector, priorityId: q.priorityId, safetySensitive: q.unknownPolicy === 'SAFETY', deeperOf: q.deepOf,
    })),
    ruleResults: {
      problems: preview.proposals.map((p) => ({ id: p.alreadyIn ?? p.problem.id, title: p.problem.title, severity: p.problem.severity, questionId: p.questionId })),
      safetyTactics: preview.proposals.filter((p) => p.safetyChain).map((p) => ({ id: p.safetyChain!.tactic.id, title: p.safetyChain!.tactic.title, questionId: p.questionId })),
      verificationTasks: preview.tasks.map((t) => ({ id: t.id, title: t.title, assignedRole: t.assignedRole, dueInHours: t.dueInHours })),
    },
    existing: {
      problems: live(s.problems).map((p) => ({ id: p.id, title: p.title, priorityId: p.priorityId, sector: p.sector })),
      strategies: live(s.strategies).map((x) => {
        const o = s.objectives.find((ob) => ob.id === x.objectiveId);
        const p = s.problems.find((pr) => pr.id === o?.problemIds[0]);
        return { id: x.id, title: x.title, objectiveId: x.objectiveId, problemId: p?.id, priorityId: p?.priorityId };
      }),
      tactics: live(s.tactics).map((t) => ({ id: t.id, title: t.title, strategyId: t.strategyId })),
    },
  };
}

const problemOfStrategy = (s: StoreState, strategy: Strategy): Problem | undefined => {
  const o = s.objectives.find((ob) => ob.id === strategy.objectiveId);
  return s.problems.find((p) => p.id === o?.problemIds[0]);
};

/** Can this insight be added in one click? (tactics need an existing strategy to attach to) */
export function canAddDirectly(sug: PpostSuggestion, s: StoreState = getState()): boolean {
  if (sug.kind === 'tactic') return !!s.strategies.find((x) => x.id === sug.parentStrategyId && x.status !== 'ARCHIVED');
  return sug.kind === 'problem' || sug.kind === 'task';
}

/** "Add to PPOST": creates a DRAFT record (or an open task). Returns the new id. */
export function addInsightToPpost(sug: PpostSuggestion, isSample: boolean): string | null {
  const s = getState();
  const source = isSample ? 'HUMAN_DECISION' : 'AI_SUGGESTION';
  if (sug.kind === 'problem') {
    const rec = blankProblem(sug.priorityId ?? 'PR-1', { title: sug.title, description: sug.rationale, sector: sug.sector ?? 'HOUSING', source });
    addMany([{ kind: 'problem', record: rec }]);
    return rec.id;
  }
  if (sug.kind === 'tactic') {
    const strategy = s.strategies.find((x) => x.id === sug.parentStrategyId);
    if (!strategy) return null;
    const rec = blankTactic(strategy, problemOfStrategy(s, strategy), { title: sug.title, description: sug.rationale, source });
    addMany([{ kind: 'tactic', record: rec }]);
    return rec.id;
  }
  if (sug.kind === 'task') {
    const n = s.tasks.filter((t) => t.id.startsWith('VT-AI-')).length + 1;
    const task: VerificationTask = {
      id: `VT-AI-${String(n).padStart(2, '0')}`, disasterId: CURRENT_EVENT.id, questionId: sug.sources[0] ?? 'AI',
      title: sug.title, assignedRole: sug.assignedRole ?? 'Planning Section Chief', dueInHours: sug.dueInHours ?? 48, status: 'OPEN',
    };
    addTasks([task]);
    return task.id;
  }
  return null;
}

/** "Edit as draft": a pre-filled editor the person reviews before saving. */
export function draftTargetFor(sug: PpostSuggestion, isSample: boolean): EditorTarget | null {
  const s = getState();
  const source = isSample ? 'HUMAN_DECISION' : 'AI_SUGGESTION';
  if (sug.kind === 'problem') {
    return { kind: 'problem', isNew: true, record: blankProblem(sug.priorityId ?? 'PR-1', { title: sug.title, description: sug.rationale, sector: sug.sector ?? 'HOUSING', source }) };
  }
  if (sug.kind === 'tactic') {
    const strategies = live(s.strategies);
    const strategy = strategies.find((x) => x.id === sug.parentStrategyId) ?? strategies[0];
    if (!strategy) return null;
    return { kind: 'tactic', isNew: true, record: blankTactic(strategy, problemOfStrategy(s, strategy), { title: sug.title, description: sug.rationale, source }) };
  }
  return null;
}
