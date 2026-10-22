import type { z } from "zod";
import type {
  DisasterContextSchema,
  ExistingObjectiveSchema,
  GeneratedObjectiveSchema,
  ObjectiveProposalSchema,
  ObjectiveProposalsModelOutputSchema,
  PriorityContextSchema,
  ProblemContextItemSchema,
  ProblemContextSchema,
  SeveritySchema,
} from "./schemas.ts";

export type Severity = z.infer<typeof SeveritySchema>;
export type DisasterContext = z.infer<typeof DisasterContextSchema>;
export type PriorityContext = z.infer<typeof PriorityContextSchema>;
export type ProblemContextItem = z.infer<typeof ProblemContextItemSchema>;
export type ExistingObjective = z.infer<typeof ExistingObjectiveSchema>;

/** What callers pass in. `existingObjectives` may be omitted. */
export type ProblemContextInput = z.input<typeof ProblemContextSchema>;
/** The context after validation and defaults have been applied. */
export type ProblemContext = z.output<typeof ProblemContextSchema>;

export type GeneratedObjective = z.infer<typeof GeneratedObjectiveSchema>;
export type ObjectiveProposalsModelOutput = z.infer<
  typeof ObjectiveProposalsModelOutputSchema
>;

/**
 * A single AI-generated objective proposal. Contains generated content only;
 * workflow state is added by the API/database layer.
 */
export type ObjectiveProposal = z.infer<typeof ObjectiveProposalSchema>;

export interface ObjectiveProposalResult {
  proposals: ObjectiveProposal[];
}
