/**
 * Synthetic demo data — Clearwater Ridge Wildfire (NOT a real event).
 * Used until the PPOST tables are wired to Supabase.
 */
import { DEFAULT_PRIORITIES, FiveW1H, Objective, Priority, Problem, Strategy, Tactic } from 'ppost-engine';

export interface PpostState {
  priorities: Priority[];
  problems: Problem[];
  objectives: Objective[];
  strategies: Strategy[];
  tactics: Tactic[];
}

const D = 'EV-2026-014';
const T0 = '2026-10-08T09:00:00.000Z';
const base = { disasterId: D, createdAt: T0, updatedAt: T0 };

const problem = (p: Omit<Problem, 'disasterId' | 'createdAt' | 'updatedAt' | 'source' | 'status'> & Partial<Problem>): Problem =>
  ({ ...base, source: 'SOURCE_FACT', status: 'APPROVED', ...p });
const objective = (o: Omit<Objective, 'disasterId' | 'createdAt' | 'updatedAt' | 'source' | 'status'> & Partial<Objective>): Objective =>
  ({ ...base, source: 'HUMAN_DECISION', status: 'APPROVED', ...o });
const strategy = (s: Omit<Strategy, 'disasterId' | 'createdAt' | 'updatedAt' | 'source' | 'status'> & Partial<Strategy>): Strategy =>
  ({ ...base, source: 'HUMAN_DECISION', status: 'APPROVED', ...s });
const tactic = (t: Omit<Tactic, 'disasterId' | 'createdAt' | 'updatedAt' | 'source' | 'status' | 'fiveW1H'> & Partial<Tactic> & { fiveW1H?: FiveW1H }): Tactic =>
  ({ ...base, source: 'HUMAN_DECISION', status: 'DRAFT', fiveW1H: {}, ...t });

export const SEED: PpostState = {
  priorities: DEFAULT_PRIORITIES,
  problems: [
    problem({ id: 'P-01', priorityId: 'PR-1', sector: 'CRITICAL_INFRASTRUCTURE', severity: 'HIGH', title: 'Unstable burned structures and hazard trees in work zones' }),
    problem({ id: 'P-02', priorityId: 'PR-6', sector: 'HOUSING', severity: 'CRITICAL', title: '42 homes destroyed; households cannot return' }),
    problem({ id: 'P-03', priorityId: 'PR-6', sector: 'HOUSING', severity: 'HIGH', title: 'Burned debris and ash on 42 residential lots' }),
    problem({ id: 'P-04', priorityId: 'PR-6', sector: 'HOUSING', severity: 'HIGH', title: 'Damage to remaining homes not yet assessed', source: 'RULE', status: 'DRAFT', fromUnknownQuestionId: 'Q-H02' }),
    problem({ id: 'P-05', priorityId: 'PR-4', sector: 'CRITICAL_INFRASTRUCTURE', severity: 'CRITICAL', title: 'Water system integrity not verified', source: 'RULE', status: 'DRAFT', fromUnknownQuestionId: 'Q-W03' }),
    problem({ id: 'P-06', priorityId: 'PR-2', sector: 'HOUSING', severity: 'HIGH', title: 'Debris-flow risk to downslope homes' }),
    problem({ id: 'P-07', priorityId: 'PR-3', sector: 'HUMAN_WELLNESS', severity: 'MEDIUM', title: 'Evacuees need psychosocial and income support' }),
    problem({ id: 'P-08', priorityId: 'PR-5', sector: 'CRITICAL_INFRASTRUCTURE', severity: 'HIGH', title: 'Highway bridge approach damaged' }),
    problem({ id: 'P-09', priorityId: 'PR-7', sector: 'ENVIRONMENT', severity: 'MEDIUM', title: 'Erosion and sediment risk to Clearwater Creek' }),
    problem({ id: 'P-10', priorityId: 'PR-8', sector: 'ECONOMY', severity: 'MEDIUM', title: 'Local businesses closed during evacuation' }),
  ],
  objectives: [
    objective({ id: 'O-01', problemIds: ['P-01'], horizon: 'IMMEDIATE', title: 'Make all work zones safe before crews enter' }),
    objective({ id: 'O-04', problemIds: ['P-02'], horizon: 'IMMEDIATE', title: 'Provide safe interim housing for displaced households within 60 days' }),
    objective({ id: 'O-05', problemIds: ['P-03', 'P-04'], horizon: 'MID_TERM', title: 'Clear and secure destroyed lots for rebuild within 6 months' }),
    objective({ id: 'O-06', problemIds: ['P-06'], horizon: 'IMMEDIATE', title: 'Protect downslope residents before winter rains' }),
    objective({ id: 'O-07', problemIds: ['P-07'], horizon: 'IMMEDIATE', title: 'Connect every evacuated household to support services' }),
    objective({ id: 'O-08', problemIds: ['P-08'], horizon: 'MID_TERM', title: 'Restore full highway access' }),
    objective({ id: 'O-09', problemIds: ['P-09'], horizon: 'MID_TERM', title: 'Stabilize burned slopes near the creek' }),
    objective({ id: 'O-10', problemIds: ['P-10'], horizon: 'MID_TERM', title: 'Help local businesses reopen' }),
  ],
  strategies: [
    strategy({ id: 'S-01', objectiveId: 'O-01', title: 'Hazard assessment and removal before entry' }),
    strategy({ id: 'S-07', objectiveId: 'O-04', title: 'Deploy prefabricated modular units' }),
    strategy({ id: 'S-08', objectiveId: 'O-04', title: 'Support owner-led rebuilding' }),
    strategy({ id: 'S-09', objectiveId: 'O-05', title: 'Coordinated residential debris removal program' }),
    strategy({ id: 'S-10', objectiveId: 'O-05', title: 'Lot hazard mitigation and security' }),
    strategy({ id: 'S-11', objectiveId: 'O-06', title: 'Early warning and precautionary evacuation' }),
    strategy({ id: 'S-12', objectiveId: 'O-07', title: 'Single-window recovery support centre' }),
    strategy({ id: 'S-13', objectiveId: 'O-08', title: 'Temporary bridge and detour' }),
    strategy({ id: 'S-14', objectiveId: 'O-10', title: 'Business reopening support' }),
  ],
  tactics: [
    tactic({
      id: 'T-001', strategyId: 'S-01', primaryPriorityId: 'PR-1', sector: 'CRITICAL_INFRASTRUCTURE', owner: 'M. Chen',
      title: 'Hazard tree assessment along work corridors', successMeasure: 'All corridors cleared before crew entry', status: 'APPROVED',
      fiveW1H: {
        who: { accountablePerson: 'M. Chen', team: 'Infrastructure Team' },
        what: { action: 'Assess and flag hazard trees along 12 km of work corridors', deliverable: 'Corridor hazard map' },
        when: { start: '2026-10-10', end: '2026-10-17', horizon: 'IMMEDIATE' },
        where: { location: 'Clearwater Ridge access roads' },
        why: { objectiveId: 'O-01', rationale: 'Crews cannot enter until trees are assessed' },
        how: { approach: 'Certified danger-tree assessors with fallers on standby', deliveryMethod: 'CONTRACTOR' },
      },
    }),
    tactic({
      id: 'T-014', strategyId: 'S-07', primaryPriorityId: 'PR-6', secondaryPriorityIds: ['PR-3'], sector: 'HOUSING', owner: 'L. Tremblay',
      title: 'Install interim modular housing on 42 destroyed lots', successMeasure: '42 units occupied by Nov 30', status: 'IN_REVIEW', estimateTotal: 2122900,
      fiveW1H: {
        who: { accountablePerson: 'L. Tremblay', team: 'Regional Housing Taskforce' },
        what: { action: 'Prepare pads, connect utilities and set modular units', deliverable: '42 serviced, occupied units' },
        when: { start: '2026-10-12', end: '2026-11-02', horizon: 'IMMEDIATE' },
        where: { location: 'Clearwater Ridge subdivision', parcelIds: ['42 destroyed parcels'] },
        why: { objectiveId: 'O-04', rationale: 'Displaced households need safe interim housing' },
        how: { approach: 'Contracted site works; modular delivery via highway corridor', deliveryMethod: 'CONTRACTOR' },
      },
    }),
    tactic({ id: 'T-015', strategyId: 'S-09', primaryPriorityId: 'PR-6', sector: 'HOUSING', owner: 'M. Chen', title: 'Residential lot debris and ash removal', fiveW1H: { when: { horizon: 'IMMEDIATE' } } }),
    tactic({ id: 'T-016', strategyId: 'S-10', primaryPriorityId: 'PR-6', sector: 'HOUSING', owner: 'M. Chen', title: 'Temporary fencing and lot security', status: 'APPROVED', fiveW1H: { when: { horizon: 'IMMEDIATE' } } }),
    tactic({ id: 'T-017', strategyId: 'S-08', primaryPriorityId: 'PR-6', sector: 'HOUSING', owner: 'L. Tremblay', title: 'Open owner rebuild and permit navigation desk', fiveW1H: { when: { horizon: 'MID_TERM' } } }),
    tactic({ id: 'T-018', strategyId: 'S-10', primaryPriorityId: 'PR-6', sector: 'HOUSING', owner: 'M. Chen', title: 'Hazard tree removal near homes', fiveW1H: { when: { horizon: 'MID_TERM' } } }),
    tactic({ id: 'T-020', strategyId: 'S-08', primaryPriorityId: 'PR-6', sector: 'HOUSING', title: 'Insurance and damage documentation support', fiveW1H: { when: { horizon: 'IMMEDIATE' } } }),
    tactic({ id: 'T-021', strategyId: 'S-11', primaryPriorityId: 'PR-2', sector: 'HOUSING', owner: 'A. Singh', title: 'Install rain gauges and debris-flow alert system', fiveW1H: { when: { horizon: 'IMMEDIATE' } } }),
    tactic({ id: 'T-022', strategyId: 'S-12', primaryPriorityId: 'PR-3', sector: 'HUMAN_WELLNESS', title: 'Open recovery support centre', fiveW1H: { when: { horizon: 'IMMEDIATE' } } }),
    tactic({ id: 'T-023', strategyId: 'S-13', primaryPriorityId: 'PR-5', sector: 'CRITICAL_INFRASTRUCTURE', owner: 'M. Chen', title: 'Install temporary modular bridge', fiveW1H: { when: { horizon: 'MID_TERM' } } }),
    tactic({ id: 'T-024', strategyId: 'S-14', primaryPriorityId: 'PR-8', sector: 'ECONOMY', owner: 'R. Okafor', title: 'Small business reopening grants desk', fiveW1H: { when: { horizon: 'MID_TERM' } } }),
  ],
};
