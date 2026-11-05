import React, { useCallback } from 'react';
import type { CostLine, CostCategory, RateEntry } from '../../types';
import { COST_CATEGORY_LABELS } from '../../types';
import { computeLineCost, formatCurrency } from '../../utils/calculations';
import { applyRateToLine, effectiveRate } from '../../utils/rates';
import { canBePercent, isPercentLine, percentBaseLabel } from '../../utils/percent';

interface CostLineRowProps {
  line: CostLine;
  onChange: (updated: CostLine) => void;
  onDelete: (id: string) => void;
  /** When true the row shows a delete button */
  editable?: boolean;
  /** Rate table entries the user can fill this line from */
  rates?: RateEntry[];
  /** For % lines: the amount the percentage is applied to */
  percentBase?: number;
}

// Fields that, when edited by hand, mean the line no longer matches its rate
const UNLINK_FIELDS: ReadonlyArray<keyof CostLine> = ['unitRate', 'unit', 'category'];

const DURATION_UNITS: Array<{ value: CostLine['durationUnit']; label: string }> =
  [
    { value: 'hr', label: 'hrs' },
    { value: 'day', label: 'days' },
    { value: 'wk', label: 'wks' },
    { value: 'mo', label: 'mos' },
  ];

const CATEGORIES = Object.entries(COST_CATEGORY_LABELS) as Array<
  [CostCategory, string]
>;

export const CostLineRow: React.FC<CostLineRowProps> = ({
  line,
  onChange,
  onDelete,
  editable = true,
  rates = [],
  percentBase = 0,
}) => {
  // Generic field updater: recalculates totalCost whenever qty/rate/duration changes
  const update = useCallback(
    <K extends keyof CostLine>(field: K, rawValue: CostLine[K]) => {
      const next: CostLine = { ...line, [field]: rawValue };
      if (UNLINK_FIELDS.includes(field)) next.rateId = undefined;
      next.totalCost = computeLineCost(next.quantity, next.unitRate, next.duration);
      onChange(next);
    },
    [line, onChange],
  );

  const handleNum = useCallback(
    (field: 'quantity' | 'unitRate' | 'duration') =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        update(field, isNaN(val) ? 0 : val);
      },
    [update],
  );

  const handleText = useCallback(
    (field: 'description' | 'unit' | 'notes') =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        update(field, e.target.value as CostLine[typeof field]);
      },
    [update],
  );

  const isPercent = isPercentLine(line);
  const categoryRates = rates.filter((r) => r.category === line.category);
  const linked = !!line.rateId && categoryRates.some((r) => r.id === line.rateId);

  return (
    <tr className="cost-line-row">
      {/* Description */}
      <td className="cost-cell cost-cell--description">
        {editable ? (
          <input
            type="text"
            className="cost-input cost-input--text"
            value={line.description}
            onChange={handleText('description')}
            placeholder="Work item description"
            aria-label="Description"
          />
        ) : (
          <span>{line.description}</span>
        )}
          {editable && !isPercent && categoryRates.length > 0 && (
            <select
              className={`cost-input cost-input--select rate-picker${linked ? ' rate-picker--linked' : ''}`}
              value={linked ? line.rateId : ''}
              onChange={(e) => {
                const rate = rates.find((r) => r.id === e.target.value);
                if (rate) onChange(applyRateToLine(line, rate));
              }}
              aria-label="Fill from rate table"
            >
              <option value="">
                {line.rateId && !linked ? 'Custom rate' : 'Fill from rate table…'}
              </option>
              {categoryRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.resource || 'Unnamed'} – {formatCurrency(effectiveRate(r))}/{r.unit}
                </option>
              ))}
            </select>
          )}
      </td>

      {/* Category */}
      <td className="cost-cell cost-cell--category">
        {editable ? (
          <select
            className="cost-input cost-input--select"
            value={line.category}
            onChange={(e) => update('category', e.target.value as CostCategory)}
            aria-label="Category"
          >
            {CATEGORIES.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <span>{COST_CATEGORY_LABELS[line.category]}</span>
        )}
        {editable && canBePercent(line.category) && (
          <select
            className="cost-input cost-input--select rate-picker"
            value={isPercent ? 'percent' : 'unit'}
            onChange={(e) =>
              onChange({
                ...line,
                pricing: e.target.value as 'unit' | 'percent',
                percent: line.percent ?? 0,
                rateId: undefined,
              })
            }
            aria-label="Pricing method"
          >
            <option value="unit">Unit rate</option>
            <option value="percent">% of base</option>
          </select>
        )}
      </td>

      {isPercent ? (
        <td className="cost-cell cost-cell--percent" colSpan={4}>
          <span className="percent-group">
            {editable ? (
              <input
                type="number"
                className="cost-input cost-input--number percent-input"
                value={line.percent ?? 0}
                min={0}
                step="any"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChange({ ...line, percent: isNaN(val) ? 0 : val });
                }}
                aria-label="Percentage"
              />
            ) : (
              <span>{line.percent ?? 0}</span>
            )}
            <span className="percent-of">
              % of {formatCurrency(percentBase)}
              <span className="percent-base-label"> ({percentBaseLabel(line.category)})</span>
            </span>
          </span>
        </td>
      ) : (
        <>
      {/* Quantity */}
      <td className="cost-cell cost-cell--number">
        {editable ? (
          <input
            type="number"
            className="cost-input cost-input--number"
            value={line.quantity}
            min={0}
            step="any"
            onChange={handleNum('quantity')}
            aria-label="Quantity"
          />
        ) : (
          <span>{line.quantity}</span>
        )}
      </td>

      {/* Unit */}
      <td className="cost-cell cost-cell--unit">
        {editable ? (
          <input
            type="text"
            className="cost-input cost-input--text cost-input--short"
            value={line.unit}
            onChange={handleText('unit')}
            placeholder="hr"
            aria-label="Unit"
          />
        ) : (
          <span>{line.unit}</span>
        )}
      </td>

      {/* Unit Rate */}
      <td className="cost-cell cost-cell--number">
        {editable ? (
          <input
            type="number"
            className="cost-input cost-input--number"
            value={line.unitRate}
            min={0}
            step="0.01"
            onChange={handleNum('unitRate')}
            aria-label="Unit rate ($/unit)"
          />
        ) : (
          <span>{formatCurrency(line.unitRate)}</span>
        )}
      </td>

      {/* Duration */}
      <td className="cost-cell cost-cell--duration">
        {editable ? (
          <span className="duration-group">
            <input
              type="number"
              className="cost-input cost-input--number"
              value={line.duration}
              min={0}
              step="any"
              onChange={handleNum('duration')}
              aria-label="Duration amount"
            />
            <select
              className="cost-input cost-input--select cost-input--short"
              value={line.durationUnit}
              onChange={(e) =>
                update('durationUnit', e.target.value as CostLine['durationUnit'])
              }
              aria-label="Duration unit"
            >
              {DURATION_UNITS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </span>
        ) : (
          <span>
            {line.duration} {line.durationUnit}
          </span>
        )}
      </td>
        </>
      )}

      {/* Computed total */}
      <td className="cost-cell cost-cell--total">
        <span className="cost-total">
          {formatCurrency(line.totalCost)}
        </span>
      </td>

      {/* Delete */}
      {editable && (
        <td className="cost-cell cost-cell--action">
          <button
            type="button"
            className="cost-btn cost-btn--delete"
            onClick={() => onDelete(line.id)}
            aria-label={`Delete line: ${line.description || 'unnamed'}`}
            title="Remove line"
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
};
