import type { z } from "zod";
import type {
  AiCitedTextSchema,
  AiRecommendationSchema,
  FieldStatusSchema,
  PlanAiItemSchema,
  PlanFieldSchema,
  PlanItemSchema,
  PlanRecordSchema,
  PlanRecordTypeSchema,
  PlanSectionKeySchema,
  PlanSectionSchema,
  RecoveryPlanDraftSchema,
  RecoveryPlanNarrativeSchema,
} from "./draftSchema.ts";

export type { PlanSourceSnapshot, PlanSourceSnapshotInput } from "./snapshotSchema.ts";

export type AiCitedText = z.infer<typeof AiCitedTextSchema>;
export type AiRecommendation = z.infer<typeof AiRecommendationSchema>;
export type RecoveryPlanNarrative = z.infer<typeof RecoveryPlanNarrativeSchema>;

export type FieldStatus = z.infer<typeof FieldStatusSchema>;
export type PlanField = z.infer<typeof PlanFieldSchema>;
export type PlanRecordType = z.infer<typeof PlanRecordTypeSchema>;
export type PlanRecord = z.infer<typeof PlanRecordSchema>;
export type PlanAiItem = z.infer<typeof PlanAiItemSchema>;
export type PlanItem = z.infer<typeof PlanItemSchema>;
export type PlanSectionKey = z.infer<typeof PlanSectionKeySchema>;
export type PlanSection = z.infer<typeof PlanSectionSchema>;

/** A reviewable draft. Contains no workflow state (approval belongs to the API). */
export type RecoveryPlanDraft = z.infer<typeof RecoveryPlanDraftSchema>;
