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
  >,
): string[] {
  return [
    snapshot.disaster.id,
    ...snapshot.priorities.map((r) => r.id),
    ...snapshot.assessment.questions.map((r) => r.id),
    ...snapshot.assessment.verificationTasks.map((r) => r.id),
    ...snapshot.problems.map((r) => r.id),
    ...snapshot.objectives.map((r) => r.id),
    ...snapshot.strategies.map((r) => r.id),
    ...snapshot.tactics.map((r) => r.id),
  ];
}
