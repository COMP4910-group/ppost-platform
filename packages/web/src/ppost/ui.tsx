/** Small shared UI pieces for the PPOST pages (Tailwind, matches the app's dark theme). */
import React, { useEffect } from 'react';
import { CellStatus, RecordStatus, SECTORS, SectorId, Severity, TimeHorizon } from 'ppost-engine';

export const sectorLabel = (id: SectorId) => SECTORS.find((s) => s.id === id)?.label ?? id;

export const HORIZON_LABEL: Record<TimeHorizon, string> = {
  IMMEDIATE: 'Immediate (0–60 days)',
  MID_TERM: 'Mid-term (2–12 months)',
  LONG_TERM: 'Long-term (1–5 years)',
};

/** Colour is never the only signal: every status has an icon and a text label. */
export const CELL_STYLE: Record<CellStatus, { cls: string; icon: string; label: string }> = {
  RED: { cls: 'bg-red-950 border-red-500 text-red-200', icon: '⛔', label: 'Critical' },
  AMBER: { cls: 'bg-amber-950 border-amber-500 text-amber-200', icon: '⚠', label: 'Needs work' },
  GREEN: { cls: 'bg-green-950 border-green-500 text-green-200', icon: '✓', label: 'Complete' },
  NOT_ASSESSED: { cls: 'bg-gray-900 border-gray-700 text-gray-500', icon: '○', label: 'No problems' },
};

const STATUS_CLS: Record<RecordStatus, string> = {
  DRAFT: 'bg-gray-800 text-gray-300',
  IN_REVIEW: 'bg-blue-950 text-blue-300',
  APPROVED: 'bg-green-950 text-green-300',
  ARCHIVED: 'bg-gray-900 text-gray-500 line-through',
};
const STATUS_TEXT: Record<RecordStatus, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', APPROVED: 'Approved', ARCHIVED: 'Archived' };

export const StatusBadge = ({ status }: { status: RecordStatus }) => (
  <span className={`text-[11px] px-1.5 py-0.5 rounded ${STATUS_CLS[status]}`}>{STATUS_TEXT[status]}</span>
);

const SEV_CLS: Record<Severity, string> = {
  CRITICAL: 'bg-red-950 text-red-300', HIGH: 'bg-orange-950 text-orange-300',
  MEDIUM: 'bg-amber-950 text-amber-300', LOW: 'bg-gray-800 text-gray-300',
};
export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <span className={`text-[11px] px-1.5 py-0.5 rounded ${SEV_CLS[severity]}`}>{severity.toLowerCase()}</span>
);

export const UnknownBadge = ({ questionId }: { questionId?: string }) => (
  <span
    title={questionId ? `Created from UNKNOWN answer ${questionId}` : 'UNKNOWN'}
    className="text-[11px] px-1.5 py-0.5 rounded border border-dashed border-amber-400 text-amber-300"
  >
    ? UNKNOWN
  </span>
);

export const IdChip = ({ id }: { id: string }) => (
  <span className="font-mono text-[11px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">{id}</span>
);

/** Right-side drawer. Esc closes it. */
export const Drawer = ({ title, onClose, children, footer, width = 'w-[480px]' }: {
  title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className={`relative ${width} max-w-full h-full bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col`}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-800">
          <div className="min-w-0">{title}</div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white text-lg leading-none px-2">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">{footer}</div>}
      </aside>
    </div>
  );
};

/* ---------- form controls ---------- */

export const inputCls =
  'w-full bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export const Field = ({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) => (
  <label className="block mb-3">
    <span className="block text-xs font-medium text-gray-300 mb-1">
      {label} {required && <span className="text-red-400">*</span>}
    </span>
    {children}
    {hint && !error && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    {error && <span className="block text-[11px] text-red-400 mt-1">{error}</span>}
  </label>
);

export const Button = ({ variant = 'secondary', className = '', ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) => {
  const v = {
    primary: 'bg-green-600 hover:bg-green-500 text-white',
    secondary: 'border border-gray-700 hover:bg-gray-800 text-gray-200',
    ghost: 'text-gray-400 hover:text-white hover:bg-gray-800',
    danger: 'border border-red-800 text-red-300 hover:bg-red-950',
  }[variant];
  return (
    <button
      {...props}
      className={`text-xs px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 ${v} ${className}`}
    />
  );
};
