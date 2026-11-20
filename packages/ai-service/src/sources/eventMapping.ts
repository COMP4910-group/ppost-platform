import { z } from "zod";
import { type ParsedSource, SourceError, issuePaths } from "./common.ts";

/**
 * Explicit mapping between the team's event ID (the envelope's event_id), the
 * PPOST disaster ID and the finance report's event ID. Events are never
 * joined by name. An "assumed" mapping is usable but always marked
 * "Requires confirmation" in the plan.
 */
export const EventMappingFileSchema = z.object({
  mapping_version: z.literal(1),
  mappings: z
    .array(
      z.object({
        team_event_id: z.union([z.string().min(1), z.number().int()]).transform(String),
        ppost_disaster_id: z.string().min(1),
        finance_event_id: z.string().min(1).nullish(),
        status: z.enum(["confirmed", "assumed"]),
        basis: z.string().min(1).nullish(),
        confirmed_by: z.string().min(1).nullish(),
      }),
    )
    .min(1),
});

export interface ResolvedEventMapping {
  teamEventId: string;
  ppostDisasterId: string;
  financeEventId?: string;
  status: "CONFIRMED" | "ASSUMED";
  basis?: string;
  confirmedBy?: string;
}

export function resolveEventMapping(file: ParsedSource, teamEventId: string): ResolvedEventMapping {
  const parsed = EventMappingFileSchema.safeParse(file.json);
  if (!parsed.success)
    throw new SourceError("EVENT_MAPPING", file.fileName, "is not a valid event mapping file.", issuePaths(parsed.error.issues));
  const matches = parsed.data.mappings.filter((m) => m.team_event_id === teamEventId);
  if (matches.length === 0)
    throw new SourceError("EVENT_MAPPING", file.fileName, `has no mapping for team event_id ${teamEventId}.`);
  if (matches.length > 1)
    throw new SourceError("EVENT_MAPPING", file.fileName, `has ${matches.length} mappings for team event_id ${teamEventId}; expected exactly one.`);
  const m = matches[0]!;
  if (m.status === "confirmed" && !m.confirmed_by)
    throw new SourceError("EVENT_MAPPING", file.fileName, `marks team event_id ${teamEventId} as confirmed without confirmed_by.`);
  return {
    teamEventId: m.team_event_id,
    ppostDisasterId: m.ppost_disaster_id,
    ...(m.finance_event_id ? { financeEventId: m.finance_event_id } : {}),
    status: m.status === "confirmed" ? "CONFIRMED" : "ASSUMED",
    ...(m.basis ? { basis: m.basis } : {}),
    ...(m.confirmed_by ? { confirmedBy: m.confirmed_by } : {}),
  };
}
