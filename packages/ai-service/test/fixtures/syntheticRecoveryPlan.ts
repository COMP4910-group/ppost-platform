import type { PlanSourceSnapshotInput, RecoveryPlanNarrative } from "../../src/plan/types.ts";

/**
 * SYNTHETIC DATA. NOT REAL CLIENT DATA.
 *
 * A source snapshot for the fictional "Clearwater Ridge Wildfire" (EV-2026-014),
 * consistent with ppost-engine's sample data: DEFAULT_PRIORITIES, SAMPLE_QUESTIONS,
 * SAMPLE_PPOST, and the records evaluateAssessment() generates for the answers
 * Q-W03 = UNKNOWN, Q-H07 = YES, Q-H07a = NO (Q-F02 left unanswered). Known gaps
 * are the engine's buildMatrix reasons and validateTactic results for that data.
 *
 * It deliberately keeps the engine data's rough edges: a tactic whose strategy
 * (S-PRECAUTION) is not in the data, a problem derived from a question (Q-H02)
 * that is not in the data, missing owners, and no currency.
 */
const sampleAt = "2026-10-08T00:00:00.000Z";
const assessedAt = "2026-10-20T00:00:00.000Z";

export const syntheticSnapshot = {
  capturedAt: "2026-11-02T00:00:00.000Z",
  isSynthetic: true,
  disaster: {
    id: "EV-2026-014",
    name: "Clearwater Ridge Wildfire",
    hazardTypes: ["Wildfire"],
    location: "Interior British Columbia, Canada",
    declaredAt: "2026-08-14",
    activeSectors: ["HUMAN_WELLNESS", "HOUSING", "ENVIRONMENT", "ECONOMY", "CRITICAL_INFRASTRUCTURE"],
  },
  priorities: [
    { id: "PR-1", rank: 1, name: "Responder Safety & Health", active: true },
    { id: "PR-2", rank: 2, name: "Save Lives", active: true },
    { id: "PR-3", rank: 3, name: "Reduce Suffering", active: true },
    { id: "PR-4", rank: 4, name: "Protect Public Health", active: true },
    { id: "PR-5", rank: 5, name: "Protect Government Infrastructure", active: true },
    { id: "PR-6", rank: 6, name: "Protect Property", active: true },
    { id: "PR-7", rank: 7, name: "Protect the Environment", active: true },
    { id: "PR-8", rank: 8, name: "Reduce Economic & Social Losses", active: true },
  ],
  assessment: {
    questions: [
      {
        id: "Q-W03",
        text: "Has the municipal water intake or distribution line experienced pressure loss or power loss?",
        sector: "CRITICAL_INFRASTRUCTURE",
        priorityId: "PR-4",
      },
      {
        id: "Q-H07",
        text: "Are residential areas downslope of severe burn scars at risk of debris flow?",
        sector: "HOUSING",
        priorityId: "PR-2",
      },
      { id: "Q-H07a", text: "Is the evacuation route open?", sector: "HOUSING", priorityId: "PR-2" },
      {
        id: "Q-F02",
        text: "Has a funding application already been submitted?",
        sector: "ECONOMY",
        priorityId: "PR-8",
      },
    ],
    answers: [
      { questionId: "Q-W03", answer: "UNKNOWN", answeredAt: assessedAt },
      { questionId: "Q-H07", answer: "YES", answeredAt: assessedAt },
      { questionId: "Q-H07a", answer: "NO", answeredAt: assessedAt },
    ],
    verificationTasks: [
      {
        id: "VT-Q-W03",
        questionId: "Q-W03",
        title: "Field-verify water intake and distribution",
        assignedRole: "Infrastructure Lead",
        dueInHours: 48,
        status: "OPEN",
      },
    ],
  },
  problems: [
    {
      id: "P-02",
      title: "42 homes destroyed; households cannot return",
      source: "SOURCE_FACT",
      status: "APPROVED",
      priorityId: "PR-6",
      sector: "HOUSING",
      severity: "CRITICAL",
      updatedAt: sampleAt,
    },
    {
      id: "P-04",
      title: "Damage to remaining homes not yet assessed",
      source: "RULE",
      status: "DRAFT",
      priorityId: "PR-6",
      sector: "HOUSING",
      severity: "HIGH",
      fromUnknownQuestionId: "Q-H02",
      updatedAt: sampleAt,
    },
    {
      id: "P-Q-W03-U",
      title: "Unverified: Water system integrity compromised",
      source: "RULE",
      status: "DRAFT",
      priorityId: "PR-4",
      sector: "CRITICAL_INFRASTRUCTURE",
      severity: "CRITICAL",
      fromUnknownQuestionId: "Q-W03",
      updatedAt: assessedAt,
    },
    {
      id: "P-Q-H07",
      title: "Debris-flow risk to downslope homes",
      source: "RULE",
      status: "DRAFT",
      priorityId: "PR-2",
      sector: "HOUSING",
      severity: "HIGH",
      updatedAt: assessedAt,
    },
    {
      id: "P-Q-H07a",
      title: "Evacuation route blocked",
      source: "RULE",
      status: "DRAFT",
      priorityId: "PR-2",
      sector: "HOUSING",
      severity: "CRITICAL",
      updatedAt: assessedAt,
    },
  ],
  objectives: [
    {
      id: "O-04",
      title: "Provide safe interim housing within 60 days",
      source: "HUMAN_DECISION",
      status: "APPROVED",
      problemIds: ["P-02"],
      horizon: "IMMEDIATE",
      updatedAt: sampleAt,
    },
  ],
  strategies: [
    {
      id: "S-07",
      title: "Deploy prefabricated modular units",
      source: "HUMAN_DECISION",
      status: "APPROVED",
      objectiveId: "O-04",
      updatedAt: sampleAt,
    },
  ],
  tactics: [
    {
      id: "T-014",
      title: "Install interim modular housing on 42 destroyed lots",
      owner: "L. Tremblay",
      source: "HUMAN_DECISION",
      status: "IN_REVIEW",
      strategyId: "S-07",
      primaryPriorityId: "PR-6",
      secondaryPriorityIds: ["PR-3"],
      sector: "HOUSING",
      estimateTotal: 2122900,
      successMeasure: "42 units occupied by Nov 30",
      fiveW1H: {
        who: { accountablePerson: "L. Tremblay", team: "Regional Housing Taskforce" },
        what: {
          action: "Prepare pads, connect utilities, set modular units",
          deliverable: "42 serviced, occupied units",
        },
        when: { start: "2026-10-12", end: "2026-11-02", horizon: "IMMEDIATE" },
        where: { location: "Clearwater Ridge subdivision", parcelIds: ["42 parcels"] },
        why: { objectiveId: "O-04", rationale: "Displaced households need safe interim housing" },
        how: {
          approach: "Contracted site works and modular delivery via highway corridor",
          deliveryMethod: "CONTRACTOR",
        },
      },
      updatedAt: sampleAt,
    },
    {
      id: "T-Q-W03-SAFE",
      title: "Issue precautionary boil-water advisory review",
      source: "RULE",
      status: "DRAFT",
      strategyId: "S-PRECAUTION",
      primaryPriorityId: "PR-4",
      sector: "CRITICAL_INFRASTRUCTURE",
      safetyPrecaution: true,
      fiveW1H: {
        why: { rationale: "Precaution: Q-W03 answered UNKNOWN" },
        when: { horizon: "IMMEDIATE" },
      },
      updatedAt: assessedAt,
    },
  ],
  knownGaps: [
    { recordIds: ["P-Q-H07"], description: "High-severity problem with no objective", detectedBy: "ppost-engine matrix" },
    { recordIds: ["P-Q-H07a"], description: "High-severity problem with no objective", detectedBy: "ppost-engine matrix" },
    { recordIds: ["P-Q-W03-U"], description: "Unresolved UNKNOWN on a safety item", detectedBy: "ppost-engine matrix" },
    { recordIds: ["P-Q-W03-U"], description: "High-severity problem with no objective", detectedBy: "ppost-engine matrix" },
    { recordIds: ["P-04"], description: "High-severity problem with no objective", detectedBy: "ppost-engine matrix" },
    {
      recordIds: ["T-Q-W03-SAFE"],
      description: "5W1H incomplete: who, what, when, where, why (objective link), how; success measure missing",
      detectedBy: "ppost-engine validateTactic",
    },
  ],
} satisfies PlanSourceSnapshotInput;

/** A well-formed narrative a model could return for the synthetic snapshot. */
export const syntheticNarrative: RecoveryPlanNarrative = {
  executiveSummary: {
    text:
      "Recovery planning for the Clearwater Ridge Wildfire has one complete housing chain under Protect Property. " +
      "Four high-severity problems have no objective yet, and the water system's condition is unresolved because the " +
      "related assessment answer is UNKNOWN.",
    sourceRecordIds: ["EV-2026-014", "P-02", "O-04", "T-014", "P-04", "P-Q-H07", "P-Q-H07a", "P-Q-W03-U", "Q-W03"],
  },
  recommendations: [
    {
      title: "Resolve the water system UNKNOWN",
      text: "Prioritise the open field verification of the water intake and distribution before relying on any water-system assumptions.",
      sourceRecordIds: ["Q-W03", "VT-Q-W03", "P-Q-W03-U"],
    },
    {
      title: "Define objectives for high-severity problems",
      text: "Consider drafting objectives for the debris-flow risk, the blocked evacuation route and the unassessed home damage.",
      sourceRecordIds: ["P-Q-H07", "P-Q-H07a", "P-04"],
    },
    {
      title: "Complete the precautionary tactic",
      text: "Assign an accountable person and complete the 5W1H details for the boil-water advisory review, and link it to a strategy.",
      sourceRecordIds: ["T-Q-W03-SAFE"],
    },
  ],
  confirmationsNeeded: [
    {
      text: "Confirm whether a funding application has been submitted; the assessment question is unanswered.",
      sourceRecordIds: ["Q-F02"],
    },
  ],
};
