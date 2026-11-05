import {
  AI_NOTICE,
  AI_RECOMMENDATION_LABEL,
  NOT_PROVIDED,
  PROVISIONAL_STRUCTURE,
  RecoveryPlanDraftSchema,
} from "./draftSchema.ts";
import { listSourceRecordIds } from "./snapshotSchema.ts";
import type {
  AiCitedText,
  AiRecommendation,
  FieldStatus,
  PlanAiItem,
  PlanField,
  PlanItem,
  PlanRecord,
  PlanRecordType,
  PlanSection,
  PlanSourceSnapshot,
  RecoveryPlanDraft,
  RecoveryPlanNarrative,
} from "./types.ts";

type Snapshot = PlanSourceSnapshot;
type Tactic = Snapshot["tactics"][number];

/**
 * Builds the reviewable draft. Every factual item comes straight from the
 * snapshot; the narrative only contributes clearly labelled AI items.
 * Pure and deterministic: the same inputs always produce the same draft.
 */
export function assembleRecoveryPlanDraft(
  snapshot: Snapshot,
  narrative: RecoveryPlanNarrative,
): RecoveryPlanDraft {
  const references = findUnresolvedReferences(snapshot);
  const title = `Initial Recovery Plan: ${snapshot.disaster.name}`;

  const draft: RecoveryPlanDraft = {
    kind: "INITIAL_RECOVERY_PLAN_DRAFT",
    structure: { ...PROVISIONAL_STRUCTURE },
    title,
    disasterId: snapshot.disaster.id,
    snapshotCapturedAt: snapshot.capturedAt,
    isSynthetic: snapshot.isSynthetic,
    aiNotice: AI_NOTICE,
    sections: [
      documentControlSection(snapshot, title),
      section("EXECUTIVE_SUMMARY", "Executive summary", "AI_RECOMMENDATION", [
        aiItem(narrative.executiveSummary),
      ]),
      eventOverviewSection(snapshot),
      impactAssessmentSection(snapshot),
      prioritiesSection(snapshot),
      ppostSection(snapshot, references),
      resourcesAndBudgetSection(snapshot),
      gapsSection(snapshot, references, narrative.confirmationsNeeded),
      section(
        "RECOMMENDED_NEXT_STEPS",
        "Recommended next steps",
        "AI_RECOMMENDATION",
        narrative.recommendations.length > 0
          ? narrative.recommendations.map(aiItem)
          : [field("Recommendations", null, [])],
      ),
      sourceIndexSection(snapshot),
    ],
  };

  // Guards the assembly logic itself; a failure here is a bug, not bad input.
  return RecoveryPlanDraftSchema.parse(draft);
}

/** Source IDs cited by the narrative that do not exist in the snapshot. */
export function findUnknownSourceIds(
  snapshot: Snapshot,
  narrative: RecoveryPlanNarrative,
): string[] {
  const known = new Set(listSourceRecordIds(snapshot));
  const cited = [
    ...narrative.executiveSummary.sourceRecordIds,
    ...narrative.recommendations.flatMap((r) => r.sourceRecordIds),
    ...narrative.confirmationsNeeded.flatMap((c) => c.sourceRecordIds),
  ];
  return [...new Set(cited.filter((id) => !known.has(id)))];
}

export interface UnresolvedReference {
  /** The referring record, or undefined when the referrer has no source ID (answers, known gaps). */
  recordId: string | undefined;
  /** Human-readable name of the referrer. */
  referrer: string;
  field: string;
  missingId: string;
}

/** References from one supplied record to an ID that is not in the snapshot. */
export function findUnresolvedReferences(snapshot: Snapshot): UnresolvedReference[] {
  const priorityIds = new Set(snapshot.priorities.map((p) => p.id));
  const questionIds = new Set(snapshot.assessment.questions.map((q) => q.id));
  const problemIds = new Set(snapshot.problems.map((p) => p.id));
  const objectiveIds = new Set(snapshot.objectives.map((o) => o.id));
  const strategyIds = new Set(snapshot.strategies.map((s) => s.id));
  const allIds = new Set(listSourceRecordIds(snapshot));

  const found: UnresolvedReference[] = [];
  const check = (
    recordId: string | undefined,
    field: string,
    missingId: string | undefined,
    known: Set<string>,
    referrer: string = recordId ?? "",
  ) => {
    if (missingId !== undefined && !known.has(missingId)) found.push({ recordId, referrer, field, missingId });
  };

  for (const q of snapshot.assessment.questions) check(q.id, "priority", q.priorityId, priorityIds);
  for (const a of snapshot.assessment.answers)
    check(undefined, "question", a.questionId, questionIds, "An assessment answer");
  for (const t of snapshot.assessment.verificationTasks) check(t.id, "question", t.questionId, questionIds);
  for (const p of snapshot.problems) {
    check(p.id, "priority", p.priorityId, priorityIds);
    check(p.id, "UNKNOWN assessment question", p.fromUnknownQuestionId, questionIds);
  }
  for (const o of snapshot.objectives) for (const id of o.problemIds) check(o.id, "problem", id, problemIds);
  for (const s of snapshot.strategies) check(s.id, "objective", s.objectiveId, objectiveIds);
  for (const t of snapshot.tactics) {
    check(t.id, "strategy", t.strategyId, strategyIds);
    check(t.id, "primary priority", t.primaryPriorityId, priorityIds);
    for (const id of t.secondaryPriorityIds) check(t.id, "secondary priority", id, priorityIds);
    check(t.id, "5W1H objective", t.fiveW1H.why?.objectiveId, objectiveIds);
  }
  for (const g of snapshot.knownGaps)
    for (const id of g.recordIds) check(undefined, "record", id, allIds, "A known gap");
  return found;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function documentControlSection(s: Snapshot, title: string): PlanSection {
  return section("DOCUMENT_CONTROL", "Document control", "SOURCE_DATA", [
    field("Plan title", title, [s.disaster.id]),
    field("Disaster ID", s.disaster.id, [s.disaster.id]),
    field("Source data captured at", s.capturedAt, []),
    field(
      "Data classification",
      s.isSynthetic ? "SYNTHETIC: demonstration data, not real client data" : "Supplied planning data",
      [],
    ),
    field("Document structure", PROVISIONAL_STRUCTURE.note, []),
    field("AI involvement", AI_NOTICE, []),
  ]);
}

function eventOverviewSection(s: Snapshot): PlanSection {
  const d = s.disaster;
  return section("EVENT_OVERVIEW", "Event overview", "SOURCE_DATA", [
    field("Event name", d.name, [d.id]),
    field("Hazard types", joined(d.hazardTypes), [d.id]),
    field("Location", d.location, [d.id]),
    field("Declared", d.declaredAt, [d.id]),
    field("Active recovery sectors", joined(d.activeSectors), [d.id]),
  ]);
}

function impactAssessmentSection(s: Snapshot): PlanSection {
  const { questions, answers, verificationTasks } = s.assessment;
  const answerFor = new Map(answers.map((a) => [a.questionId, a]));
  const items: PlanItem[] = [];

  if (questions.length === 0) items.push(field("Assessment questions", null, []));
  for (const q of questions) {
    const a = answerFor.get(q.id);
    const fields: PlanField[] = [field("Sector", q.sector, [q.id]), answerField(q.id, a?.answer)];
    if (a) {
      if (a.notes) fields.push(field("Notes", a.notes, [q.id]));
      fields.push(field("Answered by", a.answeredBy, [q.id]), field("Answered at", a.answeredAt, [q.id]));
    }
    items.push(record("ASSESSMENT_QUESTION", q.id, 0, q.text, fields));
  }

  for (const t of verificationTasks) {
    items.push(
      record("VERIFICATION_TASK", t.id, 0, t.title, [
        field("Verifies question", t.questionId, [t.id, t.questionId]),
        field("Assigned role", t.assignedRole, [t.id]),
        field("Due within", `${t.dueInHours} hours`, [t.id]),
        field("Status", t.status, [t.id]),
      ]),
    );
  }
  return section("IMPACT_ASSESSMENT", "Impact assessment summary", "SOURCE_DATA", items);
}

function prioritiesSection(s: Snapshot): PlanSection {
  const items: PlanItem[] =
    s.priorities.length === 0
      ? [field("Recovery priorities", null, [])]
      : sortedPriorities(s).map((p) =>
          field(`${p.rank}. ${p.name}`, p.active ? "Active" : "Inactive", [p.id]),
        );
  return section("RECOVERY_PRIORITIES", "Recovery priorities", "SOURCE_DATA", items);
}

function ppostSection(s: Snapshot, references: UnresolvedReference[]): PlanSection {
  const items: PlanItem[] = [];
  const priorityIds = new Set(s.priorities.map((p) => p.id));

  for (const priority of sortedPriorities(s)) {
    const problems = s.problems.filter((p) => p.priorityId === priority.id);
    if (problems.length === 0) continue;
    items.push(
      record("PRIORITY", priority.id, 0, priority.name, [
        field("Rank", String(priority.rank), [priority.id]),
      ]),
    );
    for (const problem of problems) items.push(...problemChain(s, problem, 1));
  }

  // Records whose parent is not in the snapshot are still reproduced, flagged.
  const unlinked: PlanItem[] = [];
  const unresolvedFor = (recordId: string) => references.filter((r) => r.recordId === recordId);
  const withUnresolved = (rec: PlanRecord): PlanRecord => ({
    ...rec,
    fields: [
      ...unresolvedFor(rec.recordId).map((r) =>
        confirmation(`Linked ${r.field}`, `${r.missingId} (not in the supplied data)`, [rec.recordId]),
      ),
      ...rec.fields,
    ],
  });

  for (const p of s.problems.filter((p) => !priorityIds.has(p.priorityId)))
    unlinked.push(...problemChain(s, p, 1).map((r, i) => (i === 0 ? withUnresolved(r) : r)));
  const problemIds = new Set(s.problems.map((p) => p.id));
  for (const o of s.objectives.filter((o) => !o.problemIds.some((id) => problemIds.has(id))))
    unlinked.push(
      ...objectiveChain(s, o, 1).map((r, i) =>
        i === 0 ? (o.problemIds.length === 0 ? withNoProblem(r) : withUnresolved(r)) : r,
      ),
    );
  const objectiveIds = new Set(s.objectives.map((o) => o.id));
  for (const st of s.strategies.filter((st) => !objectiveIds.has(st.objectiveId)))
    unlinked.push(...strategyChain(s, st, 1).map((r, i) => (i === 0 ? withUnresolved(r) : r)));
  const strategyIds = new Set(s.strategies.map((st) => st.id));
  for (const t of s.tactics.filter((t) => !strategyIds.has(t.strategyId)))
    unlinked.push(withUnresolved(tacticRecord(t, 1)));

  if (unlinked.length > 0) {
    items.push(
      confirmation(
        "Unlinked records",
        "The following records reference records that are not in the supplied data.",
        [],
      ),
      ...unlinked,
    );
  }
  if (items.length === 0) items.push(field("PPOST records", null, []));
  return section("PPOST_CHAINS", "Problems, objectives, strategies and tactics", "SOURCE_DATA", items);
}

function resourcesAndBudgetSection(s: Snapshot): PlanSection {
  const items: PlanItem[] = [];
  const estimated = s.tactics.filter((t) => t.estimateTotal !== undefined);
  const sum = estimated.reduce((total, t) => total + (t.estimateTotal ?? 0), 0);

  items.push(
    field("Currency", s.currency, []),
    field("Tactics with a supplied Class D estimate", `${estimated.length} of ${s.tactics.length}`, []),
    field(
      "Sum of supplied tactic estimates (tactics without an estimate are excluded)",
      estimated.length > 0 ? amount(sum, s.currency) : null,
      estimated.map((t) => t.id),
    ),
    field("Funding sources and funding gap", null, []),
  );

  for (const t of s.tactics) {
    const who = t.fiveW1H.who;
    items.push(
      record("TACTIC", t.id, 0, t.title, [
        field("Class D estimate", t.estimateTotal === undefined ? null : amount(t.estimateTotal, s.currency), [t.id]),
        field("Owner", t.owner, [t.id]),
        field("Team", who?.team, [t.id]),
        field("Supporting roles", joined(who?.supportingRoles), [t.id]),
        field("Delivery method", t.fiveW1H.how?.deliveryMethod, [t.id]),
      ]),
    );
  }
  return section("RESOURCES_AND_BUDGET", "Resources and budget", "SOURCE_DATA", items);
}

function gapsSection(
  s: Snapshot,
  references: UnresolvedReference[],
  aiConfirmations: AiCitedText[],
): PlanSection {
  const items: PlanItem[] = [];
  const answerFor = new Map(s.assessment.answers.map((a) => [a.questionId, a.answer]));

  for (const g of s.knownGaps)
    items.push(
      confirmation(g.detectedBy ? `Known gap (${g.detectedBy})` : "Known gap", g.description, g.recordIds),
    );
  for (const q of s.assessment.questions.filter((q) => answerFor.get(q.id) === "UNKNOWN"))
    items.push(confirmation("Unresolved UNKNOWN answer", `${q.id}: ${q.text}`, [q.id]));
  for (const q of s.assessment.questions.filter((q) => !answerFor.has(q.id)))
    items.push(confirmation("Unanswered assessment question", `${q.id}: ${q.text}`, [q.id]));
  for (const t of s.assessment.verificationTasks.filter((t) => t.status === "OPEN"))
    items.push(confirmation("Open verification task", `${t.id}: ${t.title}`, [t.id]));
  for (const r of references)
    items.push(
      confirmation(
        "Unresolved reference",
        `${r.referrer} references ${r.field} ${r.missingId}, which is not in the supplied data`,
        r.recordId === undefined ? [] : [r.recordId],
      ),
    );

  const deterministicCount = items.length;
  items.push(...aiConfirmations.map(aiItem));

  if (items.length === 0) items.push(field("Gaps", "None identified in the supplied data", []));
  const origin = aiConfirmations.length === 0 ? "SOURCE_DATA" : deterministicCount === 0 ? "AI_RECOMMENDATION" : "MIXED";
  return section("GAPS_AND_CONFIRMATIONS", "Gaps and items requiring confirmation", origin, items);
}

function sourceIndexSection(s: Snapshot): PlanSection {
  const entries: [string, string, string][] = [
    [s.disaster.id, "Disaster", s.disaster.name],
    ...s.priorities.map((r): [string, string, string] => [r.id, "Priority", r.name]),
    ...s.assessment.questions.map((r): [string, string, string] => [r.id, "Assessment question", r.text]),
    ...s.assessment.verificationTasks.map((r): [string, string, string] => [r.id, "Verification task", r.title]),
    ...s.problems.map((r): [string, string, string] => [r.id, "Problem", r.title]),
    ...s.objectives.map((r): [string, string, string] => [r.id, "Objective", r.title]),
    ...s.strategies.map((r): [string, string, string] => [r.id, "Strategy", r.title]),
    ...s.tactics.map((r): [string, string, string] => [r.id, "Tactic", r.title]),
  ];
  return section(
    "SOURCE_RECORD_INDEX",
    "Source record index",
    "SOURCE_DATA",
    entries.map(([id, type, name]) => field(id, `${type}: ${name}`, [id])),
  );
}

// ---------------------------------------------------------------------------
// PPOST chain records
// ---------------------------------------------------------------------------

function problemChain(s: Snapshot, p: Snapshot["problems"][number], level: number): PlanRecord[] {
  const objectives = s.objectives.filter((o) => o.problemIds.includes(p.id));
  const fields = [
    field("Sector", p.sector, [p.id]),
    field("Severity", p.severity, [p.id]),
    field("Status", p.status, [p.id]),
    field("Source", p.source, [p.id]),
    field("Owner", p.owner, [p.id]),
    field("Description", p.description, [p.id]),
  ];
  if (p.fromUnknownQuestionId)
    fields.push(
      confirmation("Derived from UNKNOWN assessment answer", p.fromUnknownQuestionId, [p.id, p.fromUnknownQuestionId]),
    );
  if (objectives.length === 0) fields.push(field("Objectives", null, [p.id]));
  return [
    record("PROBLEM", p.id, level, p.title, fields),
    ...objectives.flatMap((o) => objectiveChain(s, o, level + 1)),
  ];
}

function objectiveChain(s: Snapshot, o: Snapshot["objectives"][number], level: number): PlanRecord[] {
  const strategies = s.strategies.filter((st) => st.objectiveId === o.id);
  const fields = [
    field("Time horizon", o.horizon, [o.id]),
    field("Status", o.status, [o.id]),
    field("Source", o.source, [o.id]),
    field("Owner", o.owner, [o.id]),
    field("Description", o.description, [o.id]),
    field("Addresses problems", joined(o.problemIds), [o.id, ...o.problemIds]),
  ];
  if (strategies.length === 0) fields.push(field("Strategies", null, [o.id]));
  return [
    record("OBJECTIVE", o.id, level, o.title, fields),
    ...strategies.flatMap((st) => strategyChain(s, st, level + 1)),
  ];
}

function strategyChain(s: Snapshot, st: Snapshot["strategies"][number], level: number): PlanRecord[] {
  const tactics = s.tactics.filter((t) => t.strategyId === st.id);
  const fields = [
    field("Status", st.status, [st.id]),
    field("Source", st.source, [st.id]),
    field("Owner", st.owner, [st.id]),
    field("Description", st.description, [st.id]),
  ];
  if (tactics.length === 0) fields.push(field("Tactics", null, [st.id]));
  return [record("STRATEGY", st.id, level, st.title, fields), ...tactics.map((t) => tacticRecord(t, level + 1))];
}

function tacticRecord(t: Tactic, level: number): PlanRecord {
  const w = t.fiveW1H;
  const ids = [t.id];
  const fields = [
    field("Sector", t.sector, ids),
    field("Status", t.status, ids),
    field("Source", t.source, ids),
    field("Primary priority", t.primaryPriorityId, [t.id, t.primaryPriorityId]),
    field("Owner", t.owner, ids),
    field("Accountable person", w.who?.accountablePerson, ids),
    field("Team", w.who?.team, ids),
    field("Action", w.what?.action, ids),
    field("Deliverable", w.what?.deliverable, ids),
    field("Start", w.when?.start, ids),
    field("End", w.when?.end, ids),
    field("Time horizon", w.when?.horizon, ids),
    field("Location", w.where?.location, ids),
    field("Rationale", w.why?.rationale, ids),
    field("Approach", w.how?.approach, ids),
    field("Success measure", t.successMeasure, ids),
  ];
  if (t.secondaryPriorityIds.length > 0)
    fields.splice(4, 0, field("Secondary priorities", joined(t.secondaryPriorityIds), [t.id, ...t.secondaryPriorityIds]));
  if (t.safetyPrecaution) fields.push(field("Safety precaution", "Yes", ids));
  return record("TACTIC", t.id, level, t.title, fields);
}

function withNoProblem(rec: PlanRecord): PlanRecord {
  return { ...rec, fields: [confirmation("Linked problem", "No problem linked", [rec.recordId]), ...rec.fields] };
}

// ---------------------------------------------------------------------------
// Item helpers
// ---------------------------------------------------------------------------

function section(
  key: PlanSection["key"],
  title: string,
  origin: PlanSection["origin"],
  items: PlanItem[],
): PlanSection {
  return { key, title, origin, items };
}

/** A supplied value, or "Not provided" when it is missing. */
function field(label: string, value: string | null | undefined, sourceRecordIds: string[]): PlanField {
  const provided = value !== undefined && value !== null && value !== "";
  const status: FieldStatus = provided ? "PROVIDED" : "NOT_PROVIDED";
  return { type: "FIELD", label, value: provided ? value : null, status, sourceRecordIds: unique(sourceRecordIds) };
}

/** A supplied value that must not be relied on until confirmed. */
function confirmation(label: string, value: string, sourceRecordIds: string[]): PlanField {
  return { type: "FIELD", label, value, status: "REQUIRES_CONFIRMATION", sourceRecordIds: unique(sourceRecordIds) };
}

function answerField(questionId: string, answer: "YES" | "NO" | "UNKNOWN" | undefined): PlanField {
  if (answer === "UNKNOWN") return confirmation("Answer", "UNKNOWN", [questionId]);
  return field("Answer", answer, [questionId]);
}

function record(
  recordType: PlanRecordType,
  recordId: string,
  level: number,
  title: string,
  fields: PlanField[],
): PlanRecord {
  return { type: "RECORD", recordType, recordId, level, title, fields };
}

function aiItem(item: AiCitedText | AiRecommendation): PlanAiItem {
  return {
    type: "AI_RECOMMENDATION",
    label: AI_RECOMMENDATION_LABEL,
    ...("title" in item ? { title: item.title } : {}),
    text: item.text,
    sourceRecordIds: unique(item.sourceRecordIds),
  };
}

function sortedPriorities(s: Snapshot) {
  return [...s.priorities].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}

function joined(values: readonly string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(", ") : undefined;
}

/** Formats a supplied amount without rounding; currency is never assumed. */
function amount(value: number, currency: string | undefined): string {
  const [whole = "", fraction] = String(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  return currency ? `${formatted} ${currency}` : `${formatted} (currency ${NOT_PROVIDED.toLowerCase()})`;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
