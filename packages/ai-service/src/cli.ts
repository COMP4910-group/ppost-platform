#!/usr/bin/env node
/**
 * ppost-plan — offline pipeline from teammates' JSON exports to a reviewable
 * Initial Recovery Plan draft and a DOCX preview.
 *
 *   ppost-plan build-snapshot --mapping <file> --ppost <file> --impact <file>
 *                             [--matrix <file>] [--finance <file> --finance-schema <file>]
 *                             [--captured-at <iso>] [--as-of <iso>]
 *   ppost-plan generate-plan-draft --mock [--snapshot <file>|-]
 *   ppost-plan render-docx --simulated-approval --out <file> [--draft <file>|-] [--approved-at <iso>]
 *
 * stdout carries only JSON results; diagnostics go to stderr and never include
 * source contents. Exit codes: 0 ok, 2 invalid input or usage, 1 unexpected.
 *
 * --simulated-approval exists for demos and team previews only. It is not an
 * approval and must never be treated as production authorization: real
 * approval belongs to the authenticated backend review workflow.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { recoveryPlanDocxFilename, renderRecoveryPlanDocx } from "@ppost/plan-document";
import { z } from "zod";
import { ProposalGenerationError } from "./errors.ts";
import { createMockClient } from "./mock/mockClient.ts";
import { RecoveryPlanDraftSchema } from "./plan/draftSchema.ts";
import { generateRecoveryPlanDraft } from "./plan/generateRecoveryPlanDraft.ts";
import { buildMockNarrative } from "./plan/mockNarrative.ts";
import { PlanSourceSnapshotSchema } from "./plan/snapshotSchema.ts";
import { type SourceFile, SourceError, issuePaths } from "./sources/common.ts";
import { buildPlanSnapshot } from "./sources/buildSnapshot.ts";

export class UsageError extends Error {}

interface Io {
  readFile(path: string): Uint8Array;
  readStdin(): Uint8Array;
  writeNewFile(path: string, bytes: Uint8Array): void;
  stdout(text: string): void;
  stderr(text: string): void;
  now(): string;
}

const nodeIo: Io = {
  readFile: (path) => readFileSync(path),
  readStdin: () => readFileSync(0),
  // "wx": never overwrite an existing file.
  writeNewFile: (path, bytes) => writeFileSync(path, bytes, { flag: "wx" }),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  now: () => new Date().toISOString(),
};

const sourceFile = (io: Io, path: string): SourceFile => ({ fileName: basename(path), bytes: io.readFile(path) });
const readJson = (io: Io, path: string | undefined, what: string): unknown => {
  const bytes = !path || path === "-" ? io.readStdin() : io.readFile(path);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new UsageError(`${what} is not valid JSON.`);
  }
};
const isoOrNow = (io: Io, value: string | undefined, flag: string) => {
  if (value === undefined) return io.now();
  if (Number.isNaN(Date.parse(value))) throw new UsageError(`${flag} must be an ISO date-time.`);
  return value;
};

const DraftResultSchema = z.object({
  kind: z.literal("plan-draft"),
  mock: z.boolean(),
  draftId: z.string().min(1),
  draft: RecoveryPlanDraftSchema,
});

async function buildSnapshotCommand(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      mapping: { type: "string" }, ppost: { type: "string" }, impact: { type: "string" }, matrix: { type: "string" },
      finance: { type: "string" }, "finance-schema": { type: "string" }, "captured-at": { type: "string" }, "as-of": { type: "string" },
    },
  });
  for (const flag of ["mapping", "ppost", "impact"] as const)
    if (!values[flag]) throw new UsageError(`build-snapshot requires --${flag} <file>.`);
  if (Boolean(values.finance) !== Boolean(values["finance-schema"]))
    throw new UsageError("--finance and --finance-schema must be given together: the report is validated against its supplied schema.");

  const snapshot = buildPlanSnapshot({
    mapping: sourceFile(io, values.mapping!),
    ppost: sourceFile(io, values.ppost!),
    impact: sourceFile(io, values.impact!),
    ...(values.matrix ? { matrix: sourceFile(io, values.matrix) } : {}),
    ...(values.finance ? { finance: { report: sourceFile(io, values.finance), schema: sourceFile(io, values["finance-schema"]!) } } : {}),
    capturedAt: isoOrNow(io, values["captured-at"], "--captured-at"),
    asOf: isoOrNow(io, values["as-of"], "--as-of"),
  });
  const open = snapshot.findings.filter((f) => f.status === "REQUIRES_CONFIRMATION").length;
  io.stderr(`build-snapshot: ${snapshot.sources.length} source file(s), ${snapshot.findings.length} finding(s), ${open} requiring confirmation.\n`);
  return { kind: "plan-snapshot", snapshot };
}

async function generateDraftCommand(args: string[], io: Io) {
  const { values } = parseArgs({ args, strict: true, options: { mock: { type: "boolean" }, snapshot: { type: "string" } } });
  if (!values.mock)
    throw new UsageError("generate-plan-draft requires --mock. This CLI never calls a real AI model; real generation runs in the backend.");
  const input = readJson(io, values.snapshot, "The snapshot");
  const parsed = z.object({ kind: z.literal("plan-snapshot"), snapshot: z.unknown() }).safeParse(input);
  const snapshot = PlanSourceSnapshotSchema.safeParse(parsed.success ? parsed.data.snapshot : input);
  if (!snapshot.success) throw new SourceError("INVALID_SOURCE", "snapshot", "is not a valid plan snapshot.", issuePaths(snapshot.error.issues));

  // The mock narrative goes through the real pipeline, including source-ID validation.
  const { draft, promptVersion } = await generateRecoveryPlanDraft(snapshot.data, {
    client: createMockClient(buildMockNarrative(snapshot.data)),
  });
  const draftId = `mock-${createHash("sha256").update(JSON.stringify(draft)).digest("hex").slice(0, 12)}`;
  io.stderr(`generate-plan-draft: mock draft ${draftId} (no AI model was called).\n`);
  return { kind: "plan-draft", mock: true, draftId, promptVersion, draft };
}

async function renderDocxCommand(args: string[], io: Io) {
  const { values } = parseArgs({
    args,
    strict: true,
    options: { draft: { type: "string" }, out: { type: "string" }, "simulated-approval": { type: "boolean" }, "approved-at": { type: "string" } },
  });
  if (!values["simulated-approval"])
    throw new UsageError(
      "render-docx requires --simulated-approval. It only renders demo previews; real approval happens in the backend review workflow.",
    );
  if (!values.out) throw new UsageError("render-docx requires --out <file>.");
  const parsed = DraftResultSchema.safeParse(readJson(io, values.draft, "The draft"));
  if (!parsed.success) throw new SourceError("INVALID_SOURCE", "draft", "is not a plan-draft result.", issuePaths(parsed.error.issues));

  const options = {
    draftId: parsed.data.draftId,
    approval: { kind: "SIMULATED" as const, approvedAt: isoOrNow(io, values["approved-at"], "--approved-at") },
  };
  const bytes = new Uint8Array(await renderRecoveryPlanDocx(parsed.data.draft, options));
  try {
    io.writeNewFile(values.out, bytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new UsageError(`${values.out} already exists; choose a new --out path.`);
    throw error;
  }
  io.stderr(`render-docx: wrote ${bytes.byteLength} bytes (simulated approval).\n`);
  return {
    kind: "docx",
    path: values.out,
    suggestedFilename: recoveryPlanDocxFilename(parsed.data.draft, options),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    approval: "SIMULATED",
    draftId: parsed.data.draftId,
  };
}

const COMMANDS: Record<string, (args: string[], io: Io) => Promise<unknown>> = {
  "build-snapshot": buildSnapshotCommand,
  "generate-plan-draft": generateDraftCommand,
  "render-docx": renderDocxCommand,
};

/** Runs one command; returns the process exit code. */
export async function runCli(argv: string[], io: Io = nodeIo): Promise<number> {
  const [command, ...args] = argv;
  try {
    const run = command ? COMMANDS[command] : undefined;
    if (!run) throw new UsageError(`Unknown command${command ? ` "${command}"` : ""}. Use one of: ${Object.keys(COMMANDS).join(", ")}.`);
    io.stdout(JSON.stringify(await run(args, io)) + "\n");
    return 0;
  } catch (error) {
    if (error instanceof SourceError) {
      io.stderr(`error [${error.code}]: ${error.message}\n${error.details.map((d) => `  ${d}\n`).join("")}`);
      return 2;
    }
    if (error instanceof ProposalGenerationError) {
      io.stderr(`error [${error.code}]: ${error.message}\n`);
      return 2;
    }
    if (error instanceof UsageError || (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")) {
      io.stderr(`error: ${(error as Error).message}\n`);
      return 2;
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      io.stderr(`error: file not found: ${(error as NodeJS.ErrnoException).path ?? "(unknown)"}\n`);
      return 2;
    }
    io.stderr(`error: unexpected failure (${error instanceof Error ? error.name : "unknown"}).\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runCli(process.argv.slice(2));
