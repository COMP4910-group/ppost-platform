export { generateObjectiveProposals } from "./generateObjectiveProposals.ts";
export type { GenerateObjectiveProposalsOptions } from "./generateObjectiveProposals.ts";

export { createAnthropicClient, DEFAULT_MODEL } from "./client.ts";
export type {
  AIClient,
  AnthropicClientOptions,
  Effort,
  StructuredRequest,
} from "./client.ts";

export { createMockClient } from "./mock/mockClient.ts";
export type { MockAIClient, MockResponder } from "./mock/mockClient.ts";

export { ProposalGenerationError } from "./errors.ts";
export type { ProposalGenerationErrorCode } from "./errors.ts";

export * from "./schemas.ts";
export type * from "./types.ts";

// Initial Recovery Plan draft generation
export { generateRecoveryPlanDraft } from "./plan/generateRecoveryPlanDraft.ts";
export type {
  GenerateRecoveryPlanDraftOptions,
  RecoveryPlanDraftResult,
} from "./plan/generateRecoveryPlanDraft.ts";
export {
  assembleRecoveryPlanDraft,
  findUnknownSourceIds,
  findUnresolvedReferences,
} from "./plan/assemblePlan.ts";
export type { UnresolvedReference } from "./plan/assemblePlan.ts";
export {
  RECOVERY_PLAN_PROMPT_VERSION,
  RECOVERY_PLAN_SYSTEM_PROMPT,
  buildRecoveryPlanPrompt,
} from "./plan/prompt.ts";
export * from "./plan/snapshotSchema.ts";
export * from "./plan/draftSchema.ts";
export type * from "./plan/types.ts";
