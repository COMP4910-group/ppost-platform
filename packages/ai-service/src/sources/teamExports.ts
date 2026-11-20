import { z } from "zod";
import {
  AnswerSchema,
  PlanSeveritySchema,
  RecordSourceSchema,
  RecordStatusSchema,
  SectorIdSchema,
  TimeHorizonSchema,
} from "../plan/snapshotSchema.ts";
import { type ParsedSource, SourceError, issuePaths, moneyText } from "./common.ts";

/** Team export format versions this adapter understands (data.file_format_version). */
export const SUPPORTED_TEAM_FORMAT_VERSIONS = [1] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date");
const isoDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s), "must be an ISO date-time");
const nullableText = z.string().nullish().transform((v) => (v === null || v === undefined || v.trim() === "" ? undefined : v));

/** The team envelope: event_id, event_name, submitted_by, last_updated, data. */
export const TeamEnvelopeSchema = z.object({
  event_id: z.union([z.number().int(), z.string().min(1)]),
  event_name: z.string().min(1),
  submitted_by: z.string().min(1),
  last_updated: isoDate,
  data: z
    .object({
      file_format_version: z.number().int(),
      module: z.string().min(1),
      ppost_disaster_id: z.string().min(1),
      event_mapping: z
        .object({ event_id: z.union([z.number(), z.string()]), ppost_disaster_id: z.string(), mapping_status: z.string() })
        .optional(),
      sample_data: z.boolean(),
      generated_at: isoDateTime.optional(),
    })
    .passthrough(),
});

export interface TeamExportMeta {
  fileName: string;
  sha256: string;
  bytes: number;
  teamEventId: string;
  eventName: string;
  submittedBy: string;
  lastUpdated: string;
  generatedAt?: string;
  formatVersion: number;
  ppostDisasterId: string;
  sourceMappingStatus?: string;
  synthetic: boolean;
  module: string;
}

function parseEnvelope(source: ParsedSource, expectedModule: string) {
  const env = TeamEnvelopeSchema.safeParse(source.json);
  if (!env.success)
    throw new SourceError("INVALID_SOURCE", source.fileName, "does not match the team envelope.", issuePaths(env.error.issues));
  const d = env.data.data;
  if (!(SUPPORTED_TEAM_FORMAT_VERSIONS as readonly number[]).includes(d.file_format_version))
    throw new SourceError(
      "UNSUPPORTED_VERSION",
      source.fileName,
      `has data.file_format_version ${d.file_format_version}; supported: ${SUPPORTED_TEAM_FORMAT_VERSIONS.join(", ")}.`,
    );
  if (d.module !== expectedModule)
    throw new SourceError("INVALID_SOURCE", source.fileName, `is a "${d.module}" export, expected "${expectedModule}".`);
  const meta: TeamExportMeta = {
    fileName: source.fileName,
    sha256: source.sha256,
    bytes: source.bytes,
    teamEventId: String(env.data.event_id),
    eventName: env.data.event_name,
    submittedBy: env.data.submitted_by,
    lastUpdated: env.data.last_updated,
    ...(d.generated_at ? { generatedAt: d.generated_at } : {}),
    formatVersion: d.file_format_version,
    ppostDisasterId: d.ppost_disaster_id,
    ...(d.event_mapping ? { sourceMappingStatus: d.event_mapping.mapping_status } : {}),
    synthetic: d.sample_data,
    module: d.module,
  };
  return { meta, data: d as Record<string, unknown> };
}

function parseData<S extends z.ZodType>(schema: S, data: unknown, fileName: string): z.output<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new SourceError("INVALID_SOURCE", fileName, "has data that does not match the expected export shape.", issuePaths(parsed.error.issues));
  return parsed.data;
}

// ---------------------------------------------------------------------------
// ppost.json (PPOST Workspace)
// ---------------------------------------------------------------------------

const recordBase = {
  id: z.string().min(1),
  title: z.string().min(1),
  description: nullableText,
  owner: nullableText,
  status: RecordStatusSchema,
  source: RecordSourceSchema,
  updated_at: z.string().optional(),
};

const fiveW1H = z
  .object({
    who: z.object({ accountable_person: nullableText, team: nullableText, supporting_roles: z.array(z.string()).nullish() }).partial().nullish(),
    what: z.object({ action: nullableText, deliverable: nullableText }).partial().nullish(),
    when: z.object({ start: nullableText, end: nullableText, horizon: TimeHorizonSchema.nullish() }).partial().nullish(),
    where: z.object({ location: nullableText, parcel_ids: z.array(z.string()).nullish() }).partial().nullish(),
    why: z.object({ objective_id: nullableText, rationale: nullableText }).partial().nullish(),
    how: z.object({ approach: nullableText, delivery_method: z.enum(["CONTRACTOR", "IN_HOUSE", "PARTNER", "MUTUAL_AID"]).nullish() }).partial().nullish(),
  })
  .partial()
  .nullish();

const PpostDataSchema = z.object({
  priorities: z.array(z.object({ id: z.string().min(1), rank: z.number().int().min(1), name: z.string().min(1), active: z.boolean() })),
  problems: z.array(
    z.object({
      ...recordBase,
      priority_id: z.string().min(1),
      sector: SectorIdSchema,
      severity: PlanSeveritySchema,
      from_unknown_question_id: nullableText,
    }),
  ),
  objectives: z.array(z.object({ ...recordBase, problem_ids: z.array(z.string()), horizon: TimeHorizonSchema.nullish() })),
  strategies: z.array(z.object({ ...recordBase, objective_id: z.string().min(1) })),
  tactics: z.array(
    z.object({
      ...recordBase,
      strategy_id: z.string().min(1),
      primary_priority_id: z.string().min(1),
      secondary_priority_ids: z.array(z.string()).nullish(),
      sector: SectorIdSchema,
      five_w1h: fiveW1H,
      success_measure: nullableText,
      safety_precaution: z.boolean().nullish(),
      finance: z
        .object({ current_cost_entry_id: z.string().nullish(), cost_history_entry_ids: z.array(z.string()).nullish() })
        .partial()
        .nullish(),
    }),
  ),
  verification_tasks: z.array(
    z.object({
      id: z.string().min(1),
      question_id: z.string().min(1),
      title: z.string().min(1),
      assigned_role: z.string().min(1),
      due_in_hours: z.number().int().min(0),
      status: z.enum(["OPEN", "CLOSED"]),
    }),
  ),
  cost_entries: z.array(
    z.object({
      id: z.string().min(1),
      tactic_id: z.string().min(1),
      amount_sample: z.number().min(0),
      stage: z.string().min(1),
      status: z.string().min(1),
      revision: nullableText,
      entered_by: nullableText,
      at: z.string().optional(),
    }),
  ),
});

const compact = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as T;

function mapFiveW1H(w: z.output<typeof fiveW1H>) {
  if (!w) return {};
  const part = <T extends Record<string, unknown>>(o: T | null | undefined) => {
    const c = o ? compact(o) : undefined;
    return c && Object.keys(c).length > 0 ? c : undefined;
  };
  return compact({
    who: part({ accountablePerson: w.who?.accountable_person, team: w.who?.team, supportingRoles: w.who?.supporting_roles ?? undefined }),
    what: part({ action: w.what?.action, deliverable: w.what?.deliverable }),
    when: part({ start: w.when?.start, end: w.when?.end, horizon: w.when?.horizon ?? undefined }),
    where: part({ location: w.where?.location, parcelIds: w.where?.parcel_ids ?? undefined }),
    why: part({ objectiveId: w.why?.objective_id, rationale: w.why?.rationale }),
    how: part({ approach: w.how?.approach, deliveryMethod: w.how?.delivery_method ?? undefined }),
  });
}

export const PPOST_SOURCE_ID = "SRC-PPOST";

export function adaptPpostExport(source: ParsedSource) {
  const { meta, data } = parseEnvelope(source, "PPOST Workspace");
  const d = parseData(PpostDataSchema, data, source.fileName);
  const base = (r: { id: string; title: string; description?: string; owner?: string; status: string; source: string; updated_at?: string }) =>
    compact({ id: r.id, title: r.title, description: r.description, owner: r.owner, status: r.status, source: r.source, updatedAt: r.updated_at });

  const currentPointers = new Map(d.tactics.map((t) => [t.id, t.finance?.current_cost_entry_id ?? undefined]));
  const notExact = d.cost_entries.filter((c) => moneyText(c.amount_sample) === null).map((c) => c.id);

  return {
    meta,
    priorities: d.priorities,
    problems: d.problems.map((p) =>
      compact({ ...base(p), priorityId: p.priority_id, sector: p.sector, severity: p.severity, fromUnknownQuestionId: p.from_unknown_question_id }),
    ),
    objectives: d.objectives.map((o) => compact({ ...base(o), problemIds: o.problem_ids, horizon: o.horizon ?? undefined })),
    strategies: d.strategies.map((s) => ({ ...base(s), objectiveId: s.objective_id })),
    tactics: d.tactics.map((t) =>
      compact({
        ...base(t),
        strategyId: t.strategy_id,
        primaryPriorityId: t.primary_priority_id,
        secondaryPriorityIds: t.secondary_priority_ids ?? [],
        sector: t.sector,
        fiveW1H: mapFiveW1H(t.five_w1h),
        successMeasure: t.success_measure,
        safetyPrecaution: t.safety_precaution ?? false,
        // estimateTotal is deliberately not set: PPOST sample costs stay in ppostCosts.
      }),
    ),
    verificationTasks: d.verification_tasks.map((v) => ({
      id: v.id, questionId: v.question_id, title: v.title, assignedRole: v.assigned_role, dueInHours: v.due_in_hours, status: v.status,
    })),
    costs: d.cost_entries
      .filter((c) => moneyText(c.amount_sample) !== null)
      .map((c) =>
        compact({
          id: c.id,
          sourceId: PPOST_SOURCE_ID,
          tacticId: c.tactic_id,
          amount: moneyText(c.amount_sample)!,
          stage: c.stage,
          status: c.status,
          revision: c.revision,
          enteredBy: c.entered_by,
          at: c.at,
          isCurrent: currentPointers.get(c.tactic_id) === c.id,
        }),
      ),
    /** Tactics whose current-cost pointer names no supplied cost entry. */
    danglingCostPointers: [...currentPointers.entries()]
      .filter(([, ptr]) => ptr && !d.cost_entries.some((c) => c.id === ptr))
      .map(([tacticId, ptr]) => ({ tacticId, entryId: ptr! })),
    inexactCostEntryIds: notExact,
    /** Every date-like field, for future-date checks. */
    dates: [
      ...[...d.problems, ...d.objectives, ...d.strategies, ...d.tactics].flatMap((r) => (r.updated_at ? [{ path: `${r.id}.updated_at`, value: r.updated_at }] : [])),
      ...d.cost_entries.flatMap((c) => (c.at ? [{ path: `${c.id}.at`, value: c.at }] : [])),
    ],
  };
}

// ---------------------------------------------------------------------------
// impact.json (Impact Assessment)
// ---------------------------------------------------------------------------

const ImpactDataSchema = z.object({
  assessment: z.object({ hazard: z.string().min(1).nullish() }).passthrough(),
  questions: z.array(
    z.object({
      question_id: z.string().min(1),
      text: z.string().min(1),
      question_type: z.string().min(1),
      sector: SectorIdSchema,
      priority_id: z.string().min(1),
      answer: AnswerSchema.nullable(),
      note: z.string().nullish(),
    }),
  ),
});

export const IMPACT_SOURCE_ID = "SRC-IMPACT";

/**
 * Main questions are always included; follow-up and deeper questions only when
 * answered. Unanswered questions get no answer entry (UNANSWERED ≠ UNKNOWN).
 */
export function adaptImpactExport(source: ParsedSource) {
  const { meta, data } = parseEnvelope(source, "Impact Assessment");
  const d = parseData(ImpactDataSchema, data, source.fileName);
  const included = d.questions.filter((q) => q.question_type === "main" || q.answer !== null);
  return {
    meta,
    hazard: d.assessment.hazard ?? undefined,
    questions: included.map((q) => ({ id: q.question_id, text: q.text, sector: q.sector, priorityId: q.priority_id })),
    answers: included
      .filter((q) => q.answer !== null)
      .map((q) => compact({ questionId: q.question_id, answer: q.answer!, notes: q.note?.trim() ? q.note : undefined })),
  };
}

// ---------------------------------------------------------------------------
// matrix.json (Recovery Matrix)
// ---------------------------------------------------------------------------

const MatrixDataSchema = z.object({
  cells: z.array(
    z.object({
      priority_id: z.string().min(1),
      sector: z.string().min(1),
      status: z.string().min(1),
      reasons: z.array(z.string()),
    }),
  ),
});

export const MATRIX_SOURCE_ID = "SRC-MATRIX";

/** Matrix reasons ("P-07: tactic missing owner") become known gaps, attributed to the export. */
export function adaptMatrixExport(source: ParsedSource) {
  const { meta, data } = parseEnvelope(source, "Recovery Matrix");
  const d = parseData(MatrixDataSchema, data, source.fileName);
  const knownGaps = d.cells.flatMap((cell) =>
    cell.reasons.map((reason) => {
      const m = /^([A-Za-z0-9_.:-]+):\s*(.+)$/.exec(reason);
      return {
        recordIds: m ? [m[1]!] : [cell.priority_id],
        description: m ? m[2]! : reason,
        detectedBy: `PPOST matrix export (${cell.priority_id} × ${cell.sector}, ${cell.status})`,
      };
    }),
  );
  return { meta, knownGaps };
}
