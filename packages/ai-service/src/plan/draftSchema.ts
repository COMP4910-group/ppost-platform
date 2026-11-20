import { z } from "zod";

// ---------------------------------------------------------------------------
// AI narrative: the only part of the plan the model writes. It contains no
// facts of its own; every item must cite the source records it refers to.
// ---------------------------------------------------------------------------

export const MAX_RECOMMENDATIONS = 12;
export const MAX_AI_CONFIRMATIONS = 12;

const citedIds = z.array(z.string().min(1)).min(1);

export const AiCitedTextSchema = z.object({
  text: z.string().min(1),
  sourceRecordIds: citedIds,
});

export const AiRecommendationSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  sourceRecordIds: citedIds,
});

export const RecoveryPlanNarrativeSchema = z.object({
  executiveSummary: AiCitedTextSchema,
  recommendations: z.array(AiRecommendationSchema).max(MAX_RECOMMENDATIONS),
  confirmationsNeeded: z.array(AiCitedTextSchema).max(MAX_AI_CONFIRMATIONS),
});

// ---------------------------------------------------------------------------
// Assembled draft: factual sections built deterministically from the snapshot
// plus clearly labelled AI items. This is what a reviewer previews.
// ---------------------------------------------------------------------------

export const NOT_PROVIDED = "Not provided";
export const REQUIRES_CONFIRMATION = "Requires confirmation";
export const AI_RECOMMENDATION_LABEL =
  "AI recommendation: not verified; requires human review";
export const AI_NOTICE =
  "Sections marked as AI recommendations were drafted by an AI model from the supplied planning data. " +
  "Cited source record IDs show which records a recommendation refers to; they do not confirm that the " +
  "recommendation is accurate or supported. All other content is reproduced from the supplied data.";

/** Provisional until the client's Initial Recovery Plan template is supplied. */
export const PROVISIONAL_STRUCTURE = {
  id: "provisional-v1",
  provisional: true,
  note: "Provisional structure pending the client's Initial Recovery Plan template.",
} as const;

/** v1 plus "Costs and funding" and "Source files and provenance", used when a snapshot carries source exports. */
export const PROVISIONAL_STRUCTURE_WITH_SOURCES = { ...PROVISIONAL_STRUCTURE, id: "provisional-v2" } as const;

export const FieldStatusSchema = z.enum(["PROVIDED", "NOT_PROVIDED", "REQUIRES_CONFIRMATION"]);

export const PlanFieldSchema = z.object({
  type: z.literal("FIELD"),
  label: z.string().min(1),
  /** Exactly as supplied; null when nothing was supplied. */
  value: z.string().nullable(),
  status: FieldStatusSchema,
  sourceRecordIds: z.array(z.string().min(1)),
});

export const PlanRecordTypeSchema = z.enum([
  "PRIORITY",
  "PROBLEM",
  "OBJECTIVE",
  "STRATEGY",
  "TACTIC",
  "ASSESSMENT_QUESTION",
  "VERIFICATION_TASK",
  "SOURCE_FILE",
  "FINANCE_ESTIMATE",
  "FUNDING_SOURCE",
  "COST_ENTRY",
]);

export const PlanRecordSchema = z.object({
  type: z.literal("RECORD"),
  recordType: PlanRecordTypeSchema,
  recordId: z.string().min(1),
  /** Nesting depth for display (priority 0 → tactic 4). */
  level: z.number().int().min(0).max(4),
  title: z.string().min(1),
  fields: z.array(PlanFieldSchema),
});

export const PlanAiItemSchema = z.object({
  type: z.literal("AI_RECOMMENDATION"),
  label: z.literal(AI_RECOMMENDATION_LABEL),
  title: z.string().min(1).optional(),
  text: z.string().min(1),
  sourceRecordIds: citedIds,
});

export const PlanItemSchema = z.discriminatedUnion("type", [
  PlanFieldSchema,
  PlanRecordSchema,
  PlanAiItemSchema,
]);

export const PlanSectionKeySchema = z.enum([
  "DOCUMENT_CONTROL",
  "EXECUTIVE_SUMMARY",
  "EVENT_OVERVIEW",
  "IMPACT_ASSESSMENT",
  "RECOVERY_PRIORITIES",
  "PPOST_CHAINS",
  "RESOURCES_AND_BUDGET",
  "COSTS_AND_FUNDING",
  "GAPS_AND_CONFIRMATIONS",
  "RECOMMENDED_NEXT_STEPS",
  "SOURCE_PROVENANCE",
  "SOURCE_RECORD_INDEX",
]);

export const PlanSectionSchema = z.object({
  key: PlanSectionKeySchema,
  title: z.string().min(1),
  origin: z.enum(["SOURCE_DATA", "AI_RECOMMENDATION", "MIXED"]),
  items: z.array(PlanItemSchema),
});

export const RecoveryPlanDraftSchema = z.object({
  kind: z.literal("INITIAL_RECOVERY_PLAN_DRAFT"),
  structure: z.object({
    id: z.enum([PROVISIONAL_STRUCTURE.id, PROVISIONAL_STRUCTURE_WITH_SOURCES.id]),
    provisional: z.literal(true),
    note: z.string().min(1),
  }),
  title: z.string().min(1),
  disasterId: z.string().min(1),
  snapshotCapturedAt: z.string().min(1),
  isSynthetic: z.boolean(),
  aiNotice: z.literal(AI_NOTICE),
  sections: z.array(PlanSectionSchema),
});
