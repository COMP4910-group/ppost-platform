import React from 'react';
import type { CategorySubtotals } from '../../types';
import { COST_CATEGORY_LABELS } from '../../types';
import { formatCurrency } from '../../utils/calculations';

interface SummaryPanelProps {
  subtotals: CategorySubtotals;
  grandTotal: number;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  subtotals,
  grandTotal,
}) => {
  // Only show categories that have a non-zero value
  const activeCategories = Object.entries(subtotals).filter(
    ([, amount]) => amount > 0,
  ) as Array<[keyof CategorySubtotals, number]>;

  return (
    <aside className="summary-panel" aria-label="Cost summary">
      <h3 className="summary-panel__title">Class D Estimate Summary</h3>

      <table className="summary-table">
        <tbody>
          {activeCategories.map(([category, amount]) => (
            <tr key={category} className="summary-row">
              <td className="summary-row__label">
                {COST_CATEGORY_LABELS[category]}
              </td>
              <td className="summary-row__amount">
                {formatCurrency(amount)}
              </td>
            </tr>
          ))}

          {activeCategories.length === 0 && (
            <tr>
              <td
                colSpan={2}
                className="summary-row__empty"
                style={{ color: 'var(--color-muted, #6b7280)', fontStyle: 'italic' }}
              >
                No cost lines yet
              </td>
            </tr>
          )}
        </tbody>

        <tfoot>
          <tr className="summary-row summary-row--total">
            <td className="summary-row__label">Total Estimated Cost</td>
            <td className="summary-row__amount summary-row__amount--grand">
              {formatCurrency(grandTotal)}
            </td>
          </tr>
          <tr className="summary-row summary-row--accuracy">
            <td
              colSpan={2}
              className="summary-row__accuracy-note"
            >
              Class D accuracy: −50 % / +100 %
            </td>
          </tr>
        </tfoot>
      </table>
    </aside>
  );
};
