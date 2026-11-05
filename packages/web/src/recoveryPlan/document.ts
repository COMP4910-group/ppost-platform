import type { RenderRecoveryPlanOptions } from '@ppost/plan-document';
import type { RecoveryPlanDraft } from './types';

export interface PlanDocument {
  blob: Blob;
  filename: string;
}

/** Renders a reviewed draft to DOCX in memory. The demo only ever passes a SIMULATED approval. */
export type RenderPlanDocument = (
  draft: RecoveryPlanDraft,
  options: RenderRecoveryPlanOptions,
) => Promise<PlanDocument>;

export const renderPlanDocument: RenderPlanDocument = async (draft, options) => {
  // Loaded on demand: the DOCX library is only needed after approval.
  const { DOCX_MIME_TYPE, recoveryPlanDocxFilename, renderRecoveryPlanDocx } = await import('@ppost/plan-document');
  const bytes = await renderRecoveryPlanDocx(draft, options);
  return { blob: new Blob([bytes], { type: DOCX_MIME_TYPE }), filename: recoveryPlanDocxFilename(draft, options) };
};
