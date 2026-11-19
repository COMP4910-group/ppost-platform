import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { type ParsedSource, SourceError, moneyText } from "./common.ts";

/** Finance report versions this adapter understands (top-level schema_version). */
export const SUPPORTED_FINANCE_SCHEMA_VERSIONS = ["1.0"] as const;
export const FINANCE_SOURCE_ID = "SRC-FINANCE";

// ajv and ajv-formats are CommonJS; normalise their default exports under ESM.
const Ajv2020 = ((Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module) as typeof Ajv2020Module.default;
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule) as typeof addFormatsModule.default;

/** The finance report shape after schema validation (only the fields this adapter reads). */
export interface FinanceReport {
  report_type: string;
  schema_version: string;
  generated_at: string;
  generated_by?: string;
  synthetic: boolean;
  disclaimer: string;
  currency: string;
  event: { id: string; name: string; hazard?: string; location?: string; declared_at?: string };
  summary: {
    requirement: number; finalized: number; draft: number;
    approved_funding: number; requested_funding: number; likely_funding: number; realistic_funding: number;
    gap: number; coverage_pct: number;
    committed: number; spent: number; claimed: number; reimbursed: number;
    tactics_estimated: number; tactics_needing_estimate: string[];
  };
  estimates: {
    tactic_id: string; title: string; revision: string; code: string; status: string; estimate_class: string;
    accuracy_low_pct: number; accuracy_high_pct: number; direct_total: number; total: number; low: number; high: number;
    by_category: Record<string, number>;
    prepared_by?: string | null; prepared_date?: string | null; reviewed_by?: string | null; reviewed_at?: string | null;
    lines: { position: number; description: string; pricing: string; quantity: number | null; unit_rate: number | null; duration: number | null; percent: number | null; total_cost: number }[];
    basis?: { scope_description?: string };
  }[];
  cost_history: { tactic_id: string; revision: string; status: string; total: number; at: string; by?: string | null; reason?: string | null }[];
  funding: {
    mix: Record<string, number>;
    mix_amounts: Record<string, number>;
    sources: { code: string; name: string; status: string; confirmed: boolean; likely: boolean; amount: number; mix_group: string; tactic_ids: string[]; document_ids?: string[] }[];
    requests: { code: string; title: string; funding_source_code: string; amount: number; status: string; sent_at?: string | null; document_id?: string | null }[];
  };
  financial_entries: { code: string; tactic_id: string; stage: string; amount: number; entry_date: string; reference?: string | null; document_ids?: string[]; created_at?: string }[];
  lifecycle_by_tactic: {
    tactic_id: string; current_stage: string; approved_budget?: number | null;
    committed: number; spent: number; claimed: number; reimbursed: number; remaining_budget?: number | null; variance_status?: string | null;
  }[];
}

export interface FinanceMeta {
  fileName: string;
  sha256: string;
  bytes: number;
  schemaFileName: string;
  schemaSha256: string;
  schemaVersion: string;
  generatedAt: string;
  generatedBy?: string;
  synthetic: boolean;
  disclaimer: string;
  currency: string;
  eventId: string;
  eventName: string;
}

/**
 * Validates the report against the schema Daniel supplied (draft 2020-12,
 * formats enforced) and checks the schema_version is one we support.
 * Messages carry JSON pointers and rule names only, never values.
 */
export function validateFinanceReport(report: ParsedSource, schema: ParsedSource): { meta: FinanceMeta; report: FinanceReport } {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  let validate;
  try {
    validate = ajv.compile(schema.json as object);
  } catch (error) {
    throw new SourceError("FINANCE_SCHEMA", schema.fileName, "is not a usable JSON Schema.", [
      error instanceof Error ? error.message.split("\n")[0]! : "compile failed",
    ]);
  }
  if (!validate(report.json)) {
    throw new SourceError(
      "FINANCE_SCHEMA",
      report.fileName,
      `does not match ${schema.fileName}.`,
      (validate.errors ?? []).map((e) => `${e.instancePath || "(root)"}: ${e.message ?? e.keyword}`),
    );
  }
  const r = report.json as FinanceReport;
  if (r.report_type !== "finance_report")
    throw new SourceError("INVALID_SOURCE", report.fileName, `has report_type "${r.report_type}", expected "finance_report".`);
  if (!(SUPPORTED_FINANCE_SCHEMA_VERSIONS as readonly string[]).includes(r.schema_version))
    throw new SourceError(
      "UNSUPPORTED_VERSION",
      report.fileName,
      `has schema_version ${r.schema_version}; supported: ${SUPPORTED_FINANCE_SCHEMA_VERSIONS.join(", ")}.`,
    );

  const unmatchedMix = Object.keys(r.funding.mix)
    .map((k) => k.replace(/_pct$/, ""))
    .filter((group) => typeof r.funding.mix_amounts[group] !== "number");
  if (unmatchedMix.length > 0)
    throw new SourceError(
      "INVALID_SOURCE",
      report.fileName,
      "has funding mix percentages without matching amounts.",
      unmatchedMix.map((g) => `/funding/mix_amounts/${g}: missing`),
    );

  const inexact = moneyPaths(r).filter(([, v]) => moneyText(v) === null).map(([path]) => path);
  if (inexact.length > 0)
    throw new SourceError("INVALID_SOURCE", report.fileName, "has amounts that are not exact 2-decimal values.", inexact);

  return {
    report: r,
    meta: {
      fileName: report.fileName,
      sha256: report.sha256,
      bytes: report.bytes,
      schemaFileName: schema.fileName,
      schemaSha256: schema.sha256,
      schemaVersion: r.schema_version,
      generatedAt: r.generated_at,
      ...(r.generated_by ? { generatedBy: r.generated_by } : {}),
      synthetic: r.synthetic,
      disclaimer: r.disclaimer,
      currency: r.currency,
      eventId: r.event.id,
      eventName: r.event.name,
    },
  };
}

/** Every monetary field in the report, as [JSON pointer, value]. */
export function moneyPaths(r: FinanceReport): [string, number][] {
  const s = r.summary;
  return [
    ...(["requirement", "finalized", "draft", "approved_funding", "requested_funding", "likely_funding", "realistic_funding", "gap", "committed", "spent", "claimed", "reimbursed"] as const).map(
      (k): [string, number] => [`/summary/${k}`, s[k]],
    ),
    ...r.estimates.flatMap((e, i) => [
      ...(["direct_total", "total", "low", "high"] as const).map((k): [string, number] => [`/estimates/${i}/${k}`, e[k]]),
      ...Object.entries(e.by_category).map(([k, v]): [string, number] => [`/estimates/${i}/by_category/${k}`, v]),
      ...e.lines.map((l, j): [string, number] => [`/estimates/${i}/lines/${j}/total_cost`, l.total_cost]),
    ]),
    ...r.cost_history.map((h, i): [string, number] => [`/cost_history/${i}/total`, h.total]),
    ...Object.entries(r.funding.mix_amounts).map(([k, v]): [string, number] => [`/funding/mix_amounts/${k}`, v]),
    ...r.funding.sources.map((f, i): [string, number] => [`/funding/sources/${i}/amount`, f.amount]),
    ...r.funding.requests.map((f, i): [string, number] => [`/funding/requests/${i}/amount`, f.amount]),
    ...r.financial_entries.map((f, i): [string, number] => [`/financial_entries/${i}/amount`, f.amount]),
    ...r.lifecycle_by_tactic.flatMap((l, i) =>
      (["approved_budget", "committed", "spent", "claimed", "reimbursed", "remaining_budget"] as const)
        .filter((k) => typeof l[k] === "number")
        .map((k): [string, number] => [`/lifecycle_by_tactic/${i}/${k}`, l[k] as number]),
    ),
  ];
}

/** Every date-like field in the report, for future-date checks. */
export function financeDates(r: FinanceReport): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [{ path: "/generated_at", value: r.generated_at }];
  const add = (path: string, value: string | null | undefined) => {
    if (value) out.push({ path, value });
  };
  add("/event/declared_at", r.event.declared_at);
  r.estimates.forEach((e, i) => {
    add(`/estimates/${i}/prepared_date`, e.prepared_date);
    add(`/estimates/${i}/reviewed_at`, e.reviewed_at);
  });
  r.cost_history.forEach((h, i) => add(`/cost_history/${i}/at`, h.at));
  r.funding.requests.forEach((q, i) => add(`/funding/requests/${i}/sent_at`, q.sent_at));
  r.financial_entries.forEach((f, i) => {
    add(`/financial_entries/${i}/entry_date`, f.entry_date);
    add(`/financial_entries/${i}/created_at`, f.created_at);
  });
  return out;
}

const m = (v: number) => moneyText(v)!; // exactness checked in validateFinanceReport
const opt = <T>(v: T | null | undefined) => (v === null || v === undefined || v === "" ? undefined : v);

/** Supplied figures, reproduced exactly; tactic links are added by buildSnapshot. */
export function adaptFinanceReport(r: FinanceReport) {
  const s = r.summary;
  return {
    sourceId: FINANCE_SOURCE_ID,
    schemaVersion: r.schema_version,
    currency: r.currency,
    disclaimer: r.disclaimer,
    summary: {
      requirement: m(s.requirement), finalized: m(s.finalized), notYetApproved: m(s.draft),
      approvedFunding: m(s.approved_funding), requestedFunding: m(s.requested_funding),
      likelyFunding: m(s.likely_funding), realisticFunding: m(s.realistic_funding),
      gap: m(s.gap), coveragePct: String(s.coverage_pct),
      committed: m(s.committed), spent: m(s.spent), claimed: m(s.claimed), reimbursed: m(s.reimbursed),
      tacticsEstimated: s.tactics_estimated, tacticsNeedingEstimate: s.tactics_needing_estimate,
    },
    estimates: r.estimates.map((e) => ({
      code: e.code, tacticId: e.tactic_id, title: e.title, revision: e.revision, status: e.status, estimateClass: e.estimate_class,
      total: m(e.total), low: m(e.low), high: m(e.high), accuracyLowPct: e.accuracy_low_pct, accuracyHighPct: e.accuracy_high_pct,
      ...(opt(e.prepared_by) ? { preparedBy: e.prepared_by! } : {}),
      ...(opt(e.prepared_date) ? { preparedDate: e.prepared_date! } : {}),
      ...(opt(e.reviewed_by) ? { reviewedBy: e.reviewed_by! } : {}),
      ...(opt(e.basis?.scope_description) ? { scopeDescription: e.basis!.scope_description! } : {}),
    })),
    costHistory: r.cost_history.map((h) => ({
      tacticId: h.tactic_id, revision: h.revision, status: h.status, total: m(h.total), at: h.at,
      ...(opt(h.by) ? { by: h.by! } : {}), ...(opt(h.reason) ? { reason: h.reason! } : {}),
    })),
    fundingSources: r.funding.sources.map((f) => ({
      code: f.code, name: f.name, status: f.status, confirmed: f.confirmed, likely: f.likely, amount: m(f.amount), mixGroup: f.mix_group, tacticIds: f.tactic_ids,
    })),
    fundingRequests: r.funding.requests.map((q) => ({
      code: q.code, title: q.title, fundingSourceCode: q.funding_source_code, amount: m(q.amount), status: q.status,
      ...(opt(q.sent_at) ? { sentAt: q.sent_at! } : {}),
    })),
    fundingMix: Object.entries(r.funding.mix).map(([key, pct]) => {
      const group = key.replace(/_pct$/, "");
      return { group, pct: String(pct), amount: m(r.funding.mix_amounts[group] ?? NaN) };
    }),
    financialEntries: r.financial_entries.map((f) => ({
      code: f.code, tacticId: f.tactic_id, stage: f.stage, amount: m(f.amount), entryDate: f.entry_date,
      ...(opt(f.reference) ? { reference: f.reference! } : {}),
    })),
    lifecycle: r.lifecycle_by_tactic.map((l) => ({
      tacticId: l.tactic_id, currentStage: l.current_stage,
      ...(typeof l.approved_budget === "number" ? { approvedBudget: m(l.approved_budget) } : {}),
      committed: m(l.committed), spent: m(l.spent), claimed: m(l.claimed), reimbursed: m(l.reimbursed),
      ...(typeof l.remaining_budget === "number" ? { remainingBudget: m(l.remaining_budget) } : {}),
      ...(opt(l.variance_status) ? { varianceStatus: l.variance_status! } : {}),
    })),
  };
}
