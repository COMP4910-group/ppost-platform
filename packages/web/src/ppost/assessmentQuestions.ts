/**
 * Impact assessment question bank (configurable — will move to Settings / Supabase later).
 * Engine fields (unknownPolicy, problemWhen, safetyTactic, verification, followUps) are
 * evaluated by ppost-engine's evaluateAssessment(). UI-only fields: why, hazards, situationFact.
 */
import { Answer, AssessmentQuestion } from 'ppost-engine';

export type Hazard = 'WILDFIRE' | 'FLOOD' | 'ANY';

export interface QuestionUI extends AssessmentQuestion {
  /** "Why we ask" — shown to the assessor. */
  why: string;
  /** Which hazard types this question applies to. */
  hazards: Hazard[];
  /** If the situation report has this fact, suggest this answer (person must confirm). */
  situationFact?: { key: string; suggests: Answer };
  /** Only shown as a follow-up of another question. */
  followUpOf?: string;
}

const verify = (title: string, assignedRole: string, dueInHours: number) => ({ title, assignedRole, dueInHours });

export const QUESTIONS: QuestionUI[] = [
  /* ---------- Human Wellness ---------- */
  {
    id: 'Q-HW01', sector: 'HUMAN_WELLNESS', priorityId: 'PR-3', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Are residents displaced from their homes?',
    why: 'Displacement drives shelter, income support and psychosocial needs from day one.',
    problemTitle: 'Displaced residents need shelter and support', severity: 'HIGH',
    verification: verify('Confirm number of displaced residents', 'Planning Section Chief', 24),
    situationFact: { key: 'evacuees', suggests: 'YES' },
    followUps: [{ showWhen: 'YES', questionIds: ['Q-HW01a'] }],
  },
  {
    id: 'Q-HW01a', followUpOf: 'Q-HW01', sector: 'HUMAN_WELLNESS', priorityId: 'PR-2', hazards: ['ANY'], unknownPolicy: 'SAFETY',
    text: 'Do displaced residents include people with medical or mobility needs?',
    why: 'People who depend on power, medication or mobility aids face the highest risk while displaced.',
    problemTitle: 'Vulnerable evacuees need specialized support', severity: 'CRITICAL',
    safetyTactic: { title: 'Precautionary welfare check of registered vulnerable residents', strategyId: 'S-PRECAUTION' },
    verification: verify('Cross-check evacuee registry for medical needs', 'Planning Section Chief', 24),
  },
  {
    id: 'Q-HW02', sector: 'HUMAN_WELLNESS', priorityId: 'PR-1', hazards: ['WILDFIRE'], unknownPolicy: 'SAFETY',
    text: 'Were responders or residents exposed to heavy smoke, ash or hazardous materials?',
    why: 'Exposure can cause delayed health effects; responder safety is Priority 1.',
    problemTitle: 'Health exposure among responders and residents', severity: 'HIGH',
    safetyTactic: { title: 'Issue precautionary PPE and health-monitoring advisory', strategyId: 'S-PRECAUTION' },
    verification: verify('Collect exposure reports from crews and health authority', 'Recovery Manager', 48),
  },

  /* ---------- Housing ---------- */
  {
    id: 'Q-H01', sector: 'HOUSING', priorityId: 'PR-6', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Were homes destroyed?',
    why: 'Destroyed homes mean households cannot return and need interim housing.',
    problemTitle: 'Homes destroyed; households cannot return', severity: 'CRITICAL',
    verification: verify('Confirm destroyed-home count with building inspectors', 'Housing Lead', 48),
    situationFact: { key: 'homesDestroyed', suggests: 'YES' },
  },
  {
    id: 'Q-H02', sector: 'HOUSING', priorityId: 'PR-6', hazards: ['ANY'], unknownPolicy: 'SAFETY', problemWhen: 'NO',
    text: 'Have damaged (not destroyed) homes been assessed for safe re-entry?',
    why: 'Re-entering an unassessed home risks injury from structural damage, ash or hazardous materials.',
    problemTitle: 'Damaged homes not assessed for safe re-entry', severity: 'HIGH',
    safetyTactic: { title: 'Restrict re-entry to unassessed homes until inspected', strategyId: 'S-PRECAUTION' },
    verification: verify('Rapid damage assessment of remaining homes', 'Infrastructure Lead', 72),
    situationFact: { key: 'homesDamaged', suggests: 'UNKNOWN' },
  },
  {
    id: 'Q-H07', sector: 'HOUSING', priorityId: 'PR-2', hazards: ['WILDFIRE'], unknownPolicy: 'SAFETY',
    text: 'Are residential areas downslope of severe burn scars at risk of debris flow?',
    why: 'Burned slopes can produce fast debris flows in the first heavy rains.',
    problemTitle: 'Debris-flow risk to downslope homes', severity: 'HIGH',
    safetyTactic: { title: 'Precautionary evacuation alert for downslope homes', strategyId: 'S-PRECAUTION' },
    verification: verify('Geotechnical debris-flow assessment', 'Infrastructure Lead', 72),
    followUps: [{ showWhen: 'YES', questionIds: ['Q-H07a'] }],
  },
  {
    id: 'Q-H07a', followUpOf: 'Q-H07', sector: 'HOUSING', priorityId: 'PR-2', hazards: ['WILDFIRE'], unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Is the evacuation route for those homes open?',
    why: 'If the only route is blocked, residents cannot leave when an alert is issued.',
    problemTitle: 'Evacuation route blocked', severity: 'CRITICAL',
    verification: verify('Confirm evacuation route status', 'Planning Section Chief', 24),
  },

  /* ---------- Critical Infrastructure ---------- */
  {
    id: 'Q-W03', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-4', hazards: ['ANY'], unknownPolicy: 'SAFETY',
    text: 'Has the municipal water intake or distribution line experienced pressure loss or power loss?',
    why: 'Pressure loss can let contaminants into drinking water — a public health risk.',
    problemTitle: 'Water system integrity compromised', severity: 'CRITICAL',
    safetyTactic: { title: 'Issue precautionary boil-water advisory review', strategyId: 'S-PRECAUTION' },
    verification: verify('Field-verify water intake and distribution', 'Infrastructure Lead', 48),
    situationFact: { key: 'waterSystem', suggests: 'UNKNOWN' },
  },
  {
    id: 'Q-P01', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-5', hazards: ['ANY'], unknownPolicy: 'SAFETY',
    text: 'Are there power outages or downed lines in the affected area?',
    why: 'Downed lines may still be energized; outages affect water, shelters and medical devices.',
    problemTitle: 'Power outages and downed lines', severity: 'HIGH',
    safetyTactic: { title: 'Treat all lines as energized; notify utility before crews enter', strategyId: 'S-PRECAUTION' },
    verification: verify('Confirm outage map with the utility', 'Infrastructure Lead', 24),
  },
  {
    id: 'Q-R01', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-5', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Are key roads or bridges damaged or closed?',
    why: 'Road access controls how fast crews, supplies and residents can move.',
    problemTitle: 'Road and bridge access damaged', severity: 'HIGH',
    verification: verify('Road and bridge inspection', 'Infrastructure Lead', 48),
  },

  /* ---------- Environment ---------- */
  {
    id: 'Q-E01', sector: 'ENVIRONMENT', priorityId: 'PR-7', hazards: ['WILDFIRE', 'FLOOD'], unknownPolicy: 'VERIFY',
    text: 'Is there a risk of erosion or sediment entering creeks or drinking-water sources?',
    why: 'Bare soil after a fire washes into waterways, harming fish habitat and water treatment.',
    problemTitle: 'Erosion and sediment risk to waterways', severity: 'MEDIUM',
    verification: verify('Post-fire erosion survey', 'Infrastructure Lead', 120),
  },
  {
    id: 'Q-E02', sector: 'ENVIRONMENT', priorityId: 'PR-7', hazards: ['ANY'], unknownPolicy: 'SAFETY',
    text: 'Are there hazardous-material releases (fuel tanks, propane, chemicals, asbestos)?',
    why: 'Burned structures often release asbestos and fuels that endanger crews and residents.',
    problemTitle: 'Hazardous material contamination', severity: 'CRITICAL',
    safetyTactic: { title: 'Cordon suspected hazmat sites pending testing', strategyId: 'S-PRECAUTION' },
    verification: verify('Hazmat screening of destroyed lots', 'Infrastructure Lead', 72),
  },

  /* ---------- Economy ---------- */
  {
    id: 'Q-EC01', sector: 'ECONOMY', priorityId: 'PR-8', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Are local businesses closed because of the event?',
    why: 'Closures cut household income and the local tax base.',
    problemTitle: 'Local businesses closed', severity: 'MEDIUM',
    verification: verify('Business impact survey', 'Finance Section Chief', 120),
  },
  {
    id: 'Q-F02', sector: 'ECONOMY', priorityId: 'PR-8', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Has a disaster funding application already been submitted?',
    why: 'Funding programs have intake deadlines; knowing the status avoids missing them.',
    verification: verify('Confirm funding application status', 'Finance Section Chief', 72),
  },
];

/** Questions that apply to a hazard (ANY questions always apply). */
export const questionsFor = (hazard: Hazard) =>
  QUESTIONS.filter((q) => q.hazards.includes('ANY') || q.hazards.includes(hazard));
