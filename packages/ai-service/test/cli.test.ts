import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runCli } from "../src/cli.ts";

const DIR = fileURLToPath(new URL("./fixtures/shared-data/", import.meta.url));
const AS_OF = "2026-11-19T20:00:00Z";
const tmp = mkdtempSync(join(tmpdir(), "ppost-cli-test-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

/** Runs the CLI with real file reads, piped stdin and captured output. */
async function cli(argv: string[], stdin = "") {
  let stdout = "";
  let stderr = "";
  const written = new Map<string, Uint8Array>();
  const code = await runCli(argv, {
    readFile: (p) => readFileSync(p),
    readStdin: () => new TextEncoder().encode(stdin),
    writeNewFile: (p, bytes) => {
      writeFileSync(p, bytes, { flag: "wx" });
      written.set(p, bytes);
    },
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
    now: () => "2026-11-19T21:00:00.000Z",
  });
  return { code, stdout, stderr, written };
}

const buildArgs = (extra: string[] = []) => [
  "build-snapshot",
  "--mapping", join(DIR, "event-mapping.assumed.json"),
  "--ppost", join(DIR, "divyansh/ppost.json"),
  "--impact", join(DIR, "divyansh/impact.json"),
  "--matrix", join(DIR, "divyansh/matrix.json"),
  "--finance", join(DIR, "daniel/finance_report.sample.json"),
  "--finance-schema", join(DIR, "daniel/finance_report.schema.json"),
  "--captured-at", AS_OF,
  "--as-of", AS_OF,
  ...extra,
];

// Distinctive source contents that must never reach stderr.
const SOURCE_SNIPPETS = [
  "Planning and tracking only",
  "Install interim modular housing",
  "Debris removal - Highway 5",
  "Geotechnical engineers",
];
const assertNoSourceContent = (text: string) => {
  for (const s of SOURCE_SNIPPETS) assert.ok(!text.includes(s), `stderr leaked source content: ${s}`);
};

describe("ppost-plan CLI: complete mock pipeline", async () => {
  const built = await cli(buildArgs());
  const drafted = await cli(["generate-plan-draft", "--mock"], built.stdout);
  const out = join(tmp, "preview.docx");
  const rendered = await cli(["render-docx", "--simulated-approval", "--out", out, "--approved-at", "2026-11-19T20:30:00Z"], drafted.stdout);

  it("builds a snapshot as JSON on stdout", () => {
    assert.equal(built.code, 0, built.stderr);
    const result = JSON.parse(built.stdout);
    assert.equal(result.kind, "plan-snapshot");
    assert.equal(result.snapshot.isSynthetic, true);
    assert.equal(result.snapshot.findings.filter((f: any) => f.status === "REQUIRES_CONFIRMATION").length, 8);
    assert.match(built.stderr, /4 source file\(s\), 11 finding\(s\), 8 requiring confirmation/);
  });

  it("generates a mock draft through the real pipeline", () => {
    assert.equal(drafted.code, 0, drafted.stderr);
    const result = JSON.parse(drafted.stdout);
    assert.equal(result.kind, "plan-draft");
    assert.equal(result.mock, true);
    assert.match(result.draftId, /^mock-[0-9a-f]{12}$/);
    assert.equal(result.draft.structure.id, "provisional-v2");
    const ai = result.draft.sections.flatMap((s: any) => s.items).filter((i: any) => i.type === "AI_RECOMMENDATION");
    assert.ok(ai.length > 0);
    for (const item of ai) assert.match(item.text, /^MOCK NARRATIVE \(no AI model was used\):/);
    assert.match(drafted.stderr, /no AI model was called/);
  });

  it("renders a DOCX with simulated approval and reports it as JSON", () => {
    assert.equal(rendered.code, 0, rendered.stderr);
    const result = JSON.parse(rendered.stdout);
    assert.equal(result.kind, "docx");
    assert.equal(result.approval, "SIMULATED");
    assert.equal(result.path, out);
    assert.match(result.suggestedFilename, /^SYNTHETIC-DEMO_Initial-Recovery-Plan_EV-2026-014_mock-[0-9a-f]{12}\.docx$/);
    const bytes = readFileSync(out);
    assert.equal(bytes.byteLength, result.bytes);
    assert.equal(bytes.subarray(0, 2).toString("latin1"), "PK", "a DOCX is a ZIP package");
  });

  it("keeps stdout machine-readable and source contents off stderr", () => {
    for (const r of [built, drafted, rendered]) {
      assert.doesNotThrow(() => JSON.parse(r.stdout));
      assert.equal(r.stdout.trim().split("\n").length, 1);
      assertNoSourceContent(r.stderr);
    }
  });

  it("is deterministic for the same inputs", async () => {
    const again = await cli(["generate-plan-draft", "--mock"], (await cli(buildArgs())).stdout);
    assert.equal(JSON.parse(again.stdout).draftId, JSON.parse(drafted.stdout).draftId);
  });

  it("never overwrites an existing file", async () => {
    const second = await cli(["render-docx", "--simulated-approval", "--out", out], drafted.stdout);
    assert.equal(second.code, 2);
    assert.match(second.stderr, /already exists/);
    assert.equal(second.stdout, "");
  });
});

describe("ppost-plan CLI: guards", () => {
  it("refuses to render without --simulated-approval", async () => {
    const drafted = await cli(["generate-plan-draft", "--mock"], (await cli(buildArgs())).stdout);
    const out = join(tmp, "unapproved.docx");
    const r = await cli(["render-docx", "--out", out], drafted.stdout);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /requires --simulated-approval.*real approval happens in the backend review workflow/);
    assert.equal(r.written.size, 0);
    assert.equal(r.stdout, "");
  });

  it("refuses real generation", async () => {
    const r = await cli(["generate-plan-draft"], (await cli(buildArgs())).stdout);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /requires --mock\. This CLI never calls a real AI model/);
  });

  it("requires the finance schema with the finance report", async () => {
    const args = buildArgs().filter((a, i, all) => a !== "--finance-schema" && all[i - 1] !== "--finance-schema");
    const r = await cli(args);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /--finance and --finance-schema must be given together/);
  });

  it("reports validation failures with paths only", async () => {
    const report = JSON.parse(readFileSync(join(DIR, "daniel/finance_report.sample.json"), "utf8"));
    report.generated_at = "Planning and tracking only";
    const bad = join(tmp, "finance_bad.json");
    writeFileSync(bad, JSON.stringify(report));
    const args = buildArgs();
    args[args.indexOf("--finance") + 1] = bad;
    const r = await cli(args);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /error \[FINANCE_SCHEMA\]/);
    assert.match(r.stderr, /\/generated_at: must match format "date-time"/);
    assertNoSourceContent(r.stderr);
  });

  it("rejects unknown commands, unknown flags, missing files and invalid snapshots", async () => {
    assert.equal((await cli(["publish"])).code, 2);
    assert.equal((await cli([...buildArgs(), "--approve"])).code, 2);
    const missing = await cli(["build-snapshot", "--mapping", join(tmp, "nope.json"), "--ppost", "x", "--impact", "y"]);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /file not found/);
    const invalid = await cli(["generate-plan-draft", "--mock"], JSON.stringify({ kind: "plan-snapshot", snapshot: { capturedAt: "x" } }));
    assert.equal(invalid.code, 2);
    assert.match(invalid.stderr, /not a valid plan snapshot/);
  });
});
