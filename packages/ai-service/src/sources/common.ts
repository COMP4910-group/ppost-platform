import { createHash } from "node:crypto";

export type SourceErrorCode =
  | "INVALID_JSON"
  | "INVALID_SOURCE"
  | "UNSUPPORTED_VERSION"
  | "EVENT_MAPPING"
  | "FINANCE_SCHEMA";

/**
 * A source file could not be used. `details` holds field paths and rule
 * messages only — never source contents — so it is safe to log.
 */
export class SourceError extends Error {
  readonly code: SourceErrorCode;
  readonly fileName: string;
  readonly details: string[];

  constructor(code: SourceErrorCode, fileName: string, message: string, details: string[] = []) {
    super(`${fileName}: ${message}`);
    this.name = "SourceError";
    this.code = code;
    this.fileName = fileName;
    this.details = details;
  }
}

/** One source file exactly as read from disk (or storage). */
export interface SourceFile {
  /** Display name only (never used as a path), e.g. "ppost.json". */
  fileName: string;
  bytes: Uint8Array;
}

export interface ParsedSource {
  fileName: string;
  sha256: string;
  bytes: number;
  json: unknown;
}

/** Hashes the exact bytes and parses UTF-8 JSON without echoing content in errors. */
export function parseSourceFile(file: SourceFile): ParsedSource {
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch {
    throw new SourceError("INVALID_JSON", file.fileName, "is not valid UTF-8 text.");
  }
  try {
    return { fileName: file.fileName, sha256, bytes: file.bytes.byteLength, json: JSON.parse(text) };
  } catch {
    // The engine's SyntaxError message can quote file content; do not propagate it.
    throw new SourceError("INVALID_JSON", file.fileName, "is not valid JSON.");
  }
}

/** Zod issues as "path: message" strings (no input values). */
export function issuePaths(issues: { path: PropertyKey[]; message: string }[]): string[] {
  return issues.map((i) => `${i.path.length ? "/" + i.path.map(String).join("/") : "(root)"}: ${i.message}`);
}

// ---------------------------------------------------------------------------
// Money: exact integer cents. JSON numbers are converted through their
// shortest decimal form, which reproduces the supplied text for amounts with
// at most 15 significant digits; anything else is reported, never rounded.
// ---------------------------------------------------------------------------

export type Cents = bigint;

const MONEY_RE = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** Exact cents for a supplied amount, or null if it is not an exact 2-decimal value. */
export function toCents(value: number): Cents | null {
  if (!Number.isFinite(value)) return null;
  const text = String(value);
  const m = MONEY_RE.exec(text);
  if (!m || text.replace(/[-.]/g, "").replace(/^0+/, "").length > 15) return null;
  const cents = BigInt(m[2]!) * 100n + BigInt(((m[3] ?? "") + "00").slice(0, 2));
  return m[1] === "-" ? -cents : cents;
}

/** The supplied amount as a decimal string ("124077.1" stays "124077.1"), or null if not exact. */
export function moneyText(value: number): string | null {
  return toCents(value) === null ? null : String(value);
}

export function formatCents(cents: Cents): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

/** pct% of base, rounded half away from zero to the cent. pct may have up to 2 decimals. */
export function percentOf(base: Cents, pct: number): Cents | null {
  const p = toCents(pct); // pct in hundredths
  if (p === null) return null;
  const product = base * p; // base cents × pct hundredths → divide by 10_000
  const half = product >= 0n ? 5_000n : -5_000n;
  return (product + half) / 10_000n;
}
