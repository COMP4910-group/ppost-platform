/**
 * FundingGapCalculator
 *
 *   Local burden = Total estimated cost − Eligible costs − External grants
 *
 * Total estimated cost comes from the Class D Estimator automatically.
 * The user can type a different total instead (e.g. to test a scenario).
 *
 * Eligible costs = costs covered by disaster financial assistance programs.
 * External grants = other outside money (federal programs, NGOs, etc.).
 */

import React, { useMemo } from 'react';
import type { FundingSource } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { computeFundingSummary } from '../../utils/funding';
import { useEstimateTotal } from '../../store/estimateStore';
import {
  addFundingSource,
  deleteFundingSource,
  setTotalOverride,
  updateFundingSource,
  useFunding,
} from '../../store/fundingStore';
import '../ClassDEstimator/styles.css';
import './styles.css';

const TYPE_LABELS: Record<FundingSource['type'], string> = {
  eligible: 'Eligible cost',
  grant: 'External grant',
};

export interface FundingGapCalculatorProps {
  title?: string;
}

export const FundingGapCalculator: React.FC<FundingGapCalculatorProps> = ({
  title = 'Funding Gap Calculator',
}) => {
  const estimateTotal = useEstimateTotal();
  const { sources, totalOverride } = useFunding();
  const usingOverride = totalOverride !== null;
  const total = usingOverride ? totalOverride : estimateTotal;

  const summary = useMemo(() => computeFundingSummary(total, sources), [total, sources]);

  const patch = (s: FundingSource, changes: Partial<FundingSource>) =>
    updateFundingSource({ ...s, ...changes });

  const num = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.max(0, n);
  };

  const [low, high] = summary.localBurdenRange;

  return (
    <div className="class-d-estimator funding-gap">
      <header className="estimator-header">
        <h2 className="estimator-title">{title}</h2>
        <span className="estimator-badge">Total − Eligible − Grants = Local burden</span>
      </header>

      <div className="estimator-body">
        {/* ── Left: inputs ─────────────────────────────────────────── */}
        <div className="cost-table-wrapper">
          {/* Total estimated cost */}
          <div className="funding-gap__total">
            <label className="funding-gap__total-label" htmlFor="funding-total">
              Total estimated cost
              <span className="funding-gap__hint">
                {usingOverride
                  ? 'Entered by hand'
                  : 'From the Class D Estimate'}
              </span>
            </label>
            <div className="funding-gap__total-controls">
              <input
                id="funding-total"
                type="number"
                min={0}
                step="0.01"
                className="cost-input cost-input--number funding-gap__total-input"
                value={total}
                onChange={(e) => setTotalOverride(num(e.target.value))}
              />
              {usingOverride && (
                <button
                  type="button"
                  className="cost-btn cost-btn--quick"
                  onClick={() => setTotalOverride(null)}
                  title={`Go back to the Class D total (${formatCurrency(estimateTotal)})`}
                >
                  Use Class D total
                </button>
              )}
            </div>
            {!usingOverride && estimateTotal === 0 && (
              <p className="funding-gap__hint funding-gap__hint--block">
                The Class D Estimate is empty. Add cost lines on the Class D
                Estimates page, or type a total here.
              </p>
            )}
          </div>

          {/* Funding sources */}
          <table className="cost-table">
            <thead>
              <tr>
                <th className="cost-th">Funding source</th>
                <th className="cost-th">Type</th>
                <th className="cost-th cost-th--number">Amount</th>
                <th className="cost-th">Confirmed?</th>
                <th className="cost-th">Notes</th>
                <th className="cost-th cost-th--action" />
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cost-empty">
                    No funding sources yet — add an eligible cost or a grant below.
                  </td>
                </tr>
              ) : (
                sources.map((s) => (
                  <tr key={s.id} className="cost-line-row">
                    <td className="cost-cell">
                      <input
                        className="cost-input cost-input--text"
                        value={s.name}
                        placeholder={
                          s.type === 'eligible'
                            ? 'e.g. Provincial disaster assistance'
                            : 'e.g. Federal infrastructure grant'
                        }
                        onChange={(e) => patch(s, { name: e.target.value })}
                        aria-label="Funding source name"
                      />
                    </td>
                    <td className="cost-cell">
                      <select
                        className="cost-input cost-input--select"
                        value={s.type}
                        onChange={(e) =>
                          patch(s, { type: e.target.value as FundingSource['type'] })
                        }
                        aria-label="Funding type"
                      >
                        <option value="eligible">{TYPE_LABELS.eligible}</option>
                        <option value="grant">{TYPE_LABELS.grant}</option>
                      </select>
                    </td>
                    <td className="cost-cell cost-cell--number">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="cost-input cost-input--number"
                        value={s.amount}
                        onChange={(e) => patch(s, { amount: num(e.target.value) })}
                        aria-label="Amount"
                      />
                    </td>
                    <td className="cost-cell funding-gap__confirmed">
                      <label>
                        <input
                          type="checkbox"
                          checked={s.confirmed}
                          onChange={(e) => patch(s, { confirmed: e.target.checked })}
                        />{' '}
                        {s.confirmed ? 'Confirmed' : 'Expected'}
                      </label>
                    </td>
                    <td className="cost-cell">
                      <input
                        className="cost-input cost-input--text"
                        value={s.notes ?? ''}
                        placeholder="Optional"
                        onChange={(e) => patch(s, { notes: e.target.value })}
                        aria-label="Notes"
                      />
                    </td>
                    <td className="cost-cell cost-cell--action">
                      <button
                        type="button"
                        className="cost-btn cost-btn--delete"
                        onClick={() => deleteFundingSource(s.id)}
                        aria-label={`Delete funding source: ${s.name || 'unnamed'}`}
                        title="Remove funding source"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="add-line-bar">
            <button
              type="button"
              className="cost-btn cost-btn--add"
              onClick={() => addFundingSource('eligible')}
            >
              + Eligible cost
            </button>
            <button
              type="button"
              className="cost-btn cost-btn--add"
              onClick={() => addFundingSource('grant')}
            >
              + External grant
            </button>
          </div>
        </div>

        {/* ── Right: result ────────────────────────────────────────── */}
        <aside className="summary-panel" aria-label="Funding gap summary">
          <h3 className="summary-panel__title">Funding Gap</h3>
          <table className="summary-table">
            <tbody>
              <tr className="summary-row">
                <td className="summary-row__label">Total estimated cost</td>
                <td className="summary-row__amount">{formatCurrency(summary.totalEstimatedCost)}</td>
              </tr>
              <tr className="summary-row">
                <td className="summary-row__label">− Eligible costs</td>
                <td className="summary-row__amount">{formatCurrency(summary.totalEligibleCost)}</td>
              </tr>
              <tr className="summary-row">
                <td className="summary-row__label">− External grants</td>
                <td className="summary-row__amount">{formatCurrency(summary.totalExternalGrants)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="summary-row summary-row--total">
                <td className="summary-row__label">= Local burden</td>
                <td className="summary-row__amount summary-row__amount--grand">
                  {formatCurrency(summary.localBurden)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Coverage bar */}
          <div className="funding-gap__coverage">
            <div className="funding-gap__coverage-label">
              <span>Covered by funding</span>
              <span>{summary.coveragePct.toFixed(0)}%</span>
            </div>
            <div
              className="funding-gap__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(summary.coveragePct)}
            >
              <div
                className="funding-gap__bar-fill"
                style={{ width: `${summary.coveragePct}%` }}
              />
            </div>
          </div>

          {/* Extra insights */}
          <ul className="funding-gap__notes">
            {summary.overFunded > 0 && (
              <li className="funding-gap__note funding-gap__note--warn">
                Funding is {formatCurrency(summary.overFunded)} more than the
                estimated cost. Check the amounts.
              </li>
            )}
            {summary.confirmedLocalBurden !== summary.localBurden && (
              <li className="funding-gap__note">
                If only <strong>confirmed</strong> funding arrives, local burden
                is {formatCurrency(summary.confirmedLocalBurden)}.
              </li>
            )}
            {summary.totalEstimatedCost > 0 && (
              <li className="funding-gap__note">
                Class D range (−50 % / +100 %): local burden could be{' '}
                {formatCurrency(low)} to {formatCurrency(high)}.
              </li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default FundingGapCalculator;
