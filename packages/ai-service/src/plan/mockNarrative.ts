import { MAX_RECOMMENDATIONS } from "./draftSchema.ts";
import { listSourceRecordIds } from "./snapshotSchema.ts";
import type { PlanSourceSnapshot, RecoveryPlanNarrative } from "./types.ts";

/** Prefix on every mock sentence so it can never be mistaken for model output. */
export const MOCK_PREFIX = "MOCK NARRATIVE (no AI model was used):";

/**
 * A deterministic stand-in for the AI narrative, for demos and the CLI's
 * --mock mode. It states no facts or figures of its own and cites only IDs
 * that exist in the snapshot.
 */
export function buildMockNarrative(snapshot: PlanSourceSnapshot): RecoveryPlanNarrative {
  const known = new Set(listSourceRecordIds(snapshot));
  const cite = (ids: string[]) => {
    const valid = [...new Set(ids.filter((id) => known.has(id)))];
    return valid.length > 0 ? valid : [snapshot.disaster.id];
  };

  const toConfirm = snapshot.findings.filter((f) => f.status === "REQUIRES_CONFIRMATION");
  const byCode = new Map<string, typeof toConfirm>();
  for (const f of toConfirm) byCode.set(f.code, [...(byCode.get(f.code) ?? []), f]);

  return {
    executiveSummary: {
      text: `${MOCK_PREFIX} this demonstration draft brings together the supplied planning exports for review. Items marked "Requires confirmation" must be resolved with the data owners before the plan is relied on.`,
      sourceRecordIds: cite([snapshot.disaster.id, ...snapshot.sources.map((s) => s.sourceId)]),
    },
    recommendations: [...byCode.entries()].slice(0, MAX_RECOMMENDATIONS).map(([code, findings]) => ({
      title: `Resolve source findings: ${code.toLowerCase().replace(/_/g, " ")}`,
      text: `${MOCK_PREFIX} review the related items under "Gaps and items requiring confirmation" with the data owners.`,
      sourceRecordIds: cite(findings.flatMap((f) => [...f.recordIds, ...f.sourceIds])),
    })),
    confirmationsNeeded: [],
  };
}
