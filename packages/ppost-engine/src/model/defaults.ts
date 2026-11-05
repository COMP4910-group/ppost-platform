import { Priority, SectorId } from './types';

/** The 8-tier priority hierarchy (BCEMS-style). Configurable — these are only defaults. */
export const DEFAULT_PRIORITIES: Priority[] = [
  { id: 'PR-1', rank: 1, name: 'Responder Safety & Health', active: true },
  { id: 'PR-2', rank: 2, name: 'Save Lives', active: true },
  { id: 'PR-3', rank: 3, name: 'Reduce Suffering', active: true },
  { id: 'PR-4', rank: 4, name: 'Protect Public Health', active: true },
  { id: 'PR-5', rank: 5, name: 'Protect Government Infrastructure', active: true },
  { id: 'PR-6', rank: 6, name: 'Protect Property', active: true },
  { id: 'PR-7', rank: 7, name: 'Protect the Environment', active: true },
  { id: 'PR-8', rank: 8, name: 'Reduce Economic & Social Losses', active: true },
];

export const SECTORS: { id: SectorId; label: string; optional?: boolean }[] = [
  { id: 'HUMAN_WELLNESS', label: 'Human Wellness' },
  { id: 'HOUSING', label: 'Housing' },
  { id: 'ENVIRONMENT', label: 'Environment' },
  { id: 'ECONOMY', label: 'Economy' },
  { id: 'CRITICAL_INFRASTRUCTURE', label: 'Critical Infrastructure' },
  { id: 'GOVERNANCE', label: 'Governance', optional: true },
];

/** Sort priorities by rank and drop inactive ones. */
export function orderedPriorities(priorities: Priority[] = DEFAULT_PRIORITIES): Priority[] {
  return [...priorities].filter((p) => p.active).sort((a, b) => a.rank - b.rank);
}
