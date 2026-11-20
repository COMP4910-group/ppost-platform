import { z } from "zod";
import { type PlanSourceSnapshot, PlanSourceSnapshotSchema, type FindingSchema } from "../plan/snapshotSchema.ts";
import { type SourceFile, SourceError, issuePaths, parseSourceFile } from "./common.ts";
import { resolveEventMapping } from "./eventMapping.ts";
import { FINANCE_SOURCE_ID, adaptFinanceReport, financeDates, validateFinanceReport } from "./financeReport.ts";
import { reconcileFinanceReport } from "./reconcile.ts";
import {
  IMPACT_SOURCE_ID,
  MATRIX_SOURCE_ID,
  PPOST_SOURCE_ID,
  type TeamExportMeta,
  adaptImpactExport,
  adaptMatrixExport,
  adaptPpostExport,
} from "./teamExports.ts";

export interface BuildSnapshotInput {
  /** Explicit event mapping file (required; events are never joined by name). */
  mapping: SourceFile;
  ppost: SourceFile;
  impact: SourceFile;
  matrix?: SourceFile;
  finance?: { report: SourceFile; schema: SourceFile };
  /** When the snapshot is taken (ISO). */
  capturedAt: string;
  /** "Now" for future-date checks (ISO); injectable for tests. */
  asOf: string;
}

type Finding = z.input<typeof FindingSchema>;

const normalizeTitle = (t: string) => t.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Builds a plan snapshot from teammates' exports. Supplied data is copied, not
 * rewritten; conflicts become findings marked "Requires confirmation" instead
 * of being resolved, joined or averaged.
 */
export function buildPlanSnapshot(input: BuildSnapshotInput): PlanSourceSnapshot {
  if (Number.isNaN(Date.parse(input.asOf))) throw new Error("asOf must be an ISO date-time.");
  const ppost = adaptPpostExport(parseSourceFile(input.ppost));
  const impact = adaptImpactExport(parseSourceFile(input.impact));
  const matrix = input.matrix ? adaptMatrixExport(parseSourceFile(input.matrix)) : undefined;
  const team: TeamExportMeta[] = [ppost.meta, impact.meta, ...(matrix ? [matrix.meta] : [])];

  // ---- Event identity: explicit IDs only ------------------------------------
  const teamIds = new Set(team.map((m) => m.teamEventId));
  if (teamIds.size !== 1)
    throw new SourceError("EVENT_MAPPING", team.map((m) => m.fileName).join(", "), "disagree on the team event_id.", [...teamIds].map((id) => `event_id ${id}`));
  const disasterIds = new Set(team.map((m) => m.ppostDisasterId));
  if (disasterIds.size !== 1)
    throw new SourceError("EVENT_MAPPING", team.map((m) => m.fileName).join(", "), "disagree on data.ppost_disaster_id.", [...disasterIds]);
  const teamEventId = [...teamIds][0]!;
  const mapping = resolveEventMapping(parseSourceFile(input.mapping), teamEventId);
  if (mapping.ppostDisasterId !== ppost.meta.ppostDisasterId)
    throw new SourceError(
      "EVENT_MAPPING",
      input.mapping.fileName,
      `maps team event_id ${teamEventId} to ${mapping.ppostDisasterId}, but the PPOST exports use ${ppost.meta.ppostDisasterId}.`,
    );

  const finance = input.finance
    ? validateFinanceReport(parseSourceFile(input.finance.report), parseSourceFile(input.finance.schema))
    : undefined;
  if (finance) {
    if (!mapping.financeEventId)
      throw new SourceError("EVENT_MAPPING", input.mapping.fileName, `has no finance_event_id for team event_id ${teamEventId}.`);
    if (mapping.financeEventId !== finance.meta.eventId)
      throw new SourceError(
        "EVENT_MAPPING",
        input.mapping.fileName,
        `maps team event_id ${teamEventId} to finance event ${mapping.financeEventId}, but the finance report is for ${finance.meta.eventId}.`,
      );
  }

  // ---- Findings -------------------------------------------------------------
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "id">) => findings.push({ id: `F-${String(findings.length + 1).padStart(2, "0")}`, ...f });
  const sourceIdOf: Record<string, string> = {
    [ppost.meta.fileName]: PPOST_SOURCE_ID,
    [impact.meta.fileName]: IMPACT_SOURCE_ID,
    ...(matrix ? { [matrix.meta.fileName]: MATRIX_SOURCE_ID } : {}),
  };

  if (mapping.status === "ASSUMED")
    add({
      code: "EVENT_MAPPING_ASSUMED",
      status: "REQUIRES_CONFIRMATION",
      message: `The mapping of team event ${mapping.teamEventId} to PPOST disaster ${mapping.ppostDisasterId}${
        mapping.financeEventId ? ` and finance event ${mapping.financeEventId}` : ""
      } is assumed, not confirmed.`,
      recordIds: [mapping.ppostDisasterId],
      sourceIds: Object.values(sourceIdOf).concat(finance ? [FINANCE_SOURCE_ID] : []),
    });
  const labelledAssumed = team.filter((m) => m.sourceMappingStatus && m.sourceMappingStatus !== "confirmed");
  if (labelledAssumed.length > 0)
    add({
      code: "SOURCE_LABELS_MAPPING_ASSUMED",
      status: "REQUIRES_CONFIRMATION",
      message: `${labelledAssumed.map((m) => m.fileName).join(", ")} label their own event mapping "${labelledAssumed[0]!.sourceMappingStatus}".`,
      sourceIds: labelledAssumed.map((m) => sourceIdOf[m.fileName]!),
    });
  const names = new Set([...team.map((m) => m.eventName), ...(finance ? [finance.meta.eventName] : [])]);
  if (names.size > 1)
    add({
      code: "EVENT_NAME_DIFFERS",
      status: "INFO",
      message: `Sources use different event names (${[...names].map((n) => `"${n}"`).join(", ")}). Names are not used to join events.`,
    });
  const synthetic = [...team.filter((m) => m.synthetic).map((m) => m.fileName), ...(finance?.meta.synthetic ? [finance.meta.fileName] : [])];
  if (synthetic.length > 0)
    add({ code: "SYNTHETIC_SOURCE", status: "INFO", message: `Synthetic demonstration data: ${synthetic.join(", ")}.` });

  for (const { tacticId, entryId } of ppost.danglingCostPointers)
    add({
      code: "PPOST_COST_POINTER_MISSING",
      status: "REQUIRES_CONFIRMATION",
      message: `PPOST tactic ${tacticId} names ${entryId} as its current cost, but no such cost entry was supplied.`,
      recordIds: [tacticId],
      sourceIds: [PPOST_SOURCE_ID],
    });

  // Future dates, per source file.
  const futureCheck = (sourceId: string, fileName: string, dates: { path: string; value: string }[]) => {
    const asOf = Date.parse(input.asOf);
    const future = dates.filter((d) => !Number.isNaN(Date.parse(d.value)) && Date.parse(d.value) > asOf);
    if (future.length === 0) return;
    const latest = future.reduce((a, b) => (Date.parse(b.value) > Date.parse(a.value) ? b : a));
    add({
      code: "FUTURE_DATE",
      status: "REQUIRES_CONFIRMATION",
      message: `${future.length} date field(s) in ${fileName} are later than ${input.asOf} (latest: ${latest.value} at ${latest.path}).`,
      sourceIds: [sourceId],
    });
  };
  const envelopeDates = (m: TeamExportMeta) => [
    { path: "last_updated", value: m.lastUpdated },
    ...(m.generatedAt ? [{ path: "data.generated_at", value: m.generatedAt }] : []),
  ];
  futureCheck(PPOST_SOURCE_ID, ppost.meta.fileName, [...envelopeDates(ppost.meta), ...ppost.dates]);
  futureCheck(IMPACT_SOURCE_ID, impact.meta.fileName, envelopeDates(impact.meta));
  if (matrix) futureCheck(MATRIX_SOURCE_ID, matrix.meta.fileName, envelopeDates(matrix.meta));

  // ---- Finance: links, competing costs, reconciliation ------------------------
  let financeBlock: PlanSourceSnapshot["finance"] | undefined;
  let disasterExtras: { location?: string; declaredAt?: string } = {};
  if (finance) {
    const r = finance.report;
    futureCheck(FINANCE_SOURCE_ID, finance.meta.fileName, financeDates(r));
    const ppostTactics = new Map(ppost.tactics.map((t) => [t.id, t]));

    const references = new Map<string, Set<string>>();
    const ref = (tacticId: string, where: string) => references.set(tacticId, (references.get(tacticId) ?? new Set()).add(where));
    r.estimates.forEach((e) => ref(e.tactic_id, `estimate ${e.code}`));
    r.cost_history.forEach((h) => ref(h.tactic_id, "cost history"));
    r.funding.sources.forEach((f) => f.tactic_ids.forEach((t) => ref(t, `funding source ${f.code}`)));
    r.financial_entries.forEach((f) => ref(f.tactic_id, `financial entry ${f.code}`));
    r.lifecycle_by_tactic.forEach((l) => ref(l.tactic_id, "lifecycle"));
    r.summary.tactics_needing_estimate.forEach((t) => ref(t, "tactics needing an estimate"));
    for (const [tacticId, where] of references)
      if (!ppostTactics.has(tacticId))
        add({
          code: "FINANCE_TACTIC_NOT_IN_PPOST",
          status: "REQUIRES_CONFIRMATION",
          message: `Finance refers to ${tacticId} (${[...where].join(", ")}), which is not in the PPOST export.`,
          recordIds: [tacticId],
          sourceIds: [FINANCE_SOURCE_ID, PPOST_SOURCE_ID],
        });

    const adapted = adaptFinanceReport(r);
    const estimates = adapted.estimates.map((e) => {
      const t = ppostTactics.get(e.tacticId);
      if (!t) return { ...e, ppostLink: "NOT_IN_PPOST" as const };
      if (normalizeTitle(t.title) === normalizeTitle(e.title)) return { ...e, ppostLink: "TITLES_MATCH" as const };
      add({
        code: "TACTIC_DESCRIPTION_REVIEW",
        status: "REQUIRES_CONFIRMATION",
        message: `Finance estimate ${e.code} is titled "${e.title}", but PPOST tactic ${e.tacticId} is titled "${t.title}". Different wording does not prove different work; confirm they describe the same tactic before relying on this estimate.`,
        recordIds: [e.tacticId, e.code],
        sourceIds: [FINANCE_SOURCE_ID, PPOST_SOURCE_ID],
      });
      return { ...e, ppostLink: "REQUIRES_REVIEW" as const };
    });

    for (const e of adapted.estimates) {
      const current = ppost.costs.find((c) => c.tacticId === e.tacticId && c.isCurrent);
      if (current)
        add({
          code: "COMPETING_COSTS",
          status: "REQUIRES_CONFIRMATION",
          message: `${e.tacticId} has two current costs: PPOST cost entry ${current.id} (${current.amount}, currency not provided, ${current.stage}, ${current.status}) and finance estimate ${e.code} (${e.total} ${adapted.currency}, ${e.status}). Neither is selected; both are shown separately.`,
          recordIds: [e.tacticId, current.id, e.code],
          sourceIds: [PPOST_SOURCE_ID, FINANCE_SOURCE_ID],
        });
    }

    const checks = reconcileFinanceReport(r);
    for (const c of checks.filter((x) => !x.matches))
      add({
        code: "RECONCILIATION_MISMATCH",
        status: "REQUIRES_CONFIRMATION",
        message: `${c.label} (${c.path}): supplied ${c.supplied}, recomputed ${c.recomputed}. The supplied figure is shown unchanged.`,
        sourceIds: [FINANCE_SOURCE_ID],
      });

    const documentIds = new Set([
      ...r.funding.sources.flatMap((f) => f.document_ids ?? []),
      ...r.funding.requests.flatMap((q) => (q.document_id ? [q.document_id] : [])),
      ...r.financial_entries.flatMap((f) => f.document_ids ?? []),
    ]);
    if (documentIds.size > 0)
      add({
        code: "UNRESOLVED_DOCUMENT_REFERENCE",
        status: "INFO",
        message: `Finance cites documents (${[...documentIds].sort().join(", ")}) that cannot be opened yet: document storage is not connected.`,
        sourceIds: [FINANCE_SOURCE_ID],
      });

    if (r.event.location || r.event.declared_at) {
      disasterExtras = {
        ...(r.event.location ? { location: r.event.location } : {}),
        ...(r.event.declared_at ? { declaredAt: r.event.declared_at } : {}),
      };
      add({
        code: "SUPPLIED_FROM_FINANCE",
        status: "INFO",
        message: "The event location and declared date come from the finance report; the PPOST exports do not include them.",
        recordIds: [mapping.ppostDisasterId],
        sourceIds: [FINANCE_SOURCE_ID],
      });
    }

    financeBlock = {
      ...adapted,
      estimates,
      reconciliation: { checks: checks.length, mismatches: checks.filter((c) => !c.matches).length },
    } as PlanSourceSnapshot["finance"];
  }

  // ---- Snapshot ---------------------------------------------------------------
  const provenance = (sourceId: string, kind: "PPOST_EXPORT" | "IMPACT_EXPORT" | "MATRIX_EXPORT", m: TeamExportMeta) => ({
    sourceId, kind, fileName: m.fileName, sha256: m.sha256, bytes: m.bytes,
    submittedBy: m.submittedBy, lastUpdated: m.lastUpdated, ...(m.generatedAt ? { generatedAt: m.generatedAt } : {}),
    formatVersion: String(m.formatVersion), synthetic: m.synthetic,
  });

  const snapshot = {
    capturedAt: input.capturedAt,
    // Any synthetic source makes the whole plan synthetic; it can never be switched off here.
    isSynthetic: synthetic.length > 0,
    disaster: {
      id: mapping.ppostDisasterId,
      name: ppost.meta.eventName,
      hazardTypes: impact.hazard ? [impact.hazard] : [],
      ...disasterExtras,
    },
    priorities: ppost.priorities,
    assessment: { questions: impact.questions, answers: impact.answers, verificationTasks: ppost.verificationTasks },
    problems: ppost.problems,
    objectives: ppost.objectives,
    strategies: ppost.strategies,
    tactics: ppost.tactics,
    knownGaps: matrix?.knownGaps ?? [],
    sources: [
      provenance(PPOST_SOURCE_ID, "PPOST_EXPORT", ppost.meta),
      provenance(IMPACT_SOURCE_ID, "IMPACT_EXPORT", impact.meta),
      ...(matrix ? [provenance(MATRIX_SOURCE_ID, "MATRIX_EXPORT", matrix.meta)] : []),
      ...(finance
        ? [
            {
              sourceId: FINANCE_SOURCE_ID, kind: "FINANCE_REPORT" as const, fileName: finance.meta.fileName,
              sha256: finance.meta.sha256, bytes: finance.meta.bytes,
              ...(finance.meta.generatedBy ? { submittedBy: finance.meta.generatedBy } : {}),
              generatedAt: finance.meta.generatedAt, formatVersion: finance.meta.schemaVersion,
              synthetic: finance.meta.synthetic, disclaimer: finance.meta.disclaimer,
            },
          ]
        : []),
    ],
    eventMapping: mapping,
    ppostCosts: ppost.costs,
    ...(financeBlock ? { finance: financeBlock } : {}),
    findings,
  };

  const parsed = PlanSourceSnapshotSchema.safeParse(snapshot);
  if (!parsed.success)
    throw new SourceError("INVALID_SOURCE", "combined snapshot", "could not be assembled into a valid plan snapshot.", issuePaths(parsed.error.issues));
  return parsed.data;
}
