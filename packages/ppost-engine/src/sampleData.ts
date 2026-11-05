/** Synthetic test data — Clearwater Ridge Wildfire (not a real event). */
import { AssessmentQuestion } from './engine/assessment';
import { PpostData } from './engine/matrix';

const t = '2026-10-08T00:00:00.000Z';
const base = { disasterId: 'EV-2026-014', createdAt: t, updatedAt: t };

export const SAMPLE_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'Q-W03',
    text: 'Has the municipal water intake or distribution line experienced pressure loss or power loss?',
    sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-4', unknownPolicy: 'SAFETY',
    problemTitle: 'Water system integrity compromised', severity: 'CRITICAL',
    safetyTactic: { title: 'Issue precautionary boil-water advisory review', strategyId: 'S-PRECAUTION' },
    verification: { title: 'Field-verify water intake and distribution', assignedRole: 'Infrastructure Lead', dueInHours: 48 },
  },
  {
    id: 'Q-H07',
    text: 'Are residential areas downslope of severe burn scars at risk of debris flow?',
    sector: 'HOUSING', priorityId: 'PR-2', unknownPolicy: 'SAFETY',
    problemTitle: 'Debris-flow risk to downslope homes', severity: 'HIGH',
    safetyTactic: { title: 'Precautionary evacuation alert for downslope homes', strategyId: 'S-PRECAUTION' },
    verification: { title: 'Geotechnical debris-flow assessment', assignedRole: 'Infrastructure Lead', dueInHours: 72 },
    followUps: [{ showWhen: 'YES', questionIds: ['Q-H07a'] }],
  },
  {
    id: 'Q-H07a', text: 'Is the evacuation route open?', sector: 'HOUSING', priorityId: 'PR-2',
    unknownPolicy: 'VERIFY', problemWhen: 'NO', problemTitle: 'Evacuation route blocked', severity: 'CRITICAL',
    verification: { title: 'Confirm evacuation route status', assignedRole: 'Planning Section Chief', dueInHours: 24 },
  },
  {
    id: 'Q-F02', text: 'Has a funding application already been submitted?', sector: 'ECONOMY', priorityId: 'PR-8',
    unknownPolicy: 'VERIFY',
    verification: { title: 'Confirm funding application status', assignedRole: 'Finance Section Chief', dueInHours: 72 },
  },
];

/** Priority 6 (Protect Property) chain from the design brief. */
export const SAMPLE_PPOST: PpostData = {
  problems: [
    { ...base, id: 'P-02', title: '42 homes destroyed; households cannot return', source: 'SOURCE_FACT', status: 'APPROVED', priorityId: 'PR-6', sector: 'HOUSING', severity: 'CRITICAL' },
    { ...base, id: 'P-04', title: 'Damage to remaining homes not yet assessed', source: 'RULE', status: 'DRAFT', priorityId: 'PR-6', sector: 'HOUSING', severity: 'HIGH', fromUnknownQuestionId: 'Q-H02' },
  ],
  objectives: [
    { ...base, id: 'O-04', title: 'Provide safe interim housing within 60 days', source: 'HUMAN_DECISION', status: 'APPROVED', problemIds: ['P-02'], horizon: 'IMMEDIATE' },
  ],
  strategies: [
    { ...base, id: 'S-07', title: 'Deploy prefabricated modular units', source: 'HUMAN_DECISION', status: 'APPROVED', objectiveId: 'O-04' },
  ],
  tactics: [
    {
      ...base, id: 'T-014', title: 'Install interim modular housing on 42 destroyed lots', owner: 'L. Tremblay',
      source: 'HUMAN_DECISION', status: 'IN_REVIEW', strategyId: 'S-07', primaryPriorityId: 'PR-6',
      secondaryPriorityIds: ['PR-3'], sector: 'HOUSING', estimateTotal: 2122900,
      successMeasure: '42 units occupied by Nov 30',
      fiveW1H: {
        who: { accountablePerson: 'L. Tremblay', team: 'Regional Housing Taskforce' },
        what: { action: 'Prepare pads, connect utilities, set modular units', deliverable: '42 serviced, occupied units' },
        when: { start: '2026-10-12', end: '2026-11-02', horizon: 'IMMEDIATE' },
        where: { location: 'Clearwater Ridge subdivision', parcelIds: ['42 parcels'] },
        why: { objectiveId: 'O-04', rationale: 'Displaced households need safe interim housing' },
        how: { approach: 'Contracted site works and modular delivery via highway corridor', deliveryMethod: 'CONTRACTOR' },
      },
    },
  ],
};
