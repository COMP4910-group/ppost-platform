import type { BasisOfEstimate, CostLine } from '../types';
import { computeGrandTotal, computeSubtotals } from './calculations';

export interface ChecklistItem {
  label: string;
  ok: boolean;
}

/** What must be filled in before a BOE can go to review. */
export function boeChecklist(boe: BasisOfEstimate, lines: readonly CostLine[]): ChecklistItem[] {
  const total = computeGrandTotal(computeSubtotals(lines));
  return [
    { label: 'Incident / project named', ok: boe.incidentId.trim() !== '' },
    { label: 'Prepared by filled in', ok: boe.preparedBy.trim() !== '' },
    { label: 'Scope described', ok: boe.scopeDescription.trim() !== '' },
    { label: 'At least one assumption', ok: boe.assumptions.some((a) => a.trim() !== '') },
    { label: 'At least one exclusion', ok: boe.exclusions.some((e) => e.trim() !== '') },
    { label: 'Estimate has cost lines with a total above $0', ok: lines.length > 0 && total > 0 },
  ];
}

export function canSubmitForReview(boe: BasisOfEstimate, lines: readonly CostLine[]): boolean {
  return boe.status === 'draft' && boeChecklist(boe, lines).every((c) => c.ok);
}

/** Reviewer must be named and must not be the same person as the preparer. */
export function reviewerProblem(boe: BasisOfEstimate): string | null {
  const reviewer = (boe.reviewedBy ?? '').trim();
  if (reviewer === '') return 'Enter the reviewer’s name to approve.';
  if (reviewer.toLowerCase() === boe.preparedBy.trim().toLowerCase()) {
    return 'The reviewer must be a different person from the preparer.';
  }
  return null;
}

/** Low / high cost given the BOE accuracy range, e.g. [-50, 100]. */
export function accuracyBounds(total: number, rangePct: [number, number]): [number, number] {
  return [
    Math.max(0, total * (1 + rangePct[0] / 100)),
    Math.max(0, total * (1 + rangePct[1] / 100)),
  ];
}

/** True when the live estimate no longer matches the BOE snapshot. */
export function estimateChangedSinceSnapshot(
  snapshot: readonly CostLine[],
  live: readonly CostLine[],
): boolean {
  if (snapshot.length !== live.length) return true;
  return snapshot.some((s, i) => {
    const l = live[i];
    return (
      !l ||
      s.id !== l.id ||
      s.totalCost !== l.totalCost ||
      s.description !== l.description ||
      s.category !== l.category
    );
  });
}
