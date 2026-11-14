/**
 * RateTable
 *
 * View and edit the standard rates used by the Class D Estimator.
 * Every change is saved straight away through the rate store, so the
 * estimator picks it up immediately.
 *
 * Effective rate = Regional rate if one is entered, otherwise Base rate.
 */

import React, { useMemo, useState } from 'react';
import type { CostCategory, RateEntry } from '../../types';
import { COST_CATEGORY_LABELS } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { effectiveRate } from '../../utils/rates';
import {
  addRate,
  deleteRate,
  resetRates,
  updateRate,
  useRates,
} from '../../store/rateStore';
import '../ClassDEstimator/styles.css';
import './styles.css';

const CATEGORIES = Object.entries(COST_CATEGORY_LABELS) as Array<[CostCategory, string]>;
const ALL = 'all';

export interface RateTableProps {
  title?: string;
  editable?: boolean;
}

export const RateTable: React.FC<RateTableProps> = ({
  title = 'Rate Table',
  editable = true,
}) => {
  const rates = useRates();
  const [filter, setFilter] = useState<CostCategory | typeof ALL>(ALL);
  const [search, setSearch] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // Filter, then group by category in the standard category order
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = rates.filter(
      (r) =>
        (filter === ALL || r.category === filter) &&
        (q === '' ||
          r.resource.toLowerCase().includes(q) ||
          (r.source ?? '').toLowerCase().includes(q)),
    );
    return CATEGORIES.map(([cat, label]) => ({
      cat,
      label,
      items: visible.filter((r) => r.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [rates, filter, search]);

  const colSpan = editable ? 9 : 8;

  const patch = (rate: RateEntry, changes: Partial<RateEntry>) =>
    updateRate({ ...rate, ...changes });

  const num = (value: string): number => {
    const n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  };

  const handleReset = () => {
    if (confirmReset) {
      resetRates();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
    }
  };

  return (
    <div className="class-d-estimator rate-table">
      <header className="estimator-header">
        <h2 className="estimator-title">{title}</h2>
        <span className="estimator-badge">{rates.length} rates</span>
      </header>

      <p className="rate-table__notice">
        Starter rates are <strong>sample values</strong>. Replace them with the
        client's approved rate schedule before using an estimate for real
        decisions. Effective rate = Regional rate if entered, otherwise Base rate.
      </p>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="rate-table__toolbar">
        <input
          type="search"
          className="cost-input cost-input--text rate-table__search"
          placeholder="Search resource or source…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search rates"
        />
        <select
          className="cost-input cost-input--select rate-table__filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as CostCategory | typeof ALL)}
          aria-label="Filter by category"
        >
          <option value={ALL}>All categories</option>
          {CATEGORIES.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        {editable && (
          <>
            <button
              type="button"
              className="cost-btn cost-btn--add"
              onClick={() => addRate({ category: filter === ALL ? 'labour' : filter })}
            >
              + Add rate
            </button>
            <button
              type="button"
              className={`cost-btn cost-btn--quick${confirmReset ? ' rate-table__reset--confirm' : ''}`}
              onClick={handleReset}
              onBlur={() => setConfirmReset(false)}
              title="Throw away all edits and restore the sample rates"
            >
              {confirmReset ? 'Click again to reset' : 'Reset to sample rates'}
            </button>
          </>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="cost-table-wrapper rate-table__wrapper">
        <table className="cost-table">
          <thead>
            <tr>
              <th className="cost-th">Resource</th>
              <th className="cost-th">Category</th>
              <th className="cost-th">Unit</th>
              <th className="cost-th cost-th--number">Base rate</th>
              <th className="cost-th cost-th--number">Regional rate</th>
              <th className="cost-th cost-th--total">Effective</th>
              <th className="cost-th">Source</th>
              <th className="cost-th">Effective date</th>
              {editable && <th className="cost-th cost-th--action" />}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="cost-empty">
                  {rates.length === 0
                    ? 'No rates yet — click "Add rate" to start.'
                    : 'No rates match your search.'}
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <React.Fragment key={g.cat}>
                  <tr className="cost-category-header">
                    <td colSpan={colSpan} className="cost-category-label">
                      {g.label}
                      <span className="cost-category-subtotal">{g.items.length}</span>
                    </td>
                  </tr>
                  {g.items.map((rate) => (
                    <tr key={rate.id} className="cost-line-row">
                      <td className="cost-cell">
                        {editable ? (
                          <input
                            className="cost-input cost-input--text"
                            value={rate.resource}
                            placeholder="Resource name"
                            onChange={(e) => patch(rate, { resource: e.target.value })}
                            aria-label="Resource"
                          />
                        ) : (
                          rate.resource
                        )}
                      </td>
                      <td className="cost-cell">
                        {editable ? (
                          <select
                            className="cost-input cost-input--select"
                            value={rate.category}
                            onChange={(e) =>
                              patch(rate, { category: e.target.value as CostCategory })
                            }
                            aria-label="Category"
                          >
                            {CATEGORIES.map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          COST_CATEGORY_LABELS[rate.category]
                        )}
                      </td>
                      <td className="cost-cell">
                        {editable ? (
                          <input
                            className="cost-input cost-input--text cost-input--short"
                            value={rate.unit}
                            placeholder="hr"
                            onChange={(e) => patch(rate, { unit: e.target.value })}
                            aria-label="Unit"
                          />
                        ) : (
                          rate.unit
                        )}
                      </td>
                      <td className="cost-cell cost-cell--number">
                        {editable ? (
                          <input
                            type="number"
                            className="cost-input cost-input--number"
                            min={0}
                            step="0.01"
                            value={rate.baseRate}
                            onChange={(e) => patch(rate, { baseRate: num(e.target.value) })}
                            aria-label="Base rate"
                          />
                        ) : (
                          formatCurrency(rate.baseRate)
                        )}
                      </td>
                      <td className="cost-cell cost-cell--number">
                        {editable ? (
                          <input
                            type="number"
                            className="cost-input cost-input--number"
                            min={0}
                            step="0.01"
                            placeholder="—"
                            value={rate.regionalRate ?? ''}
                            onChange={(e) =>
                              patch(rate, {
                                regionalRate:
                                  e.target.value === '' ? undefined : num(e.target.value),
                              })
                            }
                            aria-label="Regional rate (optional)"
                          />
                        ) : rate.regionalRate !== undefined ? (
                          formatCurrency(rate.regionalRate)
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="cost-cell cost-cell--total">
                        {formatCurrency(effectiveRate(rate))}
                        <span className="rate-table__per">/{rate.unit || 'unit'}</span>
                      </td>
                      <td className="cost-cell">
                        {editable ? (
                          <input
                            className="cost-input cost-input--text"
                            value={rate.source ?? ''}
                            placeholder="Where this rate comes from"
                            onChange={(e) => patch(rate, { source: e.target.value })}
                            aria-label="Source"
                          />
                        ) : (
                          rate.source ?? '—'
                        )}
                      </td>
                      <td className="cost-cell">
                        {editable ? (
                          <input
                            type="date"
                            className="cost-input"
                            value={rate.effectiveDate}
                            onChange={(e) => patch(rate, { effectiveDate: e.target.value })}
                            aria-label="Effective date"
                          />
                        ) : (
                          rate.effectiveDate
                        )}
                      </td>
                      {editable && (
                        <td className="cost-cell cost-cell--action">
                          <button
                            type="button"
                            className="cost-btn cost-btn--delete"
                            onClick={() => deleteRate(rate.id)}
                            aria-label={`Delete rate: ${rate.resource || 'unnamed'}`}
                            title="Remove rate"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RateTable;
