/**
 * Core PPOST data model.
 * Disaster → Priority → Problem → Objective → Strategy → Tactic
 * These shapes mirror the PostgreSQL tables (see sql/001_ppost_schema.sql).
 */

/** Three-state answer. UNKNOWN is stored as UNKNOWN — never converted to YES/NO. */
export type Answer = 'YES' | 'NO' | 'UNKNOWN';

export type SectorId =
  | 'HUMAN_WELLNESS'
  | 'HOUSING'
  | 'ENVIRONMENT'
  | 'ECONOMY'
  | 'CRITICAL_INFRASTRUCTURE'
  | 'GOVERNANCE';

export type TimeHorizon = 'IMMEDIATE' | 'MID_TERM' | 'LONG_TERM';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RecordStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';

/** Where a record came from — shown as a provenance chip in the UI. */
export type Source = 'SOURCE_FACT' | 'HUMAN_DECISION' | 'AI_SUGGESTION' | 'RULE' | 'ASSUMPTION';

/** Fields every PPOST entity carries. */
export interface BaseRecord {
  id: string;          // e.g. "P-02", "T-014"
  disasterId: string;  // e.g. "EV-2026-014"
  title: string;
  description?: string;
  owner?: string;      // missing owner is a validation error on tactics
  source: Source;
  status: RecordStatus;
  createdAt: string;   // ISO date
  updatedAt: string;
}

export interface Disaster {
  id: string;
  name: string;
  hazardTypes: string[];   // required (at least one)
  location: string;        // required
  declaredAt?: string;     // optional — may be unknown
  activeSectors: SectorId[];
}

export interface Priority {
  id: string;       // "PR-1"
  rank: number;     // 1 = highest (Responder Safety & Health)
  name: string;
  active: boolean;
}

export interface Problem extends BaseRecord {
  priorityId: string;
  sector: SectorId;
  severity: Severity;
  /** Set when this problem was generated from an UNKNOWN answer. */
  fromUnknownQuestionId?: string;
}

export interface Objective extends BaseRecord {
  problemIds: string[];   // an objective can address more than one problem
  horizon: TimeHorizon;
}

export interface Strategy extends BaseRecord {
  objectiveId: string;
}

/** 5W1H action definition attached to every tactic. */
export interface FiveW1H {
  who?: { accountablePerson?: string; team?: string; supportingRoles?: string[] };
  what?: { action?: string; deliverable?: string };
  when?: { start?: string; end?: string; horizon?: TimeHorizon };
  where?: { location?: string; parcelIds?: string[] };
  why?: { objectiveId?: string; rationale?: string };
  how?: { approach?: string; deliveryMethod?: 'CONTRACTOR' | 'IN_HOUSE' | 'PARTNER' | 'MUTUAL_AID' };
}

export interface Tactic extends BaseRecord {
  strategyId: string;
  /** Cost is counted once, under this priority. */
  primaryPriorityId: string;
  secondaryPriorityIds?: string[];
  sector: SectorId;
  fiveW1H: FiveW1H;
  successMeasure?: string;
  estimateTotal?: number;  // Class D total (owned by the finance package)
  safetyPrecaution?: boolean; // true when auto-created by an UNKNOWN rule
}

export interface VerificationTask {
  id: string;
  disasterId: string;
  questionId: string;
  title: string;
  assignedRole: string;
  dueInHours: number;
  status: 'OPEN' | 'CLOSED';
}
