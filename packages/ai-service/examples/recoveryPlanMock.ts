/**
 * Mock example: generates an Initial Recovery Plan draft from SYNTHETIC data
 * with a mock AI client (no API key, no network) and prints a readable preview.
 *
 *   npm run example:plan -w @ppost/ai-service
 *   npm run example:plan -w @ppost/ai-service -- --json   # raw draft JSON
 */
import { createMockClient, generateRecoveryPlanDraft, NOT_PROVIDED, REQUIRES_CONFIRMATION } from "../src/index.ts";
import type { PlanField, PlanItem } from "../src/index.ts";
import { syntheticNarrative, syntheticSnapshot } from "../test/fixtures/syntheticRecoveryPlan.ts";

const { draft } = await generateRecoveryPlanDraft(syntheticSnapshot, {
  client: createMockClient(syntheticNarrative),
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(draft, null, 2));
} else {
  const out: string[] = [];
  const ids = (sourceRecordIds: string[]) => (sourceRecordIds.length > 0 ? `  [${sourceRecordIds.join(", ")}]` : "");
  const value = (f: PlanField) =>
    f.status === "NOT_PROVIDED"
      ? NOT_PROVIDED
      : f.status === "REQUIRES_CONFIRMATION"
        ? `${f.value}  (${REQUIRES_CONFIRMATION})`
        : f.value;
  const item = (i: PlanItem): string[] => {
    if (i.type === "FIELD") return [`  ${i.label}: ${value(i)}${ids(i.sourceRecordIds)}`];
    if (i.type === "AI_RECOMMENDATION")
      return [`  ✦ ${i.label}`, ...(i.title ? [`    ${i.title}`] : []), `    ${i.text}${ids(i.sourceRecordIds)}`];
    const indent = "  ".repeat(i.level + 1);
    return [
      `${indent}${i.recordType} ${i.recordId}: ${i.title}`,
      ...i.fields.map((f) => `${indent}  - ${f.label}: ${value(f)}`),
    ];
  };

  out.push(draft.title, `${draft.structure.note}`, "");
  for (const section of draft.sections) {
    out.push(`== ${section.title}  (${section.origin})`, ...section.items.flatMap(item), "");
  }
  console.log(out.join("\n"));
}
