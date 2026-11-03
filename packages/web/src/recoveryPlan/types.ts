/**
 * Initial Recovery Plan types used by the web app.
 *
 * The draft shape comes from @ppost/plan-document (browser-safe, no Zod or AI
 * code), so the preview and the DOCX renderer read the same contract. It
 * mirrors RecoveryPlanDraftSchema in packages/ai-service; the web app must not
 * import ai-service, and ai-service's test/webMockDraft.test.ts checks that
 * mockDraft.json still matches the real schema.
 */
import type { RecoveryPlanDraft } from '@ppost/plan-document';

export type {
  FieldStatus,
  PlanAiItem,
  PlanField,
  PlanItem,
  PlanRecord,
  PlanRecordType,
  PlanSection,
  PlanSectionKey,
  RecoveryPlanDraft,
} from '@ppost/plan-document';

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
