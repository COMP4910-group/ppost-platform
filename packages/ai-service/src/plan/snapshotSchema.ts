import { z } from "zod";

// ---------------------------------------------------------------------------
// Source snapshot: the filled-in planning data for one disaster, collected by
// the backend. Shapes and enum values mirror ppost-engine's model
// (packages/ppost-engine/src/model/types.ts) without depending on it at runtime.
// Everything in here is treated as source material, never as instructions.
// ---------------------------------------------------------------------------

const id = z.string().min(1);
const text = z.string().min(1);

export const AnswerSchema = z.enum(["YES", "NO", "UNKNOWN"]);
export const SectorIdSchema = z.enum([
  "HUMAN_WELLNESS",
  "HOUSING",
  "ENVIRONMENT",
  "ECONOMY",
  "CRITICAL_INFRASTRUCTURE",
  "GOVERNANCE",
]);
export const TimeHorizonSchema = z.enum(["IMMEDIATE", "MID_TERM", "LONG_TERM"]);
export const PlanSeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const RecordStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]);
export const RecordSourceSchema = z.enum([
  "SOURCE_FACT",
  "HUMAN_DECISION",
  "AI_SUGGESTION",
  "RULE",
  "ASSUMPTION",
]);

/** Fields shared by Problem, Objective, Strategy and Tactic. */
const baseRecord = {
  id,
  title: text,
  description: text.optional(),
  owner: text.optional(),
  source: RecordSourceSchema,
  status: RecordStatusSchema,
  updatedAt: text.optional(),
};

export const SnapshotDisasterSchema = z.object({
  id,
  name: text,
  hazardTypes: z.array(text).default([]),
  location: text.optional(),
  declaredAt: text.optional(),
  activeSectors: z.array(SectorIdSchema).default([]),
});

export const SnapshotPrioritySchema = z.object({
  id,
  rank: z.number().int().min(1),
  name: text,
  active: z.boolean(),
});

export const SnapshotQuestionSchema = z.object({
  id,
  text,
  sector: SectorIdSchema,
  priorityId: id,
});

/** Questions without an answer entry are unanswered, which is not the same as UNKNOWN. */
export const SnapshotAnswerSchema = z.object({
  questionId: id,
  answer: AnswerSchema,
  notes: text.optional(),
  answeredBy: text.optional(),
  answeredAt: text.optional(),
});

export const SnapshotVerificationTaskSchema = z.object({
  id,
  questionId: id,
  title: text,
  assignedRole: text,
  dueInHours: z.number().int().min(0),
  status: z.enum(["OPEN", "CLOSED"]),
});

export const SnapshotProblemSchema = z.object({
  ...baseRecord,
  priorityId: id,
  sector: SectorIdSchema,
  severity: PlanSeveritySchema,
  fromUnknownQuestionId: id.optional(),
});

export const SnapshotObjectiveSchema = z.object({
  ...baseRecord,
  problemIds: z.array(id).default([]),
  horizon: TimeHorizonSchema.optional(),
});

export const SnapshotStrategySchema = z.object({
  ...baseRecord,
  objectiveId: id,
});

export const FiveW1HSchema = z.object({
  who: z
    .object({
      accountablePerson: text.optional(),
      team: text.optional(),
      supportingRoles: z.array(text).optional(),
    })
    .optional(),
  what: z.object({ action: text.optional(), deliverable: text.optional() }).optional(),
  when: z
    .object({
      start: text.optional(),
      end: text.optional(),
      horizon: TimeHorizonSchema.optional(),
    })
    .optional(),
  where: z
    .object({ location: text.optional(), parcelIds: z.array(text).optional() })
    .optional(),
  why: z.object({ objectiveId: id.optional(), rationale: text.optional() }).optional(),
  how: z
    .object({
      approach: text.optional(),
      deliveryMethod: z.enum(["CONTRACTOR", "IN_HOUSE", "PARTNER", "MUTUAL_AID"]).optional(),
    })
    .optional(),
});

export const SnapshotTacticSchema = z.object({
  ...baseRecord,
  strategyId: id,
  primaryPriorityId: id,
  secondaryPriorityIds: z.array(id).default([]),
  sector: SectorIdSchema,
  fiveW1H: FiveW1HSchema.default({}),
  successMeasure: text.optional(),
  /** Class D total as supplied by the finance data; never estimated here. */
  estimateTotal: z.number().nonnegative().optional(),
  safetyPrecaution: z.boolean().default(false),
});

/** Gaps already detected upstream (e.g. ppost-engine matrix reasons, 5W1H validation). */
export const SnapshotKnownGapSchema = z.object({
  recordIds: z.array(id).min(1),
  description: text,
  detectedBy: text.optional(),
});

// ---------------------------------------------------------------------------
// Optional source-export extensions (built by src/sources/buildSnapshot.ts).
// Money is a decimal string ("124077.10"), never a float, so supplied figures
// are reproduced exactly. Supplied figures are never replaced: reconciliation
// results are reported as findings.
// ---------------------------------------------------------------------------

/** Non-negative amount with at most two decimals, exactly as supplied. */
export const MoneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a non-negative decimal with at most 2 places");
/** Signed amount (e.g. a funding gap that can be negative). */
export const SignedMoneySchema = z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Amount must be a decimal with at most 2 places");

export const SourceProvenanceSchema = z.object({
  /** Citable ID for the file, e.g. "SRC-FINANCE". */
  sourceId: id,
  kind: z.enum(["PPOST_EXPORT", "IMPACT_EXPORT", "MATRIX_EXPORT", "FINANCE_REPORT"]),
  fileName: text,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().min(0),
  submittedBy: text.optional(),
  lastUpdated: text.optional(),
  generatedAt: text.optional(),
  formatVersion: text.optional(),
  synthetic: z.boolean(),
  /** Shown verbatim wherever the source's figures appear. */
  disclaimer: text.optional(),
});

export const EventMappingSchema = z.object({
  teamEventId: text,
  ppostDisasterId: id,
  financeEventId: id.optional(),
  status: z.enum(["CONFIRMED", "ASSUMED"]),
  basis: text.optional(),
  confirmedBy: text.optional(),
});

export const FindingCodeSchema = z.enum([
  "EVENT_MAPPING_ASSUMED",
  "SOURCE_LABELS_MAPPING_ASSUMED",
  "EVENT_NAME_DIFFERS",
  "FINANCE_TACTIC_NOT_IN_PPOST",
  "TACTIC_DESCRIPTION_REVIEW",
  "COMPETING_COSTS",
  "PPOST_COST_POINTER_MISSING",
  "FUTURE_DATE",
  "RECONCILIATION_MISMATCH",
  "MONEY_NOT_EXACT",
  "SYNTHETIC_SOURCE",
  "SUPPLIED_FROM_FINANCE",
  "UNRESOLVED_DOCUMENT_REFERENCE",
]);

export const FindingSchema = z.object({
  id,
  code: FindingCodeSchema,
  status: z.enum(["REQUIRES_CONFIRMATION", "INFO"]),
  message: text,
  recordIds: z.array(id).default([]),
  sourceIds: z.array(id).default([]),
});

export const PpostCostEntrySchema = z.object({
  id,
  sourceId: id,
  tacticId: id,
  amount: MoneySchema,
  /** PPOST sample amounts carry no currency; never assumed. */
  currency: text.optional(),
  stage: text,
  status: text,
  revision: text.optional(),
  enteredBy: text.optional(),
  at: text.optional(),
  /** True only for the entry the PPOST tactic points to as its current cost. */
  isCurrent: z.boolean(),
});

const ppostLink = z.enum(["TITLES_MATCH", "REQUIRES_REVIEW", "NOT_IN_PPOST"]);

export const SnapshotFinanceSchema = z.object({
  sourceId: id,
  schemaVersion: text,
  currency: text,
  disclaimer: text,
  /** As supplied by the finance report (never recomputed in place). */
  summary: z.object({
    requirement: MoneySchema,
    finalized: MoneySchema,
    notYetApproved: MoneySchema,
    approvedFunding: MoneySchema,
    requestedFunding: MoneySchema,
    likelyFunding: MoneySchema,
    realisticFunding: MoneySchema,
    gap: SignedMoneySchema,
    coveragePct: text,
    committed: MoneySchema,
    spent: MoneySchema,
    claimed: MoneySchema,
    reimbursed: MoneySchema,
    tacticsEstimated: z.number().int().min(0),
    tacticsNeedingEstimate: z.array(id).default([]),
  }),
  estimates: z.array(
    z.object({
      code: id,
      tacticId: id,
      title: text,
      revision: text,
      status: text,
      estimateClass: text,
      total: MoneySchema,
      low: MoneySchema,
      high: MoneySchema,
      accuracyLowPct: z.number(),
      accuracyHighPct: z.number(),
      preparedBy: text.optional(),
      preparedDate: text.optional(),
      reviewedBy: text.optional(),
      scopeDescription: text.optional(),
      ppostLink,
    }),
  ),
  costHistory: z.array(
    z.object({ tacticId: id, revision: text, status: text, total: MoneySchema, at: text, by: text.optional(), reason: text.optional() }),
  ),
  fundingSources: z.array(
    z.object({
      code: id,
      name: text,
      status: text,
      confirmed: z.boolean(),
      likely: z.boolean(),
      amount: MoneySchema,
      mixGroup: text,
      tacticIds: z.array(id).default([]),
    }),
  ),
  fundingRequests: z.array(
    z.object({ code: id, title: text, fundingSourceCode: id, amount: MoneySchema, status: text, sentAt: text.optional() }),
  ),
  fundingMix: z.array(z.object({ group: text, pct: text, amount: MoneySchema })),
  financialEntries: z.array(
    z.object({ code: id, tacticId: id, stage: text, amount: MoneySchema, entryDate: text, reference: text.optional() }),
  ),
  lifecycle: z.array(
    z.object({
      tacticId: id,
      currentStage: text,
      approvedBudget: MoneySchema.optional(),
      committed: MoneySchema,
      spent: MoneySchema,
      claimed: MoneySchema,
      reimbursed: MoneySchema,
      remainingBudget: SignedMoneySchema.optional(),
      varianceStatus: text.optional(),
    }),
  ),
  reconciliation: z.object({ checks: z.number().int().min(0), mismatches: z.number().int().min(0) }),
});

export const PlanSourceSnapshotSchema = z
  .object({
    capturedAt: text,
    /** True for demo/test data; shown prominently so it is never mistaken for client data. */
    isSynthetic: z.boolean().default(false),
    /** ISO currency code for supplied amounts, if known. Never assumed. */
    currency: text.optional(),
    disaster: SnapshotDisasterSchema,
    priorities: z.array(SnapshotPrioritySchema).default([]),
    assessment: z
      .object({
        questions: z.array(SnapshotQuestionSchema).default([]),
        answers: z.array(SnapshotAnswerSchema).default([]),
        verificationTasks: z.array(SnapshotVerificationTaskSchema).default([]),
      })
      .default({ questions: [], answers: [], verificationTasks: [] }),
    problems: z.array(SnapshotProblemSchema).default([]),
    objectives: z.array(SnapshotObjectiveSchema).default([]),
    strategies: z.array(SnapshotStrategySchema).default([]),
    tactics: z.array(SnapshotTacticSchema).default([]),
    knownGaps: z.array(SnapshotKnownGapSchema).default([]),
    // Source-export extensions (all optional; absent for hand-built snapshots).
    sources: z.array(SourceProvenanceSchema).default([]),
    eventMapping: EventMappingSchema.optional(),
    ppostCosts: z.array(PpostCostEntrySchema).default([]),
    finance: SnapshotFinanceSchema.optional(),
    findings: z.array(FindingSchema).default([]),
  })
  .superRefine((snapshot, ctx) => {
    // Source record IDs must be unique across the whole snapshot so that every
    // cited ID resolves to exactly one record.
    const seen = new Set<string>();
    for (const recordId of listSourceRecordIds(snapshot)) {
      if (seen.has(recordId)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate source record ID: ${recordId}`,
          path: ["sourceRecordIds"],
        });
      }
      seen.add(recordId);
    }

    const answered = new Set<string>();
    for (const answer of snapshot.assessment.answers) {
      if (answered.has(answer.questionId)) {
        ctx.addIssue({
          code: "custom",
          message: `More than one answer for question ${answer.questionId}`,
          path: ["assessment", "answers"],
        });
      }
      answered.add(answer.questionId);
    }
  });

export type PlanSourceSnapshotInput = z.input<typeof PlanSourceSnapshotSchema>;
export type PlanSourceSnapshot = z.output<typeof PlanSourceSnapshotSchema>;

/** Every citable source record ID in the snapshot, in a stable order. */
export function listSourceRecordIds(
  snapshot: Pick<
    PlanSourceSnapshot,
    "disaster" | "priorities" | "assessment" | "problems" | "objectives" | "strategies" | "tactics"
  > &
    Partial<Pick<PlanSourceSnapshot, "sources" | "ppostCosts" | "finance">>,
): string[] {
  const finance = snapshot.finance;
  return [
    snapshot.disaster.id,
    ...snapshot.priorities.map((r) => r.id),
    ...snapshot.assessment.questions.map((r) => r.id),
    ...snapshot.assessment.verificationTasks.map((r) => r.id),
    ...snapshot.problems.map((r) => r.id),
    ...snapshot.objectives.map((r) => r.id),
    ...snapshot.strategies.map((r) => r.id),
    ...snapshot.tactics.map((r) => r.id),
    ...(snapshot.sources ?? []).map((s) => s.sourceId),
    ...(snapshot.ppostCosts ?? []).map((c) => c.id),
    ...(finance
      ? [
          ...finance.estimates.map((e) => e.code),
          ...finance.fundingSources.map((s) => s.code),
          ...finance.fundingRequests.map((r) => r.code),
          ...finance.financialEntries.map((e) => e.code),
        ]
      : []),
  ];
}
