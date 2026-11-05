import type { AIClient } from "./client.ts";
import { ProposalGenerationError } from "./errors.ts";
import {
  OBJECTIVE_PROPOSALS_SYSTEM_PROMPT,
  buildObjectiveProposalsPrompt,
} from "./prompts/objectiveProposals.ts";
import {
  ObjectiveProposalsModelOutputSchema,
  ProblemContextSchema,
} from "./schemas.ts";
import type { ObjectiveProposalResult, ProblemContextInput } from "./types.ts";

export interface GenerateObjectiveProposalsOptions {
  client: AIClient;
}

/**
 * Generates draft Objective proposals for a single Problem.
 *
 * Pure with respect to persistence: no database access and no workflow state.
 * The caller is responsible for storing results and for the approval process.
 */
export async function generateObjectiveProposals(
  context: ProblemContextInput,
  { client }: GenerateObjectiveProposalsOptions,
): Promise<ObjectiveProposalResult> {
  const parsedContext = ProblemContextSchema.safeParse(context);
  if (!parsedContext.success) {
    throw new ProposalGenerationError(
      "INVALID_CONTEXT",
      "Problem context failed validation.",
      { details: parsedContext.error.issues },
    );
  }
  const validContext = parsedContext.data;

  const raw = await client.generateStructured({
    system: OBJECTIVE_PROPOSALS_SYSTEM_PROMPT,
    prompt: buildObjectiveProposalsPrompt(validContext),
    schema: ObjectiveProposalsModelOutputSchema,
  });

  const parsedOutput = ObjectiveProposalsModelOutputSchema.safeParse(raw);
  if (!parsedOutput.success) {
    throw new ProposalGenerationError(
      "INVALID_MODEL_OUTPUT",
      "Model output failed validation.",
      { details: parsedOutput.error.issues },
    );
  }

  return {
    proposals: parsedOutput.data.objectives.map((objective) => ({
      ...objective,
      sourceProblemId: validContext.problem.id,
    })),
  };
}
