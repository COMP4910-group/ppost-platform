import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { RecoveryPlanDraftSchema, createMockClient, generateRecoveryPlanDraft } from "../src/index.ts";
import { syntheticNarrative, syntheticSnapshot } from "./fixtures/syntheticRecoveryPlan.ts";

// The web demo ships a static copy of a generated draft, because the browser
// must not import ai-service. This keeps that copy in sync with the real schema.
const webMockDraftPath = new URL("../../web/src/recoveryPlan/mockDraft.json", import.meta.url);
const REGENERATE =
  "Regenerate it with: (cd packages/ai-service && node examples/recoveryPlanMock.ts --json) > packages/web/src/recoveryPlan/mockDraft.json";

describe("web demo mock draft", () => {
  const webDraft: unknown = JSON.parse(readFileSync(webMockDraftPath, "utf8"));

  it("matches the real draft schema", () => {
    const result = RecoveryPlanDraftSchema.safeParse(webDraft);
    assert.ok(result.success, `mockDraft.json no longer matches RecoveryPlanDraftSchema. ${REGENERATE}`);
  });

  it("equals the draft ai-service currently generates from the synthetic fixture", async () => {
    const { draft } = await generateRecoveryPlanDraft(syntheticSnapshot, {
      client: createMockClient(syntheticNarrative),
    });
    assert.deepEqual(webDraft, draft, `mockDraft.json is out of date. ${REGENERATE}`);
  });
});
