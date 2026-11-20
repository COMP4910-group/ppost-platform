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
  /** Only shown as a follow-up of another question (appears automatically after the trigger answer). */
  followUpOf?: string;
  /** A "deeper question" for this question id — shown only when the user opens "Ask deeper questions". */
  deepOf?: string;
  /** Where the question came from. Built-in questions are written by the PPOST team. */
  origin?: 'BUILT_IN' | 'AI_FROM_DOCUMENTS';
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

/* ---------- more main questions ---------- */
QUESTIONS.push(
  {
    id: 'Q-HW03', sector: 'HUMAN_WELLNESS', priorityId: 'PR-3', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Are reception centres or group lodging near capacity?',
    why: 'Full reception centres mean evacuees may be turned away or sent far from home.',
    problemTitle: 'Reception centres near capacity', severity: 'HIGH',
    verification: verify('Get occupancy numbers from reception centres', 'Planning Section Chief', 24),
  },
  {
    id: 'Q-H03', sector: 'HOUSING', priorityId: 'PR-3', hazards: ['ANY'], unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Are rental or temporary housing options available locally for displaced households?',
    why: 'If there is nothing to rent locally, interim modular housing or hotel programs are needed.',
    problemTitle: 'Not enough local temporary housing', severity: 'HIGH',
    verification: verify('Survey local rental and hotel vacancy', 'Housing Lead', 72),
  },
  {
    id: 'Q-CI04', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-2', hazards: ['ANY'], unknownPolicy: 'SAFETY',
    text: 'Are telecommunications (cell, internet, 911) disrupted in the affected area?',
    why: 'Without phones and 911, residents cannot call for help or receive alerts.',
    problemTitle: 'Telecommunications disrupted', severity: 'HIGH',
    safetyTactic: { title: 'Set up satellite phones and an emergency comms point', strategyId: 'S-PRECAUTION' },
    verification: verify('Confirm network status with carriers', 'Infrastructure Lead', 24),
  },
  {
    id: 'Q-E03', sector: 'ENVIRONMENT', priorityId: 'PR-7', hazards: ['WILDFIRE', 'FLOOD'], unknownPolicy: 'VERIFY',
    text: 'Is wildlife, fish habitat or a species at risk affected?',
    why: 'Habitat damage can need permits and specialist restoration work.',
    problemTitle: 'Wildlife and habitat damage', severity: 'MEDIUM',
    verification: verify('Habitat survey with provincial biologist', 'Infrastructure Lead', 168),
  },
  {
    id: 'Q-EC02', sector: 'ECONOMY', priorityId: 'PR-8', hazards: ['ANY'], unknownPolicy: 'VERIFY',
    text: 'Are tourism, agriculture or forestry operations affected?',
    why: 'Primary industries often employ most of a rural community.',
    problemTitle: 'Primary industries disrupted', severity: 'MEDIUM',
    verification: verify('Contact industry associations for impact estimates', 'Finance Section Chief', 120),
  },
  {
    id: 'Q-G01', sector: 'GOVERNANCE', priorityId: 'PR-5', hazards: ['ANY'], unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Can the local government run normal services (staff, offices, records, IT)?',
    why: 'Recovery depends on a working local government; the Governance sector covers this.',
    problemTitle: 'Local government services disrupted', severity: 'HIGH',
    verification: verify('Check staff, facilities and systems status', 'Recovery Manager', 48),
  },
);

/* ---------- deeper questions (opened with "Ask deeper questions") ---------- */
const deep = (deepOf: string, q: Omit<QuestionUI, 'deepOf' | 'hazards'> & { hazards?: Hazard[] }): QuestionUI =>
  ({ hazards: ['ANY'], ...q, deepOf });

export const DEEP_QUESTIONS: QuestionUI[] = [
  deep('Q-W03', {
    id: 'Q-W03-D1', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-4', unknownPolicy: 'SAFETY',
    text: 'Are hospitals, care homes or clinics served by this water system?',
    why: 'Health facilities cannot operate safely without trusted water.',
    problemTitle: 'Health facilities on an unverified water supply', severity: 'CRITICAL',
    safetyTactic: { title: 'Arrange temporary potable water for health facilities', strategyId: 'S-PRECAUTION' },
    verification: verify('Confirm water status at each health facility', 'Infrastructure Lead', 24),
  }),
  deep('Q-W03', {
    id: 'Q-W03-D2', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-4', unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Is an alternate drinking-water supply (bottled water, tankers) in place?',
    why: 'Decides whether water distribution must start now.',
    problemTitle: 'No alternate drinking-water supply', severity: 'HIGH',
    verification: verify('Confirm bottled water / tanker arrangements', 'Planning Section Chief', 24),
  }),
  deep('Q-W03', {
    id: 'Q-W03-D3', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-4', unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Has the water been sampled and lab-tested since the event?',
    why: 'Lab results are what allow an advisory to be lifted.',
    problemTitle: 'Water quality not sampled', severity: 'HIGH',
    verification: verify('Collect and lab-test water samples', 'Infrastructure Lead', 48),
  }),
  deep('Q-H01', {
    id: 'Q-H01-D1', sector: 'HOUSING', priorityId: 'PR-6', unknownPolicy: 'VERIFY',
    text: 'Do destroyed homes include rentals, mobile homes or First Nations housing?',
    why: 'Renters and on-reserve housing follow different programs and funding rules.',
    problemTitle: 'Displaced renters and specialized housing needs', severity: 'HIGH',
    verification: verify('Break down destroyed homes by tenure type', 'Housing Lead', 72),
  }),
  deep('Q-H01', {
    id: 'Q-H01-D2', sector: 'HOUSING', priorityId: 'PR-8', unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Do most affected owners have home insurance?',
    why: 'Uninsured households need much more public support to rebuild.',
    problemTitle: 'Uninsured or under-insured households', severity: 'HIGH',
    verification: verify('Insurance survey of affected households', 'Housing Lead', 120),
  }),
  deep('Q-H01', {
    id: 'Q-H01-D3', sector: 'HOUSING', priorityId: 'PR-1', unknownPolicy: 'SAFETY', problemWhen: 'NO',
    text: 'Have destroyed lots been screened for asbestos and hazardous materials before clearing?',
    why: 'Clearing unscreened lots exposes crews and neighbours to asbestos.',
    problemTitle: 'Destroyed lots not screened for hazardous materials', severity: 'CRITICAL',
    safetyTactic: { title: 'No lot clearing until hazmat screening is done', strategyId: 'S-PRECAUTION' },
    verification: verify('Hazmat screening of destroyed lots', 'Infrastructure Lead', 72),
  }),
  deep('Q-HW01', {
    id: 'Q-HW01-D1', sector: 'HUMAN_WELLNESS', priorityId: 'PR-3', unknownPolicy: 'VERIFY',
    text: 'Do displaced residents need language, cultural or Elder supports?',
    why: 'Supports that fit the community make services usable.',
    problemTitle: 'Language and cultural support needs', severity: 'MEDIUM',
    verification: verify('Ask community liaisons about support needs', 'Planning Section Chief', 72),
  }),
  deep('Q-HW01', {
    id: 'Q-HW01-D2', sector: 'HUMAN_WELLNESS', priorityId: 'PR-3', unknownPolicy: 'VERIFY',
    text: 'Are pets or livestock displaced with their owners?',
    why: 'People may refuse to evacuate or shelter without their animals.',
    problemTitle: 'Displaced animals need care', severity: 'MEDIUM',
    verification: verify('Count animals registered at reception centres', 'Planning Section Chief', 48),
  }),
  deep('Q-P01', {
    id: 'Q-P01-D1', sector: 'HUMAN_WELLNESS', priorityId: 'PR-2', unknownPolicy: 'SAFETY',
    text: 'Are any residents dependent on powered medical equipment?',
    why: 'Oxygen concentrators and similar devices fail within hours without power.',
    problemTitle: 'Residents on powered medical equipment without power', severity: 'CRITICAL',
    safetyTactic: { title: 'Provide generators or relocate medically dependent residents', strategyId: 'S-PRECAUTION' },
    verification: verify('Check health authority list of power-dependent clients', 'Planning Section Chief', 12),
  }),
  deep('Q-P01', {
    id: 'Q-P01-D2', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-5', unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Has the utility given an estimated restoration time?',
    why: 'The restoration time decides whether temporary power is worth the cost.',
    problemTitle: 'No power restoration timeline', severity: 'MEDIUM',
    verification: verify('Request restoration estimate from the utility', 'Infrastructure Lead', 24),
  }),
  deep('Q-R01', {
    id: 'Q-R01-D1', sector: 'CRITICAL_INFRASTRUCTURE', priorityId: 'PR-5', unknownPolicy: 'VERIFY', problemWhen: 'NO',
    text: 'Is there a detour heavy trucks can use?',
    why: 'Modular homes, debris trucks and supplies need a heavy-vehicle route.',
    problemTitle: 'No heavy-vehicle detour', severity: 'HIGH',
    verification: verify('Confirm detour load limits with transportation ministry', 'Infrastructure Lead', 48),
  }),
  deep('Q-R01', {
    id: 'Q-R01-D2', sector: 'HUMAN_WELLNESS', priorityId: 'PR-3', unknownPolicy: 'VERIFY',
    text: 'Are schools, clinics or grocery stores cut off by the closure?',
    why: 'Cut-off essential services make it hard for residents to return.',
    problemTitle: 'Essential services cut off by road closures', severity: 'HIGH',
    verification: verify('Map essential services against closed roads', 'Planning Section Chief', 48),
  }),
  deep('Q-E02', {
    id: 'Q-E02-D1', sector: 'ENVIRONMENT', priorityId: 'PR-7', unknownPolicy: 'SAFETY', problemWhen: 'NO',
    text: 'Has the release been reported to the provincial environmental emergency line?',
    why: 'Reporting is required and brings specialist response.',
    problemTitle: 'Hazmat release not yet reported to authorities', severity: 'HIGH',
    safetyTactic: { title: 'Report release to the environmental emergency line', strategyId: 'S-PRECAUTION' },
    verification: verify('Confirm report number with the province', 'Recovery Manager', 12),
  }),
  deep('Q-EC01', {
    id: 'Q-EC01-D1', sector: 'ECONOMY', priorityId: 'PR-8', unknownPolicy: 'VERIFY',
    text: 'Are workers losing income because of the closures?',
    why: 'Lost wages drive household hardship and out-migration.',
    problemTitle: 'Lost income for local workers', severity: 'MEDIUM',
    verification: verify('Estimate affected workers with business groups', 'Finance Section Chief', 120),
  }),
  deep('Q-EC01', {
    id: 'Q-EC01-D2', sector: 'ECONOMY', priorityId: 'PR-8', unknownPolicy: 'VERIFY',
    text: 'Do businesses need help applying for grants or loans?',
    why: 'Small businesses often miss programs because applications are complex.',
    problemTitle: 'Businesses need help accessing grants or loans', severity: 'MEDIUM',
    verification: verify('Business support needs survey', 'Finance Section Chief', 120),
  }),
];

/** Questions that apply to a hazard (ANY questions always apply). */
export const questionsFor = (hazard: Hazard, extra: QuestionUI[] = []) =>
  [...QUESTIONS, ...DEEP_QUESTIONS, ...extra].filter((q) => q.hazards.includes('ANY') || q.hazards.includes(hazard));

/** Deeper questions available for a question. */
export const deepQuestionsOf = (all: QuestionUI[], id: string) => all.filter((q) => q.deepOf === id);
