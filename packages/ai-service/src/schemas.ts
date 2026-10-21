import { z } from "zod";

// ---------------------------------------------------------------------------
// Input: the planning context the caller (API layer) assembles from the DB.
// ---------------------------------------------------------------------------

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const DisasterContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hazardType: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  declaredOn: z.string().min(1).optional(),
});

export const PriorityContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  recoveryArea: z.string().min(1).optional(),
});

export const ProblemContextItemSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: SeveritySchema.optional(),
});

export const ExistingObjectiveSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const ProblemContextSchema = z.object({
  disaster: DisasterContextSchema,
  priority: PriorityContextSchema,
  problem: ProblemContextItemSchema,
  existingObjectives: z.array(ExistingObjectiveSchema).default([]),
});

// ---------------------------------------------------------------------------
// Output: what the model is asked to produce. sourceProblemId is NOT asked of
// the model; it is attached deterministically from the input context.
// ---------------------------------------------------------------------------

export const MAX_OBJECTIVES = 3;

export const GeneratedObjectiveSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const ObjectiveProposalsModelOutputSchema = z.object({
  objectives: z.array(GeneratedObjectiveSchema).min(1).max(MAX_OBJECTIVES),
});

// ---------------------------------------------------------------------------
// Public result: AI-generated content only. Workflow metadata (status, id,
// createdAt, reviewedAt, reviewedBy) belongs to the API/database layer.
// ---------------------------------------------------------------------------

export const ObjectiveProposalSchema = GeneratedObjectiveSchema.extend({
  sourceProblemId: z.string().min(1),
});
