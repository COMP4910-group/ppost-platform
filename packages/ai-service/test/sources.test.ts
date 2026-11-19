import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assembleRecoveryPlanDraft } from "../src/plan/assemblePlan.ts";
import { buildMockNarrative } from "../src/plan/mockNarrative.ts";
import type { PlanField, PlanRecord, RecoveryPlanDraft } from "../src/plan/types.ts";
import { type SourceFile, SourceError, formatCents, percentOf, toCents } from "../src/sources/common.ts";
import { type BuildSnapshotInput, buildPlanSnapshot } from "../src/sources/buildSnapshot.ts";
import { reconcileFinanceReport } from "../src/sources/reconcile.ts";
import type { FinanceReport } from "../src/sources/financeReport.ts";

const DIR = new URL("./fixtures/shared-data/", import.meta.url);
const raw = (path: string) => readFileSync(new URL(path, DIR));
const json = (path: string) => JSON.parse(raw(path).toString("utf8"));
const file = (fileName: string, value: unknown): SourceFile => ({ fileName, bytes: new TextEncoder().encode(JSON.stringify(value)) });
const original = (path: string): SourceFile => ({ fileName: path.split("/").pop()!, bytes: raw(path) });

const AS_OF = "2026-11-19T20:00:00Z";
const DISCLAIMER = "Planning and tracking only - not a payment or accounting system. SYNTHETIC DEMO DATA.";

function input(overrides: Partial<BuildSnapshotInput> = {}): BuildSnapshotInput {
  return {
    mapping: original("event-mapping.assumed.json"),
    ppost: original("divyansh/ppost.json"),
    impact: original("divyansh/impact.json"),
    matrix: original("divyansh/matrix.json"),
    finance: { report: original("daniel/finance_report.sample.json"), schema: original("daniel/finance_report.schema.json") },
    capturedAt: AS_OF,
    asOf: AS_OF,
    ...overrides,
  };
}
const withFinance = (mutate: (r: any) => void) => {
  const report = json("daniel/finance_report.sample.json");
  mutate(report);
  return input({ finance: { report: file("finance_report.sample.json", report), schema: original("daniel/finance_report.schema.json") } });
};
const withMapping = (mappings: unknown[]) => input({ mapping: file("mapping.json", { mapping_version: 1, mappings }) });
const assumedMapping = json("event-mapping.assumed.json").mappings[0];

function rejectsWith(fn: () => unknown, code: SourceError["code"], detail?: RegExp) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof SourceError, String(error));
    assert.equal(error.code, code);
    if (detail) assert.ok(error.details.some((d) => detail.test(d)) || detail.test(error.message), `${error.message} ${error.details.join(" | ")}`);
    return true;
  });
}

describe("fixtures are unmodified copies of teammates' files", () => {
  const recorded: Record<string, string> = {
    "divyansh/impact.json": "d32c2f463378d61e4ea79dc2ee46714d8137bd841c07a2f66e4c784b48fb5530",
    "divyansh/matrix.json": "9021cac0d3e6660e3422443ce57c5221b5f7cf25d2fbe4790bb842b1403c1fe0",
    "divyansh/ppost.json": "51211d5c8c1351552af0f5a4b06d00529564d84e31bda7a1fa79e2f2bb40f963",
    "daniel/finance_report.sample.json": "33de58d149cc3548f80a34d1386642edc95ee3306c75698866c4a2385bc22e17",
    "daniel/finance_report.schema.json": "ec81c6d5f8f20f2af7357230b028e3fa0f793a346a64434b823df49b12e6120d",
  };
  for (const [path, sha] of Object.entries(recorded))
    it(path, () => assert.equal(createHash("sha256").update(raw(path)).digest("hex"), sha));

  it("records the same hashes as provenance in the snapshot", () => {
    const s = buildPlanSnapshot(input());
    assert.deepEqual(
      s.sources.map((x) => [x.sourceId, x.fileName, x.sha256]),
      [
        ["SRC-PPOST", "ppost.json", recorded["divyansh/ppost.json"]],
        ["SRC-IMPACT", "impact.json", recorded["divyansh/impact.json"]],
        ["SRC-MATRIX", "matrix.json", recorded["divyansh/matrix.json"]],
        ["SRC-FINANCE", "finance_report.sample.json", recorded["daniel/finance_report.sample.json"]],
      ],
    );
    assert.equal(s.sources[3]?.disclaimer, DISCLAIMER);
    assert.equal(s.sources[0]?.submittedBy, "Divyansh");
  });
});

describe("finance report validation against the supplied schema", () => {
  it("accepts the sample report", () => {
    const s = buildPlanSnapshot(input());
    assert.equal(s.finance?.schemaVersion, "1.0");
    assert.equal(s.finance?.disclaimer, DISCLAIMER);
    assert.equal(s.finance?.currency, "CAD");
  });

  it("rejects a missing required field", () =>
    rejectsWith(() => buildPlanSnapshot(withFinance((r) => delete r.disclaimer)), "FINANCE_SCHEMA", /required property 'disclaimer'/));

  it("rejects an unknown top-level field (additionalProperties: false)", () =>
    rejectsWith(() => buildPlanSnapshot(withFinance((r) => (r.extra = 1))), "FINANCE_SCHEMA", /additional properties/));

  it("enforces date-time and date formats", () => {
    rejectsWith(() => buildPlanSnapshot(withFinance((r) => (r.generated_at = "yesterday"))), "FINANCE_SCHEMA", /\/generated_at: must match format "date-time"/);
    rejectsWith(
      () => buildPlanSnapshot(withFinance((r) => (r.estimates[0].prepared_date = "2026-02-30"))),
      "FINANCE_SCHEMA",
      /\/estimates\/0\/prepared_date: must match format "date"/,
    );
  });

  it("rejects an unsupported schema_version", () =>
    rejectsWith(() => buildPlanSnapshot(withFinance((r) => (r.schema_version = "2.0"))), "UNSUPPORTED_VERSION", /schema_version 2\.0/));

  it("rejects amounts that are not exact 2-decimal values instead of rounding them", () =>
    rejectsWith(() => buildPlanSnapshot(withFinance((r) => (r.funding.sources[0].amount = 0.005))), "INVALID_SOURCE", /\/funding\/sources\/0\/amount/));

  it("never echoes source values in error messages", () => {
    const secret = "SECRET-VALUE-7731";
    try {
      buildPlanSnapshot(withFinance((r) => {
        r.disclaimer = secret;
        r.generated_at = secret;
      }));
      assert.fail("expected a schema error");
    } catch (error) {
      assert.ok(error instanceof SourceError);
      assert.ok(!`${error.message} ${error.details.join(" ")}`.includes(secret));
    }
  });

  it("requires the schema with the report", () => {
    const { finance: _f, ...noFinance } = input();
    const s = buildPlanSnapshot(noFinance);
    assert.equal(s.finance, undefined);
    assert.equal(s.findings.some((f) => f.sourceIds.includes("SRC-FINANCE")), false);
  });
});

describe("team export validation", () => {
  it("rejects an unsupported file_format_version", () => {
    const ppost = json("divyansh/ppost.json");
    ppost.data.file_format_version = 2;
    rejectsWith(() => buildPlanSnapshot(input({ ppost: file("ppost.json", ppost) })), "UNSUPPORTED_VERSION", /file_format_version 2/);
  });

  it("rejects a file without the team envelope", () => {
    const ppost = json("divyansh/ppost.json");
    delete ppost.submitted_by;
    rejectsWith(() => buildPlanSnapshot(input({ ppost: file("ppost.json", ppost) })), "INVALID_SOURCE", /\/submitted_by/);
  });

  it("rejects an export passed as the wrong kind", () =>
    rejectsWith(() => buildPlanSnapshot(input({ ppost: original("divyansh/matrix.json") })), "INVALID_SOURCE", /"Recovery Matrix" export, expected "PPOST Workspace"/));

  it("rejects invalid JSON without quoting the file", () => {
    const bad: SourceFile = { fileName: "ppost.json", bytes: new TextEncoder().encode('{"event_id": SECRET-CONTENT') };
    try {
      buildPlanSnapshot(input({ ppost: bad }));
      assert.fail("expected INVALID_JSON");
    } catch (error) {
      assert.ok(error instanceof SourceError && error.code === "INVALID_JSON");
      assert.ok(!error.message.includes("SECRET-CONTENT"));
    }
  });

  it("keeps UNANSWERED separate from UNKNOWN", () => {
    const s = buildPlanSnapshot(input());
    const answers = new Map(s.assessment.answers.map((a) => [a.questionId, a.answer]));
    assert.equal(answers.get("Q-W03"), "UNKNOWN");
    assert.equal(answers.has("Q-HW01"), false, "unanswered questions have no answer entry");
    assert.ok(s.assessment.questions.some((q) => q.id === "Q-HW01"));
  });
});

describe("explicit event mapping", () => {
  it("labels an assumed mapping as requiring confirmation", () => {
    const s = buildPlanSnapshot(input());
    assert.equal(s.eventMapping?.status, "ASSUMED");
    assert.ok(s.findings.some((f) => f.code === "EVENT_MAPPING_ASSUMED" && f.status === "REQUIRES_CONFIRMATION"));
    assert.ok(s.findings.some((f) => f.code === "SOURCE_LABELS_MAPPING_ASSUMED" && /assumed_for_sample/.test(f.message)));
  });

  it("does not add the assumed-mapping finding for a confirmed mapping", () => {
    const s = buildPlanSnapshot(withMapping([{ ...assumedMapping, status: "confirmed", confirmed_by: "Earl" }]));
    assert.equal(s.eventMapping?.status, "CONFIRMED");
    assert.equal(s.findings.some((f) => f.code === "EVENT_MAPPING_ASSUMED"), false);
    // The exports still label their own mapping as assumed; that is reported separately.
    assert.ok(s.findings.some((f) => f.code === "SOURCE_LABELS_MAPPING_ASSUMED"));
  });

  it("rejects missing, duplicate, mismatched or unattributed mappings", () => {
    rejectsWith(() => buildPlanSnapshot(withMapping([{ ...assumedMapping, team_event_id: "2" }])), "EVENT_MAPPING", /no mapping for team event_id 1/);
    rejectsWith(() => buildPlanSnapshot(withMapping([assumedMapping, assumedMapping])), "EVENT_MAPPING", /2 mappings/);
    rejectsWith(() => buildPlanSnapshot(withMapping([{ ...assumedMapping, ppost_disaster_id: "EV-2026-999" }])), "EVENT_MAPPING", /PPOST exports use EV-2026-014/);
    rejectsWith(() => buildPlanSnapshot(withMapping([{ ...assumedMapping, finance_event_id: "EV-OTHER" }])), "EVENT_MAPPING", /finance report is for EV-2026-014/);
    rejectsWith(() => buildPlanSnapshot(withMapping([{ ...assumedMapping, finance_event_id: null }])), "EVENT_MAPPING", /no finance_event_id/);
    rejectsWith(() => buildPlanSnapshot(withMapping([{ ...assumedMapping, status: "confirmed" }])), "EVENT_MAPPING", /without confirmed_by/);
  });

  it("rejects exports that disagree on the event", () => {
    const impact = json("divyansh/impact.json");
    impact.event_id = 2;
    rejectsWith(() => buildPlanSnapshot(input({ impact: file("impact.json", impact) })), "EVENT_MAPPING", /disagree on the team event_id/);
  });

  it("never joins by name: a different event name is only a note", () => {
    const s = buildPlanSnapshot(withFinance((r) => (r.event.name = "Clearwater Ridge Fire 2026")));
    const note = s.findings.find((f) => f.code === "EVENT_NAME_DIFFERS");
    assert.equal(note?.status, "INFO");
    assert.match(note!.message, /Names are not used to join events/);
  });
});

describe("conflict detection", () => {
  const s = buildPlanSnapshot(input());
  const codes = (code: string) => s.findings.filter((f) => f.code === code);

  it("flags finance tactics that are not in PPOST", () => {
    const missing = codes("FINANCE_TACTIC_NOT_IN_PPOST");
    assert.deepEqual(missing.map((f) => f.recordIds), [["T-031"]]);
    assert.equal(missing[0]?.status, "REQUIRES_CONFIRMATION");
  });

  it("asks for review when titles differ, without declaring a mismatch", () => {
    const review = codes("TACTIC_DESCRIPTION_REVIEW");
    assert.deepEqual(review.map((f) => f.recordIds[0]), ["T-014", "T-020", "T-022"]);
    for (const f of review) assert.match(f.message, /Different wording does not prove different work/);
    assert.deepEqual(s.finance?.estimates.map((e) => e.ppostLink), ["REQUIRES_REVIEW", "REQUIRES_REVIEW", "REQUIRES_REVIEW"]);
  });

  it("does not flag a tactic whose titles match", () => {
    const t = buildPlanSnapshot(withFinance((r) => (r.estimates[2].title = "Open recovery support centre")));
    assert.equal(t.finance?.estimates[2]?.ppostLink, "TITLES_MATCH");
    assert.equal(t.findings.some((f) => f.code === "TACTIC_DESCRIPTION_REVIEW" && f.recordIds[0] === "T-022"), false);
  });

  it("reports competing current costs without choosing one", () => {
    const competing = codes("COMPETING_COSTS");
    assert.deepEqual(competing.map((f) => f.recordIds), [["T-014", "C-T-014-2026-10-15", "T-014:v1.1"]]);
    assert.match(competing[0]!.message, /Neither is selected/);
    const ppostCurrent = s.ppostCosts.find((c) => c.tacticId === "T-014" && c.isCurrent);
    assert.equal(ppostCurrent?.amount, "2122900");
    assert.equal(ppostCurrent?.currency, undefined, "PPOST currency is never assumed");
    assert.equal(s.finance?.estimates[0]?.total, "124077.1");
    assert.equal(s.tactics.find((t) => t.id === "T-014")?.estimateTotal, undefined, "no cost is copied onto the tactic");
  });

  it("flags future dates per source", () => {
    const future = codes("FUTURE_DATE");
    assert.deepEqual(future.map((f) => f.sourceIds), [["SRC-FINANCE"]]);
    assert.match(future[0]!.message, /9 date field\(s\).*latest: 2026-12-21T17:00:00Z at \/generated_at/);
    const later = buildPlanSnapshot(input({ asOf: "2027-01-01T00:00:00Z" }));
    assert.equal(later.findings.some((f) => f.code === "FUTURE_DATE"), false);
  });

  it("flags a PPOST current-cost pointer with no cost entry", () => {
    const ppost = json("divyansh/ppost.json");
    ppost.data.tactics.find((t: any) => t.id === "T-001").finance.current_cost_entry_id = "C-MISSING";
    const t = buildPlanSnapshot(input({ ppost: file("ppost.json", ppost) }));
    assert.ok(t.findings.some((f) => f.code === "PPOST_COST_POINTER_MISSING" && f.recordIds[0] === "T-001"));
  });

  it("does not modify the teammates' data", () => {
    const before = raw("daniel/finance_report.sample.json").toString("utf8");
    buildPlanSnapshot(input());
    assert.equal(raw("daniel/finance_report.sample.json").toString("utf8"), before);
  });

  it("keeps the plan synthetic when any source is synthetic", () => {
    const ppost = json("divyansh/ppost.json");
    ppost.data.sample_data = false;
    const t = buildPlanSnapshot(input({ ppost: file("ppost.json", ppost) }));
    assert.equal(t.isSynthetic, true);
  });
});

describe("financial reconciliation in exact cents", () => {
  const report = (): FinanceReport => json("daniel/finance_report.sample.json");

  it("finds every derived figure in the sample consistent", () => {
    const checks = reconcileFinanceReport(report());
    assert.equal(checks.length, 59);
    assert.deepEqual(checks.filter((c) => !c.matches), []);
  });

  it("reports a one-cent discrepancy and keeps the supplied figure", () => {
    const s = buildPlanSnapshot(withFinance((r) => (r.summary.requirement = 402127.11)));
    const mismatch = s.findings.filter((f) => f.code === "RECONCILIATION_MISMATCH");
    assert.ok(mismatch.some((f) => /Requirement = sum of current estimates \(\/summary\/requirement\): supplied 402127\.11, recomputed 402127\.10/.test(f.message)));
    assert.equal(s.finance?.summary.requirement, "402127.11", "the supplied figure is not replaced");
    assert.ok(s.finance!.reconciliation.mismatches >= 1);
  });

  it("checks percentage lines against the running subtotal", () => {
    const checks = reconcileFinanceReport({ ...report(), estimates: [{ ...report().estimates[0]!, lines: report().estimates[0]!.lines.map((l) => (l.position === 8 ? { ...l, total_cost: 28633.17 } : l)) }] });
    assert.ok(checks.some((c) => !c.matches && /line 8 \(30% of running subtotal\)/.test(c.label) && c.recomputed === "28633.18"));
  });

  it("does not count cost history, funding splits or lifecycle stages as extra cost", () => {
    const r = report();
    const requirement = reconcileFinanceReport(r).find((c) => c.path === "/summary/requirement");
    // 402,127.10 is the three current estimates only; the archived v1.0 (92,300) is history.
    assert.equal(requirement?.recomputed, "402127.10");
    assert.ok(r.cost_history.some((h) => h.total === 92300));
    const realistic = reconcileFinanceReport(r).find((c) => c.path === "/summary/realistic_funding");
    // Approved 135,000 + requested-and-likely 200,000; requested-but-unlikely FS-05 (15,000) is excluded.
    assert.equal(realistic?.recomputed, "335000.00");
  });

  it("uses exact integer cents", () => {
    assert.equal(toCents(124077.1), 12407710n);
    assert.equal(toCents(0.1 + 0.2), null, "0.30000000000000004 is not an exact 2-decimal amount");
    assert.equal(formatCents(toCents(0.1)! + toCents(0.2)!), "0.30");
    assert.equal(percentOf(9544392n, 30), 2863318n, "30% of 95,443.92 = 28,633.176 → 28,633.18 (half up)");
    assert.equal(formatCents(-123n), "-1.23");
  });
});

describe("plan assembly from source exports", () => {
  const snapshot = buildPlanSnapshot(input());
  const draft: RecoveryPlanDraft = assembleRecoveryPlanDraft(snapshot, buildMockNarrative(snapshot));
  const section = (key: string) => draft.sections.find((s) => s.key === key)!;
  const fields = (key: string) => section(key).items.filter((i): i is PlanField => i.type === "FIELD");
  const records = (key: string) => section(key).items.filter((i): i is PlanRecord => i.type === "RECORD");

  it("adds costs/funding and provenance sections under the v2 provisional structure", () => {
    assert.equal(draft.structure.id, "provisional-v2");
    assert.deepEqual(draft.sections.map((s) => s.key), [
      "DOCUMENT_CONTROL", "EXECUTIVE_SUMMARY", "EVENT_OVERVIEW", "IMPACT_ASSESSMENT", "RECOVERY_PRIORITIES", "PPOST_CHAINS",
      "RESOURCES_AND_BUDGET", "COSTS_AND_FUNDING", "GAPS_AND_CONFIRMATIONS", "RECOMMENDED_NEXT_STEPS", "SOURCE_PROVENANCE", "SOURCE_RECORD_INDEX",
    ]);
    assert.equal(draft.isSynthetic, true);
  });

  it("shows Daniel's disclaimer verbatim and the assumed mapping as requiring confirmation", () => {
    const control = fields("DOCUMENT_CONTROL");
    assert.equal(control.find((f) => f.label === "Finance disclaimer")?.value, DISCLAIMER);
    const mapping = control.find((f) => f.label === "Event mapping");
    assert.equal(mapping?.status, "REQUIRES_CONFIRMATION");
    assert.match(mapping!.value!, /assumed, not confirmed/);
    assert.equal(fields("COSTS_AND_FUNDING").find((f) => f.label === "Finance disclaimer")?.value, DISCLAIMER);
  });

  it("keeps approved, requested and likely funding separate and labels non-additive figures", () => {
    const f = new Map(fields("COSTS_AND_FUNDING").map((x) => [x.label, x.value]));
    assert.equal(f.get("Approved funding (confirmed)"), "135,000.00 CAD");
    assert.equal(f.get("Requested funding (not yet approved)"), "215,000.00 CAD");
    assert.equal(f.get("Requested funding marked likely"), "200,000.00 CAD");
    assert.equal(f.get("Requirement (sum of current estimates)"), "402,127.10 CAD");
    assert.match(f.get("Funding split: government (70%)")!, /not additional funding/);
    assert.ok([...f.keys()].some((k) => /cost history .*history only, not added/.test(k)));
    assert.ok([...f.keys()].some((k) => /same money at successive stages/.test(k)));
  });

  it("shows both T-014 costs, flags the link, and adds no costs to the resources section", () => {
    const estimate = records("COSTS_AND_FUNDING").find((r) => r.recordId === "T-014:v1.1")!;
    assert.equal(estimate.fields.find((f) => f.label === "PPOST tactic")?.status, "REQUIRES_CONFIRMATION");
    assert.equal(estimate.fields.find((f) => f.label === "Current estimate")?.value, "124,077.10 CAD");
    const ppost = records("COSTS_AND_FUNDING").find((r) => r.recordId === "C-T-014-2026-10-15")!;
    assert.equal(ppost.fields.find((f) => f.label === "Amount")?.value, "2,122,900.00 (currency not provided)");
    for (const r of records("RESOURCES_AND_BUDGET")) assert.equal(r.fields.some((f) => f.label === "Class D estimate"), false);
  });

  it("lists every finding that requires confirmation under gaps, and notes under provenance", () => {
    const open = snapshot.findings.filter((f) => f.status === "REQUIRES_CONFIRMATION");
    const gapLabels = fields("GAPS_AND_CONFIRMATIONS").map((f) => f.label);
    for (const f of open) assert.ok(gapLabels.some((l) => l.startsWith(`Source finding ${f.id} `)), f.id);
    const notes = fields("SOURCE_PROVENANCE").map((f) => f.label);
    for (const f of snapshot.findings.filter((x) => x.status === "INFO")) assert.ok(notes.some((l) => l.startsWith(`Note ${f.id} `)), f.id);
    assert.equal(records("SOURCE_PROVENANCE").length, 4);
  });
});
