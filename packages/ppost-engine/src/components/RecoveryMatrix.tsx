import React from 'react';
import { Priority, SectorId } from '../model/types';
import { SECTORS } from '../model/defaults';
import { CellStatus, MatrixCell, PpostData, buildMatrix } from '../engine/matrix';

/** Status colours from the design system (fill / border / text) + icon + label. */
const STATUS_STYLE: Record<CellStatus, { bg: string; border: string; text: string; icon: string; label: string }> = {
  RED: { bg: '#FEF2F2', border: '#F87171', text: '#991B1B', icon: '⛔', label: 'Critical' },
  AMBER: { bg: '#FFFBEB', border: '#FBBF24', text: '#92400E', icon: '⚠', label: 'Needs work' },
  GREEN: { bg: '#F0FDF4', border: '#4ADE80', text: '#166534', icon: '✓', label: 'Complete' },
  NOT_ASSESSED: { bg: '#F8FAFC', border: '#CBD5E1', text: '#475569', icon: '○', label: 'Not assessed' },
};

export interface RecoveryMatrixProps {
  priorities: Priority[];
  data: PpostData;
  /** Sectors to show as columns. Governance is hidden unless passed in. */
  sectors?: SectorId[];
  selected?: { priorityId: string; sector: SectorId };
  onCellClick?: (cell: MatrixCell) => void;
}

export function RecoveryMatrix({
  priorities,
  data,
  sectors = SECTORS.filter((s) => !s.optional).map((s) => s.id),
  selected,
  onCellClick,
}: RecoveryMatrixProps) {
  const ordered = [...priorities].filter((p) => p.active).sort((a, b) => a.rank - b.rank);
  const grid = buildMatrix(ordered, sectors, data);
  const sectorLabel = (id: SectorId) => SECTORS.find((s) => s.id === id)?.label ?? id;

  return (
    <table
      aria-label="Recovery Matrix: priorities by sector"
      style={{ borderCollapse: 'separate', borderSpacing: 6, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13 }}
    >
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: 'left', color: '#64748B' }}>Priority</th>
          {sectors.map((s) => (
            <th key={s} scope="col" style={{ color: '#0B192C', fontWeight: 600, minWidth: 130 }}>{sectorLabel(s)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ordered.map((p, r) => (
          <tr key={p.id}>
            <th scope="row" style={{ textAlign: 'left', color: '#0B192C', fontWeight: 600, paddingRight: 8 }}>
              {p.rank}. {p.name}
            </th>
            {grid[r].map((cell) => {
              const st = STATUS_STYLE[cell.status];
              const isSelected = selected?.priorityId === cell.priorityId && selected?.sector === cell.sector;
              const label = `${p.name} × ${sectorLabel(cell.sector)}: ${st.label}, ${cell.problemCount} problems, ${cell.objectiveCount} objectives, ${cell.unknownCount} unknown`;
              return (
                <td key={cell.sector} style={{ padding: 0 }}>
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={isSelected}
                    title={cell.reasons.join('\n') || st.label}
                    onClick={() => onCellClick?.(cell)}
                    style={{
                      width: '100%', minHeight: 64, textAlign: 'left', cursor: 'pointer',
                      background: st.bg, color: st.text, borderRadius: 8, padding: 8,
                      border: cell.unknownCount > 0 ? '2px dashed #F59E0B' : `1px solid ${st.border}`,
                      outline: isSelected ? '2px solid #1D63ED' : undefined, outlineOffset: 2,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{st.icon} {st.label}</div>
                    <div>{cell.problemCount}P · {cell.objectiveCount}O{cell.unknownCount > 0 ? ` · ${cell.unknownCount}?` : ''}</div>
                    {cell.problemCount > 0 && (
                      <div aria-hidden style={{ height: 4, background: '#E2E8F0', borderRadius: 2, marginTop: 4 }}>
                        <div style={{ width: `${cell.completeness}%`, height: 4, background: '#0D9488', borderRadius: 2 }} />
                      </div>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
