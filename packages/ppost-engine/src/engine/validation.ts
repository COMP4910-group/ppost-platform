import { Tactic } from '../model/types';

export interface ValidationIssue {
  field: string;
  message: string;
}

/** Checks a tactic is ready to submit for approval (5W1H + owner). */
export function validateTactic(t: Tactic): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const w = t.fiveW1H;
  if (!t.owner && !w.who?.accountablePerson) issues.push({ field: 'who', message: 'Accountable person is required' });
  if (!w.what?.action) issues.push({ field: 'what', message: 'Action description is required' });
  if (!w.when?.start || !w.when?.end) issues.push({ field: 'when', message: 'Start and end dates are required' });
  else if (w.when.end < w.when.start) issues.push({ field: 'when', message: 'End date is before start date' });
  if (!w.where?.location) issues.push({ field: 'where', message: 'Location is required' });
  if (!w.why?.objectiveId) issues.push({ field: 'why', message: 'Link to an objective is required' });
  if (!w.how?.approach) issues.push({ field: 'how', message: 'Implementation approach is required' });
  if (!t.successMeasure) issues.push({ field: 'successMeasure', message: 'Success measure is required' });
  return issues;
}
