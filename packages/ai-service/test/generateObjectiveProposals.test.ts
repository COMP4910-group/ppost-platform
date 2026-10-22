import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ObjectiveProposalsModelOutputSchema,
  ProposalGenerationError,
  createMockClient,
  generateObjectiveProposals,
} from "../src/index.ts";
import { OBJECTIVE_PROPOSALS_SYSTEM_PROMPT } from "../src/prompts/objectiveProposals.ts";
import {
  clearwaterRidgeHousingProblem,
  validModelOutput,
} from "./fixtures/clearwaterRidge.ts";

function assertGenerationError(code: ProposalGenerationError["code"]) {
  return (error: unknown) => {
    assert.ok(error instanceof ProposalGenerationError);
    assert.equal(error.code, code);
    return true;
  };
}

describe("generateObjectiveProposals", () => {
  it("returns validated proposals linked to the source problem", async () => {
    const client = createMockClient(validModelOutput);

    const result = await generateObjectiveProposals(clearwaterRidgeHousingProblem, {
      client,
    });

    assert.deepEqual(
      result.proposals,
      validModelOutput.objectives.map((objective) => ({
        ...objective,
        sourceProblemId: "prb-017",
      })),
    );
  });

  it("does not add workflow metadata to proposals", async () => {
    const client = createMockClient(validModelOutput);

    const { proposals } = await generateObjectiveProposals(
      clearwaterRidgeHousingProblem,
      { client },
    );

    for (const proposal of proposals) {
      assert.deepEqual(Object.keys(proposal).sort(), [
        "confidence",
        "description",
        "rationale",
        "sourceProblemId",
        "title",
      ]);
    }
  });

  it("sends the system prompt, a context-bearing prompt, and the output schema", async () => {
    const client = createMockClient(validModelOutput);

    await generateObjectiveProposals(clearwaterRidgeHousingProblem, { client });

    assert.equal(client.calls.length, 1);
    const [request] = client.calls;
    assert.ok(request);
    assert.equal(request.system, OBJECTIVE_PROPOSALS_SYSTEM_PROMPT);
    assert.equal(request.schema, ObjectiveProposalsModelOutputSchema);
    assert.match(request.prompt, /Clearwater Ridge Wildfire/);
    assert.match(request.prompt, /Displaced residents lack interim housing/);
    assert.match(request.prompt, /Severity: high/);
    assert.match(request.prompt, /- Complete damage assessments for all affected homes/);
  });

  it("accepts a context without existing objectives", async () => {
    const { existingObjectives: _omitted, ...context } = clearwaterRidgeHousingProblem;
    const client = createMockClient(validModelOutput);

    await generateObjectiveProposals(context, { client });

    assert.match(client.calls[0]?.prompt ?? "", /<existing_objectives>\n\(none\)/);
  });

  it("rejects an invalid context without calling the client", async () => {
    const client = createMockClient(validModelOutput);
    const invalid = {
      ...clearwaterRidgeHousingProblem,
      problem: { ...clearwaterRidgeHousingProblem.problem, title: "" },
    };

    await assert.rejects(
      generateObjectiveProposals(invalid, { client }),
      assertGenerationError("INVALID_CONTEXT"),
    );
    assert.equal(client.calls.length, 0);
  });

  const [firstObjective] = validModelOutput.objectives;
  const invalidOutputs: [label: string, output: unknown][] = [
    ["a non-JSON string", "not json"],
    ["null", null],
    ["an empty objectives list", { objectives: [] }],
    ["more than three objectives", { objectives: Array(4).fill(firstObjective) }],
    ["confidence above 1", { objectives: [{ ...firstObjective, confidence: 1.2 }] }],
    ["confidence below 0", { objectives: [{ ...firstObjective, confidence: -0.1 }] }],
    [
      "a missing rationale",
      { objectives: [{ title: "Title", description: "Description", confidence: 0.5 }] },
    ],
  ];

  for (const [label, output] of invalidOutputs) {
    it(`rejects model output with ${label}`, async () => {
      const client = createMockClient(output);

      await assert.rejects(
        generateObjectiveProposals(clearwaterRidgeHousingProblem, { client }),
        assertGenerationError("INVALID_MODEL_OUTPUT"),
      );
    });
  }

  it("propagates errors thrown by the client", async () => {
    const client = createMockClient(() => {
      throw new ProposalGenerationError("MODEL_REFUSED", "refused");
    });

    await assert.rejects(
      generateObjectiveProposals(clearwaterRidgeHousingProblem, { client }),
      assertGenerationError("MODEL_REFUSED"),
    );
  });
});
