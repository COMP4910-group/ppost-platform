/**
 * BasisOfEstimateForm
 *
 * The "cover page" of a Class D estimate: who prepared it, what it covers,
 * what was assumed and what was left out — plus a review / approval flow.
 *
 *   Draft ──Submit──▶ In review ──Approve──▶ Approved
 *     ▲                  │                      │
 *     └──Return to draft─┘      Start new revision (revision + 1)
 *
 * When submitted, the current cost lines are copied into the BOE as a
 * snapshot, so an approved BOE always shows exactly what was approved.
 */

import React, { useMemo } from 'react';
import type { BasisOfEstimate } from '../../types';
import { computeGrandTotal, computeSubtotals, formatCurrency } from '../../utils/calculations';
import {
  accuracyBounds,
  boeChecklist,
  canSubmitForReview,
  estimateChangedSinceSnapshot,
  reviewerProblem,
} from '../../utils/boe';
import { useEstimateLines } from '../../store/estimateStore';
import { setBoe, useBoe } from '../../store/boeStore';
import '../ClassDEstimator/styles.css';
import './styles.css';

const STATUS_LABELS: Record<BasisOfEstimate['status'], string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
};

// ─── Editable list (assumptions / exclusions) ────────────────────────────────

interface ListEditorProps {
  label: string;
  items: string[];
  placeholder: string;
  locked: boolean;
  onChange: (items: string[]) => void;
}

const ListEditor: React.FC<ListEditorProps> = ({ label, items, placeholder, locked, onChange }) => (
  <fieldset className="boe-field boe-list">
    <legend className="boe-label">{label}</legend>
    {locked ? (
      items.filter((i) => i.trim()).length === 0 ? (
        <p className="boe-empty">None listed.</p>
      ) : (
        <ul className="boe-list__readonly">
          {items.filter((i) => i.trim()).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    ) : (
      <>
        {items.map((item, i) => (
          <div key={i} className="boe-list__row">
            <input
              className="cost-input cost-input--text"
              value={item}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`${label} ${i + 1}`}
            />
            <button
              type="button"
              className="cost-btn cost-btn--delete"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="cost-btn cost-btn--quick"
          onClick={() => onChange([...items, ''])}
        >
          + Add {label.toLowerCase().replace(/s$/, '')}
        </button>
      </>
    )}
  </fieldset>
);

// ─── Main form ────────────────────────────────────────────────────────────────

export interface BasisOfEstimateFormProps {
  title?: string;
}

export const BasisOfEstimateForm: React.FC<BasisOfEstimateFormProps> = ({
  title = 'Basis of Estimate',
}) => {
  const boe = useBoe();
  const liveLines = useEstimateLines();

  const isDraft = boe.status === 'draft';
  const locked = !isDraft;

  // Draft: use the live estimate. In review / approved: use the snapshot.
  const lines = isDraft ? liveLines : boe.costLines;
  const total = useMemo(() => computeGrandTotal(computeSubtotals(lines)), [lines]);
  const [low, high] = accuracyBounds(total, boe.accuracyRangePct);
  const fromRateTable = lines.filter((l) => l.rateId).length;
  const liveChanged = !isDraft && estimateChangedSinceSnapshot(boe.costLines, liveLines);

  const checklist = boeChecklist(boe, lines);
  const reviewerIssue = reviewerProblem(boe);

  const patch = (changes: Partial<BasisOfEstimate>) => setBoe({ ...boe, ...changes });

  // ── Status actions ─────────────────────────────────────────────────────
  const submit = () =>
    patch({
      status: 'in_review',
      // keep only filled-in list items, and snapshot the cost lines
      assumptions: boe.assumptions.filter((a) => a.trim()),
      exclusions: boe.exclusions.filter((e) => e.trim()),
      costLines: liveLines.map((l) => ({ ...l })),
    });
  const returnToDraft = () => patch({ status: 'draft', costLines: [] });
  const approve = () => patch({ status: 'approved' });
  const newRevision = () =>
    patch({
      status: 'draft',
      revision: boe.revision + 1,
      reviewedBy: '',
      costLines: [],
      preparedDate: new Date().toISOString().slice(0, 10),
    });

  const setAccuracy = (i: 0 | 1, v: string) => {
    const n = parseFloat(v);
    const next: [number, number] = [...boe.accuracyRangePct];
    next[i] = isNaN(n) ? 0 : n;
    patch({ accuracyRangePct: next });
  };

  return (
    <div className="class-d-estimator boe">
      <header className="estimator-header">
        <h2 className="estimator-title">{title}</h2>
        <span className={`estimator-badge boe-status boe-status--${boe.status}`}>
          {STATUS_LABELS[boe.status]}
        </span>
        <span className="estimator-badge">Rev {boe.revision}</span>
      </header>

      <div className="estimator-body">
        {/* ── Left: the form ───────────────────────────────────────── */}
        <div className="cost-table-wrapper boe-form">
          {locked && (
            <p className="boe-locked">
              {boe.status === 'approved'
                ? 'This revision is approved and locked. Start a new revision to make changes.'
                : 'This BOE is in review. Fields are locked — return it to draft to edit.'}
            </p>
          )}

          <div className="boe-grid">
            <label className="boe-field">
              <span className="boe-label">Incident / project</span>
              <input
                className="cost-input"
                value={boe.incidentId}
                disabled={locked}
                onChange={(e) => patch({ incidentId: e.target.value })}
              />
            </label>

            <label className="boe-field">
              <span className="boe-label">Estimate class</span>
              <select
                className="cost-input cost-input--select"
                value={boe.estimateClass}
                disabled={locked}
                onChange={(e) => {
                  const estimateClass = e.target.value as BasisOfEstimate['estimateClass'];
                  patch(
                    estimateClass === 'D'
                      ? { estimateClass, accuracyRangePct: [-50, 100] }
                      : { estimateClass },
                  );
                }}
              >
                {(['A', 'B', 'C', 'D'] as const).map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </label>

            <div className="boe-field">
              <span className="boe-label">Accuracy range (%)</span>
              <span className="boe-range">
                <input
                  type="number"
                  className="cost-input cost-input--number"
                  value={boe.accuracyRangePct[0]}
                  disabled={locked}
                  onChange={(e) => setAccuracy(0, e.target.value)}
                  aria-label="Accuracy low (%)"
                />
                <span>to</span>
                <input
                  type="number"
                  className="cost-input cost-input--number"
                  value={boe.accuracyRangePct[1]}
                  disabled={locked}
                  onChange={(e) => setAccuracy(1, e.target.value)}
                  aria-label="Accuracy high (%)"
                />
              </span>
            </div>

            <label className="boe-field">
              <span className="boe-label">Prepared by</span>
              <input
                className="cost-input"
                value={boe.preparedBy}
                placeholder="Your name"
                disabled={locked}
                onChange={(e) => patch({ preparedBy: e.target.value })}
              />
            </label>

            <label className="boe-field">
              <span className="boe-label">Prepared date</span>
              <input
                type="date"
                className="cost-input"
                value={boe.preparedDate}
                disabled={locked}
                onChange={(e) => patch({ preparedDate: e.target.value })}
              />
            </label>

            <label className="boe-field">
              <span className="boe-label">Reviewed by</span>
              <input
                className="cost-input"
                value={boe.reviewedBy ?? ''}
                placeholder={boe.status === 'in_review' ? 'Reviewer name' : 'Filled in at review'}
                disabled={boe.status !== 'in_review'}
                onChange={(e) => patch({ reviewedBy: e.target.value })}
              />
            </label>
          </div>

          <label className="boe-field">
            <span className="boe-label">Scope description</span>
            <textarea
              className="cost-input boe-textarea"
              rows={4}
              value={boe.scopeDescription}
              placeholder="What work does this estimate cover? e.g. debris removal and temporary road repair along Highway 5, km 12–18."
              disabled={locked}
              onChange={(e) => patch({ scopeDescription: e.target.value })}
            />
          </label>

          <ListEditor
            label="Assumptions"
            items={boe.assumptions}
            placeholder="e.g. Site access available from week 2"
            locked={locked}
            onChange={(assumptions) => patch({ assumptions })}
          />

          <ListEditor
            label="Exclusions"
            items={boe.exclusions}
            placeholder="e.g. Permanent bridge replacement"
            locked={locked}
            onChange={(exclusions) => patch({ exclusions })}
          />
        </div>

        {/* ── Right: cost summary, checklist, actions ──────────────── */}
        <aside className="summary-panel" aria-label="Basis of estimate summary">
          <h3 className="summary-panel__title">
            Cost basis {isDraft ? '(live estimate)' : '(snapshot)'}
          </h3>
          <table className="summary-table">
            <tbody>
              <tr className="summary-row">
                <td className="summary-row__label">Cost lines</td>
                <td className="summary-row__amount">{lines.length}</td>
              </tr>
              <tr className="summary-row">
                <td className="summary-row__label">From rate table</td>
                <td className="summary-row__amount">
                  {fromRateTable} / {lines.length}
                </td>
              </tr>
              <tr className="summary-row">
                <td className="summary-row__label">Low ({boe.accuracyRangePct[0]}%)</td>
                <td className="summary-row__amount">{formatCurrency(low)}</td>
              </tr>
              <tr className="summary-row">
                <td className="summary-row__label">High (+{boe.accuracyRangePct[1]}%)</td>
                <td className="summary-row__amount">{formatCurrency(high)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="summary-row summary-row--total">
                <td className="summary-row__label">Estimate total</td>
                <td className="summary-row__amount summary-row__amount--grand">
                  {formatCurrency(total)}
                </td>
              </tr>
            </tfoot>
          </table>

          {liveChanged && (
            <p className="boe-warning">
              The estimate has changed since this BOE was submitted. Those
              changes aren't covered — {boe.status === 'approved'
                ? 'start a new revision'
                : 'return to draft'} to include them.
            </p>
          )}

          {isDraft && (
            <>
              <h3 className="summary-panel__title boe-subtitle">Ready for review?</h3>
              <ul className="boe-checklist">
                {checklist.map((c) => (
                  <li key={c.label} className={c.ok ? 'boe-check--ok' : 'boe-check--todo'}>
                    <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.label}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="boe-actions">
            {isDraft && (
              <button
                type="button"
                className="cost-btn cost-btn--add"
                disabled={!canSubmitForReview(boe, liveLines)}
                onClick={submit}
              >
                Submit for review
              </button>
            )}

            {boe.status === 'in_review' && (
              <>
                {reviewerIssue && <p className="boe-hint">{reviewerIssue}</p>}
                <button
                  type="button"
                  className="cost-btn cost-btn--add"
                  disabled={reviewerIssue !== null}
                  onClick={approve}
                >
                  Approve
                </button>
                <button type="button" className="cost-btn cost-btn--quick" onClick={returnToDraft}>
                  Return to draft
                </button>
              </>
            )}

            {boe.status === 'approved' && (
              <>
                <p className="boe-hint">
                  Approved by {boe.reviewedBy}. Prepared by {boe.preparedBy} on{' '}
                  {boe.preparedDate}.
                </p>
                <button type="button" className="cost-btn cost-btn--quick" onClick={newRevision}>
                  Start new revision
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default BasisOfEstimateForm;
