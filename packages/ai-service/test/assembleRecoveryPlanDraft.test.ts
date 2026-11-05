import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PlanSourceSnapshotSchema,
  assembleRecoveryPlanDraft,
  findUnresolvedReferences,
} from "../src/index.ts";
import type {
  PlanField,
  PlanRecord,
  PlanSectionKey,
  PlanSourceSnapshotInput,
  RecoveryPlanDraft,
  RecoveryPlanNarrative,
} from "../src/index.ts";
import { syntheticNarrative, syntheticSnapshot } from "./fixtures/syntheticRecoveryPlan.ts";

const emptyNarrative: RecoveryPlanNarrative = {
  executiveSummary: { text: "Summary.", sourceRecordIds: ["EV-2026-014"] },
  recommendations: [],
  confirmationsNeeded: [],
};

function assemble(snapshot: PlanSourceSnapshotInput, narrative = syntheticNarrative): RecoveryPlanDraft {
  return assembleRecoveryPlanDraft(PlanSourceSnapshotSchema.parse(snapshot), narrative);
}

function section(draft: RecoveryPlanDraft, key: PlanSectionKey) {
  const found = draft.sections.find((s) => s.key === key);
  assert.ok(found, `section ${key}`);
  return found;
}

function fieldIn(draft: RecoveryPlanDraft, key: PlanSectionKey, label: string): PlanField {
  const found = section(draft, key).items.find((i): i is PlanField => i.type === "FIELD" && i.label === label);
  assert.ok(found, `${key} field "${label}"`);
  return found;
}

function recordIn(draft: RecoveryPlanDraft, key: PlanSectionKey, recordId: string): PlanRecord {
  const found = section(draft, key).items.find(
    (i): i is PlanRecord => i.type === "RECORD" && i.recordId === recordId,
  );
  assert.ok(found, `${key} record ${recordId}`);
  return found;
}

function fieldOf(rec: PlanRecord, label: string): PlanField {
  const found = rec.fields.find((f) => f.label === label);
  assert.ok(found, `${rec.recordId} field "${label}"`);
  return found;
}

describe("assembleRecoveryPlanDraft: supplied facts", () => {
  const draft = assemble(syntheticSnapshot);

  it("reproduces event details exactly as supplied", () => {
    assert.equal(fieldIn(draft, "EVENT_OVERVIEW", "Event name").value, "Clearwater Ridge Wildfire");
    assert.equal(fieldIn(draft, "EVENT_OVERVIEW", "Location").value, "Interior British Columbia, Canada");
    assert.equal(fieldIn(draft, "EVENT_OVERVIEW", "Declared").value, "2026-08-14");
    assert.equal(fieldIn(draft, "EVENT_OVERVIEW", "Hazard types").value, "Wildfire");
    assert.deepEqual(fieldIn(draft, "EVENT_OVERVIEW", "Event name").sourceRecordIds, ["EV-2026-014"]);
  });

  it("flags synthetic data in document control", () => {
    assert.equal(
      fieldIn(draft, "DOCUMENT_CONTROL", "Data classification").value,
      "SYNTHETIC: demonstration data, not real client data",
    );
    assert.match(fieldIn(draft, "DOCUMENT_CONTROL", "Document structure").value ?? "", /Provisional/);
  });

  it("reproduces tactic owners, dates, measures and estimates without alteration", () => {
    const t014 = recordIn(draft, "PPOST_CHAINS", "T-014");
    assert.equal(t014.level, 4);
    assert.equal(fieldOf(t014, "Owner").value, "L. Tremblay");
    assert.equal(fieldOf(t014, "Start").value, "2026-10-12");
    assert.equal(fieldOf(t014, "End").value, "2026-11-02");
    assert.equal(fieldOf(t014, "Success measure").value, "42 units occupied by Nov 30");
    assert.equal(fieldOf(t014, "Status").value, "IN_REVIEW");
    assert.equal(fieldOf(t014, "Secondary priorities").value, "PR-3");

    const budget = recordIn(draft, "RESOURCES_AND_BUDGET", "T-014");
    assert.equal(fieldOf(budget, "Class D estimate").value, "2,122,900 (currency not provided)");
    assert.equal(fieldOf(budget, "Team").value, "Regional Housing Taskforce");
    assert.equal(fieldOf(budget, "Delivery method").value, "CONTRACTOR");
  });

  it("only sums supplied estimates and says how many tactics have one", () => {
    assert.equal(
      fieldIn(draft, "RESOURCES_AND_BUDGET", "Tactics with a supplied Class D estimate").value,
      "1 of 2",
    );
    const sum = fieldIn(
      draft,
      "RESOURCES_AND_BUDGET",
      "Sum of supplied tactic estimates (tactics without an estimate are excluded)",
    );
    assert.equal(sum.value, "2,122,900 (currency not provided)");
    assert.deepEqual(sum.sourceRecordIds, ["T-014"]);
    assert.equal(fieldIn(draft, "RESOURCES_AND_BUDGET", "Funding sources and funding gap").status, "NOT_PROVIDED");
  });

  it("uses a supplied currency verbatim", () => {
    const withCurrency = assemble({ ...syntheticSnapshot, currency: "CAD" });
    const budget = recordIn(withCurrency, "RESOURCES_AND_BUDGET", "T-014");
    assert.equal(fieldOf(budget, "Class D estimate").value, "2,122,900 CAD");
  });

  it("nests the PPOST chain under its priority in rank order", () => {
    const chain = section(draft, "PPOST_CHAINS").items.filter((i): i is PlanRecord => i.type === "RECORD");
    assert.deepEqual(
      chain.slice(0, 12).map((r) => `${r.level}:${r.recordId}`),
      [
        "0:PR-2", "1:P-Q-H07", "1:P-Q-H07a",
        "0:PR-4", "1:P-Q-W03-U",
        "0:PR-6", "1:P-02", "2:O-04", "3:S-07", "4:T-014", "1:P-04",
        "1:T-Q-W03-SAFE",
      ],
    );
  });

  it("lists every source record in the index", () => {
    const index = section(draft, "SOURCE_RECORD_INDEX").items as PlanField[];
    assert.equal(index.length, 1 + 8 + 4 + 1 + 5 + 1 + 1 + 2);
    assert.equal(index.find((f) => f.label === "S-07")?.value, "Strategy: Deploy prefabricated modular units");
  });
});

describe("assembleRecoveryPlanDraft: UNKNOWN and missing information", () => {
  const draft = assemble(syntheticSnapshot);

  it("preserves UNKNOWN answers as UNKNOWN requiring confirmation", () => {
    const answer = fieldOf(recordIn(draft, "IMPACT_ASSESSMENT", "Q-W03"), "Answer");
    assert.equal(answer.value, "UNKNOWN");
    assert.equal(answer.status, "REQUIRES_CONFIRMATION");
    assert.equal(fieldOf(recordIn(draft, "IMPACT_ASSESSMENT", "Q-H07"), "Answer").value, "YES");
    assert.equal(fieldOf(recordIn(draft, "IMPACT_ASSESSMENT", "Q-H07a"), "Answer").value, "NO");
  });

  it("marks unanswered questions as not provided, not UNKNOWN", () => {
    const answer = fieldOf(recordIn(draft, "IMPACT_ASSESSMENT", "Q-F02"), "Answer");
    assert.equal(answer.value, null);
    assert.equal(answer.status, "NOT_PROVIDED");
  });

  it("marks problems derived from UNKNOWN answers as requiring confirmation", () => {
    const field = fieldOf(recordIn(draft, "PPOST_CHAINS", "P-Q-W03-U"), "Derived from UNKNOWN assessment answer");
    assert.equal(field.value, "Q-W03");
    assert.equal(field.status, "REQUIRES_CONFIRMATION");
  });

  it("marks missing owners, dates and links as not provided", () => {
    const safe = recordIn(draft, "PPOST_CHAINS", "T-Q-W03-SAFE");
    for (const label of ["Owner", "Accountable person", "Start", "End", "Location", "Success measure"]) {
      const f = fieldOf(safe, label);
      assert.equal(f.value, null, label);
      assert.equal(f.status, "NOT_PROVIDED", label);
    }
    assert.equal(fieldOf(recordIn(draft, "PPOST_CHAINS", "P-04"), "Objectives").status, "NOT_PROVIDED");
    assert.equal(fieldOf(recordIn(draft, "RESOURCES_AND_BUDGET", "T-Q-W03-SAFE"), "Class D estimate").status, "NOT_PROVIDED");
  });

  it("flags records that reference IDs missing from the snapshot", () => {
    assert.deepEqual(findUnresolvedReferences(PlanSourceSnapshotSchema.parse(syntheticSnapshot)), [
      { recordId: "P-04", referrer: "P-04", field: "UNKNOWN assessment question", missingId: "Q-H02" },
      { recordId: "T-Q-W03-SAFE", referrer: "T-Q-W03-SAFE", field: "strategy", missingId: "S-PRECAUTION" },
    ]);
    const linked = fieldOf(recordIn(draft, "PPOST_CHAINS", "T-Q-W03-SAFE"), "Linked strategy");
    assert.equal(linked.status, "REQUIRES_CONFIRMATION");
    assert.equal(linked.value, "S-PRECAUTION (not in the supplied data)");
  });

  it("collects gaps, UNKNOWNs, unanswered questions and open tasks for confirmation", () => {
    const gaps = section(draft, "GAPS_AND_CONFIRMATIONS").items.filter((i): i is PlanField => i.type === "FIELD");
    assert.ok(gaps.every((g) => g.status === "REQUIRES_CONFIRMATION"));
    const labels = gaps.map((g) => `${g.label}|${g.sourceRecordIds.join(",")}`);
    for (const expected of [
      "Known gap (ppost-engine matrix)|P-04",
      "Known gap (ppost-engine validateTactic)|T-Q-W03-SAFE",
      "Unresolved UNKNOWN answer|Q-W03",
      "Unanswered assessment question|Q-F02",
      "Open verification task|VT-Q-W03",
      "Unresolved reference|T-Q-W03-SAFE",
    ]) {
      assert.ok(labels.includes(expected), expected);
    }
  });

  it("marks absent optional disaster details as not provided", () => {
    const sparse = assemble({
      capturedAt: "2026-11-02T00:00:00.000Z",
      isSynthetic: true,
      disaster: { id: "EV-X", name: "Synthetic test event" },
    }, emptyNarrative);

    for (const label of ["Hazard types", "Location", "Declared", "Active recovery sectors"]) {
      assert.equal(fieldIn(sparse, "EVENT_OVERVIEW", label).status, "NOT_PROVIDED", label);
    }
    assert.equal(fieldIn(sparse, "IMPACT_ASSESSMENT", "Assessment questions").status, "NOT_PROVIDED");
    assert.equal(fieldIn(sparse, "RECOVERY_PRIORITIES", "Recovery priorities").status, "NOT_PROVIDED");
    assert.equal(fieldIn(sparse, "PPOST_CHAINS", "PPOST records").status, "NOT_PROVIDED");
    assert.equal(fieldIn(sparse, "RESOURCES_AND_BUDGET", "Currency").status, "NOT_PROVIDED");
    assert.equal(
      fieldIn(sparse, "RESOURCES_AND_BUDGET", "Sum of supplied tactic estimates (tactics without an estimate are excluded)").status,
      "NOT_PROVIDED",
    );
    assert.equal(fieldIn(sparse, "RECOMMENDED_NEXT_STEPS", "Recommendations").status, "NOT_PROVIDED");
    assert.equal(fieldIn(sparse, "GAPS_AND_CONFIRMATIONS", "Gaps").value, "None identified in the supplied data");
    assert.equal(fieldIn(sparse, "DOCUMENT_CONTROL", "Data classification").value, "SYNTHETIC: demonstration data, not real client data");
  });
});
