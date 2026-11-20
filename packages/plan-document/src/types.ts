/**
 * The draft shape the renderer accepts. Mirrors RecoveryPlanDraftSchema in
 * packages/ai-service/src/plan/draftSchema.ts (ai-service's tests check that
 * real drafts satisfy this type). Kept free of Zod and docx types so browser
 * and server consumers on any TypeScript version can use it.
 */

export type FieldStatus = 'PROVIDED' | 'NOT_PROVIDED' | 'REQUIRES_CONFIRMATION';

export interface PlanField {
  type: 'FIELD';
  label: string;
  value: string | null;
  status: FieldStatus;
  sourceRecordIds: string[];
}

export type PlanRecordType =
  | 'PRIORITY'
  | 'PROBLEM'
  | 'OBJECTIVE'
  | 'STRATEGY'
  | 'TACTIC'
  | 'ASSESSMENT_QUESTION'
  | 'VERIFICATION_TASK'
  | 'SOURCE_FILE'
  | 'FINANCE_ESTIMATE'
  | 'FUNDING_SOURCE'
  | 'COST_ENTRY';

export interface PlanRecord {
  type: 'RECORD';
  recordType: PlanRecordType;
  recordId: string;
  level: number;
  title: string;
  fields: PlanField[];
}

export interface PlanAiItem {
  type: 'AI_RECOMMENDATION';
  label: string;
  title?: string;
  text: string;
  sourceRecordIds: string[];
}

export type PlanItem = PlanField | PlanRecord | PlanAiItem;

export type PlanSectionKey =
  | 'DOCUMENT_CONTROL'
  | 'EXECUTIVE_SUMMARY'
  | 'EVENT_OVERVIEW'
  | 'IMPACT_ASSESSMENT'
  | 'RECOVERY_PRIORITIES'
  | 'PPOST_CHAINS'
  | 'RESOURCES_AND_BUDGET'
  | 'COSTS_AND_FUNDING'
  | 'GAPS_AND_CONFIRMATIONS'
  | 'RECOMMENDED_NEXT_STEPS'
  | 'SOURCE_PROVENANCE'
  | 'SOURCE_RECORD_INDEX';

export interface PlanSection {
  key: PlanSectionKey;
  title: string;
  origin: 'SOURCE_DATA' | 'AI_RECOMMENDATION' | 'MIXED';
  items: PlanItem[];
}

export interface RecoveryPlanDraft {
  kind: 'INITIAL_RECOVERY_PLAN_DRAFT';
  structure: { id: string; provisional: true; note: string };
  title: string;
  disasterId: string;
  snapshotCapturedAt: string;
  isSynthetic: boolean;
  aiNotice: string;
  sections: PlanSection[];
}

/**
 * Who approved the draft. The demo passes SIMULATED; a future backend passes
 * APPROVED only after it has saved the exact reviewed draft.
 */
export type PlanApproval =
  | { kind: 'SIMULATED'; approvedAt: string }
  | { kind: 'APPROVED'; approvedAt: string; approvedBy: string };

export interface RenderRecoveryPlanOptions {
  /** ID of the reviewed draft; printed on every page. */
  draftId: string;
  approval: PlanApproval;
}
