import type { AIClient } from "../client.ts";
import { ProposalGenerationError } from "../errors.ts";
import { assembleRecoveryPlanDraft, findUnknownSourceIds } from "./assemblePlan.ts";
import { RecoveryPlanNarrativeSchema } from "./draftSchema.ts";
import {
  RECOVERY_PLAN_PROMPT_VERSION,
  RECOVERY_PLAN_SYSTEM_PROMPT,
  buildRecoveryPlanPrompt,
} from "./prompt.ts";
import { PlanSourceSnapshotSchema } from "./snapshotSchema.ts";
import type { PlanSourceSnapshotInput, RecoveryPlanDraft } from "./types.ts";

export interface GenerateRecoveryPlanDraftOptions {
  client: AIClient;
}

export interface RecoveryPlanDraftResult {
  draft: RecoveryPlanDraft;
  promptVersion: typeof RECOVERY_PLAN_PROMPT_VERSION;
}

/**
 * Generates a reviewable Initial Recovery Plan draft from a source snapshot.
 *
 * The model writes only the labelled narrative; factual sections are built
 * from the snapshot. No persistence and no workflow state: the caller holds
 * the draft for review and decides what happens on approval or rejection.
 */
export async function generateRecoveryPlanDraft(
  snapshot: PlanSourceSnapshotInput,
  { client }: GenerateRecoveryPlanDraftOptions,
): Promise<RecoveryPlanDraftResult> {
  const parsedSnapshot = PlanSourceSnapshotSchema.safeParse(snapshot);
  if (!parsedSnapshot.success) {
    throw new ProposalGenerationError("INVALID_CONTEXT", "Source snapshot failed validation.", {
      details: parsedSnapshot.error.issues,
    });
  }
  const validSnapshot = parsedSnapshot.data;

  const raw = await client.generateStructured({
    system: RECOVERY_PLAN_SYSTEM_PROMPT,
    prompt: buildRecoveryPlanPrompt(validSnapshot),
    schema: RecoveryPlanNarrativeSchema,
  });

  const parsedNarrative = RecoveryPlanNarrativeSchema.safeParse(raw);
  if (!parsedNarrative.success) {
    throw new ProposalGenerationError("INVALID_MODEL_OUTPUT", "Model output failed validation.", {
      details: parsedNarrative.error.issues,
    });
  }

  // A cited ID only shows which record an AI statement refers to. Unknown IDs
  // are rejected; known IDs are not treated as evidence the statement is true.
  const unknownIds = findUnknownSourceIds(validSnapshot, parsedNarrative.data);
  if (unknownIds.length > 0) {
    throw new ProposalGenerationError(
      "UNKNOWN_SOURCE_IDS",
      "Model output cited source record IDs that are not in the snapshot.",
      { details: { unknownIds } },
    );
  }

  return {
    draft: assembleRecoveryPlanDraft(validSnapshot, parsedNarrative.data),
    promptVersion: RECOVERY_PLAN_PROMPT_VERSION,
  };
}
