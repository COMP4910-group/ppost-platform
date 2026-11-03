/**
 * Browser-side copy of the Initial Recovery Plan draft contract.
 *
 * Mirrors RecoveryPlanDraftSchema in packages/ai-service/src/plan/draftSchema.ts.
 * The web app must not import ai-service (server-side code that holds the AI
 * client); ai-service's test/webMockDraft.test.ts checks that mockDraft.json
 * still matches the real schema.
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
  | 'VERIFICATION_TASK';

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
  | 'GAPS_AND_CONFIRMATIONS'
  | 'RECOMMENDED_NEXT_STEPS'
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

/** Response of the future POST /api/disasters/:id/recovery-plan/drafts route. */
export interface GenerateDraftResult {
  draftId: string;
  draft: RecoveryPlanDraft;
  promptVersion: string;
}

export interface RecoveryPlanApi {
  /** True for the demo adapter; the UI says so prominently. */
  readonly isMock: boolean;
  /** Rejects with an AbortError when `signal` is aborted before completion. */
  generateDraft(disasterId: string, options?: { signal?: AbortSignal }): Promise<GenerateDraftResult>;
}
