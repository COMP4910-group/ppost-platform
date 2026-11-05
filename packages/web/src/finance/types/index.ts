// ─── Cost Category ───────────────────────────────────────────────────────────

export type CostCategory =
  | 'labour'
  | 'equipment'
  | 'materials'
  | 'subcontractors'
  | 'facility_rental'
  | 'overhead'
  | 'escalation'
  | 'engineering_allowance'
  | 'contingency';

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  labour: 'Labour',
  equipment: 'Equipment',
  materials: 'Materials',
  subcontractors: 'Subcontractors',
  facility_rental: 'Facility Rental',
  overhead: 'Overhead',
  escalation: 'Escalation',
  engineering_allowance: 'Engineering Allowance',
  contingency: 'Contingency',
};

// ─── Cost Line (one row in the Class D estimator) ────────────────────────────

export interface CostLine {
  /** Unique identifier for this line */
  id: string;
  /** Short description of the work item */
  description: string;
  /** Cost category this line belongs to */
  category: CostCategory;
  /** Number of units (people, machines, loads, etc.) */
  quantity: number;
  /** Unit of measure: 'hr', 'day', 'lump', 'each', 'm2', 'm3', etc. */
  unit: string;
  /** Rate per unit per duration period ($/unit/period) */
  unitRate: number;
  /** Number of duration periods (hours, days, months, etc.) */
  duration: number;
  /** Unit of the duration period */
  durationUnit: 'hr' | 'day' | 'wk' | 'mo';
  /**
   * Computed: quantity × unitRate × duration
   * Store for persistence; recalculate on edit.
   */
  totalCost: number;
  /** Notes / justification for this line */
  notes?: string;
  /** Rate table entry this line was filled from (for traceability) */
  rateId?: string;
  /**
   * How this line is priced.
   * 'unit'    (default) → Quantity × Unit Rate × Duration
   * 'percent'           → percent × the costs that come before this category
   *                       (only for overhead, escalation, engineering
   *                       allowance and contingency)
   */
  pricing?: 'unit' | 'percent';
  /** Percentage used when pricing = 'percent', e.g. 10 for 10 % */
  percent?: number;
}

// ─── Rate Table Entry ─────────────────────────────────────────────────────────

export interface RateEntry {
  id: string;
  category: CostCategory;
  /** Resource description (e.g. "Journeyman Electrician") */
  resource: string;
  /** Applicable unit */
  unit: string;
  /** Base rate in local currency per unit */
  baseRate: number;
  /** Optional: provincial/regional rate override */
  regionalRate?: number;
  /** Source / reference (e.g. "BC Hydro Schedule 2026") */
  source?: string;
  effectiveDate: string; // ISO date
}

// ─── Basis of Estimate (BOE) Record ──────────────────────────────────────────

export interface BasisOfEstimate {
  id: string;
  /** Incident / project this BOE belongs to */
  incidentId: string;
  /** Class of estimate: Class D = order-of-magnitude (-50% / +100%) */
  estimateClass: 'A' | 'B' | 'C' | 'D';
  preparedBy: string;
  reviewedBy?: string;
  preparedDate: string; // ISO date
  /** Overall scope description */
  scopeDescription: string;
  /** Assumptions made during estimating */
  assumptions: string[];
  /** Known exclusions */
  exclusions: string[];
  /** Accuracy range, e.g. [-50, 100] meaning -50% to +100% */
  accuracyRangePct: [number, number];
  /** Cost lines that make up this estimate */
  costLines: CostLine[];
  /** Revision number (starts at 0) */
  revision: number;
  status: 'draft' | 'in_review' | 'approved';
}

// ─── Funding Gap ──────────────────────────────────────────────────────────────

export interface FundingSource {
  id: string;
  name: string;
  /** 'eligible' = covered by DFA/NDMP; 'grant' = external (federal, NGO, etc.) */
  type: 'eligible' | 'grant';
  /** Amount confirmed or estimated */
  amount: number;
  /** Whether this amount is confirmed (vs estimated) */
  confirmed: boolean;
  notes?: string;
}

export interface FundingGap {
  /** Gross total from the BOE */
  totalEstimatedCost: number;
  /** Eligible cost portion (DFA/NDMP-covered work) */
  totalEligibleCost: number;
  /** External grants and contributions */
  totalExternalGrants: number;
  /**
   * = totalEstimatedCost − totalEligibleCost − totalExternalGrants
   * This is the remaining burden on the local authority.
   */
  localBurden: number;
  fundingSources: FundingSource[];
}

// ─── Subtotals helper ────────────────────────────────────────────────────────

export type CategorySubtotals = Record<CostCategory, number>;
