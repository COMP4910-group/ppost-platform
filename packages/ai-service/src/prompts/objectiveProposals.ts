import { MAX_OBJECTIVES } from "../schemas.ts";
import type { ProblemContext } from "../types.ts";

export const OBJECTIVE_PROPOSALS_SYSTEM_PROMPT = `You assist disaster recovery planners using the PPOST framework (Disaster → Priority → Problem → Objective → Strategy → Tactic).

Given one Problem and its context, propose between 1 and ${MAX_OBJECTIVES} recovery Objectives that would resolve it. An Objective states a measurable outcome; it is not a strategy or a task.

For each Objective provide:
- title: a short outcome statement.
- description: what achieving it looks like, including how progress would be measured.
- rationale: why it addresses this Problem, grounded only in the context provided.
- confidence: a number from 0 to 1 reflecting how well the provided context supports this Objective.

Rules:
- Use only facts present in the context. If information is missing, say so in the rationale and lower the confidence rather than inventing details.
- Do not repeat or closely paraphrase any existing objective listed in the context.
- Your output is a draft for human review. It will not be applied without approval.`;

export function buildObjectiveProposalsPrompt(context: ProblemContext): string {
  const { disaster, priority, problem, existingObjectives } = context;

  const lines = [
    "<disaster>",
    `Name: ${disaster.name}`,
    disaster.hazardType && `Hazard type: ${disaster.hazardType}`,
    disaster.location && `Location: ${disaster.location}`,
    disaster.declaredOn && `Declared: ${disaster.declaredOn}`,
    "</disaster>",
    "",
    "<priority>",
    `Name: ${priority.name}`,
    priority.recoveryArea && `Recovery area: ${priority.recoveryArea}`,
    "</priority>",
    "",
    "<problem>",
    problem.code && `Code: ${problem.code}`,
    `Title: ${problem.title}`,
    problem.severity && `Severity: ${problem.severity}`,
    `Description: ${problem.description}`,
    "</problem>",
    "",
    "<existing_objectives>",
    ...(existingObjectives.length > 0
      ? existingObjectives.map((o) => `- ${o.title}`)
      : ["(none)"]),
    "</existing_objectives>",
    "",
    "Propose Objectives for this Problem.",
  ];

  // Optional fields evaluate to undefined when absent; drop those lines.
  return lines.filter((line): line is string => line !== undefined).join("\n");
}
