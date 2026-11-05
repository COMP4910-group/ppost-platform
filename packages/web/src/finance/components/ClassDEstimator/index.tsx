/**
 * ClassDEstimator
 *
 * Top-level component for the Class D (order-of-magnitude) cost estimator.
 *
 * Formula: Cost = Quantity × Unit Rate × Duration
 *
 * Props
 * ─────
 * initialLines  – pre-populated cost lines (e.g. loaded from DB)
 * onChange      – called whenever any line is added, updated, or removed;
 *                 use this to persist state to your backend
 * editable      – defaults to true; pass false for a read-only view
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { CostCategory, CostLine, RateEntry } from '../../types';
import { COST_CATEGORY_LABELS } from '../../types';
import {
  computeGrandTotal,
  computeSubtotals,
  formatCurrency,
  newId,
} from '../../utils/calculations';
import { applyRateToLine, effectiveRate } from '../../utils/rates';
import { useRates } from '../../store/rateStore';
import {
  DEFAULT_PERCENT_CATEGORIES,
  PERCENT_CATEGORIES,
  percentBaseFor,
  resolveLineCosts,
} from '../../utils/percent';
import { CostLineRow } from './CostLineRow';
import { SummaryPanel } from './SummaryPanel';
import './styles.css';

// ─── Default blank line factory ───────────────────────────────────────────────

function makeBlankLine(category: CostCategory = 'labour'): CostLine {
  return {
    id: newId(),
    description: '',
    category,
    quantity: 1,
    unit: 'hr',
    unitRate: 0,
    duration: 1,
    durationUnit: 'day',
    totalCost: 0,
  };
}

/** Escalation, engineering allowance and contingency start as a % line. */
function makeQuickLine(category: CostCategory): CostLine {
  const line = makeBlankLine(category);
  if (!DEFAULT_PERCENT_CATEGORIES.includes(category)) return line;
  return {
    ...line,
    description: COST_CATEGORY_LABELS[category],
    pricing: 'percent',
    percent: 0,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ClassDEstimatorProps {
  initialLines?: CostLine[];
  onChange?: (lines: CostLine[]) => void;
  editable?: boolean;
  /** Title shown in the table header */
  title?: string;
  /** Override the rate table (defaults to the shared rate store) */
  rates?: RateEntry[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ClassDEstimator: React.FC<ClassDEstimatorProps> = ({
  initialLines = [],
  onChange,
  editable = true,
  title = 'Class D Cost Estimate',
  rates,
}) => {
  const storeRates = useRates();
  const rateList = rates ?? storeRates;

  // totalCost is always recalculated, so % lines stay in step with the rest
  const [lines, setLines] = useState<CostLine[]>(() => resolveLineCosts(initialLines));

  // Recalculate every line (percentages depend on other lines), then
  // propagate changes up
  const applyLines = useCallback(
    (next: CostLine[]) => {
      const resolved = resolveLineCosts(next);
      setLines(resolved);
      onChange?.(resolved);
    },
    [onChange],
  );

  // ── Line operations ──────────────────────────────────────────────────────

  const handleChange = useCallback(
    (updated: CostLine) => {
      applyLines(lines.map((l) => (l.id === updated.id ? updated : l)));
    },
    [lines, applyLines],
  );

  const handleDelete = useCallback(
    (id: string) => {
      applyLines(lines.filter((l) => l.id !== id));
    },
    [lines, applyLines],
  );

  const handleAddLine = useCallback(
    (category?: CostCategory) => {
      applyLines([...lines, category ? makeQuickLine(category) : makeBlankLine()]);
    },
    [lines, applyLines],
  );

  const handleAddFromRate = useCallback(
    (rateId: string) => {
      const rate = rateList.find((r) => r.id === rateId);
      if (!rate) return;
      applyLines([...lines, applyRateToLine(makeBlankLine(rate.category), rate)]);
    },
    [lines, applyLines, rateList],
  );

  // Rates grouped by category for the "Add from rate table" picker
  const ratesByCategory = useMemo(
    () =>
      (Object.keys(COST_CATEGORY_LABELS) as CostCategory[])
        .map((cat) => ({ cat, items: rateList.filter((r) => r.category === cat) }))
        .filter((g) => g.items.length > 0),
    [rateList],
  );

  // Amount each percentage category is applied to (shown on % lines)
  const percentBases = useMemo(() => {
    const bases: Partial<Record<CostCategory, number>> = {};
    for (const cat of PERCENT_CATEGORIES) bases[cat] = percentBaseFor(lines, cat);
    return bases;
  }, [lines]);

  // ── Derived totals ───────────────────────────────────────────────────────

  const subtotals = useMemo(() => computeSubtotals(lines), [lines]);
  const grandTotal = useMemo(() => computeGrandTotal(subtotals), [subtotals]);

  // ── Group lines by category for display ──────────────────────────────────

  const linesByCategory = useMemo(() => {
    const groups = new Map<CostCategory, CostLine[]>();
    for (const line of lines) {
      const group = groups.get(line.category) ?? [];
      group.push(line);
      groups.set(line.category, group);
    }
    return groups;
  }, [lines]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="class-d-estimator">
      <header className="estimator-header">
        <h2 className="estimator-title">{title}</h2>
        <span className="estimator-badge">Class D · ±50–100 %</span>
      </header>

      <div className="estimator-body">
        {/* ── Cost Line Table ───────────────────────────────────────── */}
        <div className="cost-table-wrapper">
          <table className="cost-table">
            <thead>
              <tr>
                <th className="cost-th cost-th--description">Description</th>
                <th className="cost-th cost-th--category">Category</th>
                <th className="cost-th cost-th--number">Qty</th>
                <th className="cost-th cost-th--unit">Unit</th>
                <th className="cost-th cost-th--number">Rate ($/unit)</th>
                <th className="cost-th cost-th--duration">Duration</th>
                <th className="cost-th cost-th--total">Line Cost</th>
                {editable && <th className="cost-th cost-th--action" />}
              </tr>
            </thead>

            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={editable ? 8 : 7}
                    className="cost-empty"
                  >
                    No cost lines — click "Add line" to start.
                  </td>
                </tr>
              ) : (
                Array.from(linesByCategory.entries()).map(
                  ([category, catLines]) => (
                    <React.Fragment key={category}>
                      {/* Category sub-header */}
                      <tr className="cost-category-header">
                        <td
                          colSpan={editable ? 8 : 7}
                          className="cost-category-label"
                        >
                          {COST_CATEGORY_LABELS[category]}
                          <span className="cost-category-subtotal">
                            {formatCurrency(subtotals[category])}
                          </span>
                        </td>
                      </tr>

                      {catLines.map((line) => (
                        <CostLineRow
                          key={line.id}
                          line={line}
                          onChange={handleChange}
                          onDelete={handleDelete}
                          editable={editable}
                          rates={rateList}
                          percentBase={percentBases[line.category] ?? 0}
                        />
                      ))}
                    </React.Fragment>
                  ),
                )
              )}
            </tbody>
          </table>

          {/* ── Add line controls ─────────────────────────────────────── */}
          {editable && (
            <div className="add-line-bar">
              <button
                type="button"
                className="cost-btn cost-btn--add"
                onClick={() => handleAddLine()}
              >
                + Add line
              </button>

              <span className="add-line-bar__quick-label">Quick add:</span>

              {(Object.keys(COST_CATEGORY_LABELS) as CostCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="cost-btn cost-btn--quick"
                    onClick={() => handleAddLine(cat)}
                    title={`Add ${COST_CATEGORY_LABELS[cat]} line`}
                  >
                    {COST_CATEGORY_LABELS[cat]}
                  </button>
                ),
              )}

              {ratesByCategory.length > 0 && (
                <select
                  className="cost-input cost-input--select add-line-bar__rate-picker"
                  value=""
                  onChange={(e) => handleAddFromRate(e.target.value)}
                  aria-label="Add a line from the rate table"
                >
                  <option value="">+ Add from rate table…</option>
                  {ratesByCategory.map((g) => (
                    <optgroup key={g.cat} label={COST_CATEGORY_LABELS[g.cat]}>
                      {g.items.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.resource || 'Unnamed'} – {formatCurrency(effectiveRate(r))}/{r.unit}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* ── Summary panel ─────────────────────────────────────────── */}
        <SummaryPanel subtotals={subtotals} grandTotal={grandTotal} />
      </div>
    </div>
  );
};

export default ClassDEstimator;
