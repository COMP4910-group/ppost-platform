import React from 'react';
import type { PlanAiItem, PlanField, PlanItem, PlanRecord, PlanSection, RecoveryPlanDraft } from './types';

const NOT_PROVIDED = 'Not provided';
const REQUIRES_CONFIRMATION = 'Requires confirmation';

const ORIGIN_BADGE: Record<PlanSection['origin'], { label: string; className: string }> = {
  SOURCE_DATA: { label: 'Supplied data', className: 'bg-gray-800 text-gray-300' },
  AI_RECOMMENDATION: { label: '✦ AI recommendation', className: 'bg-purple-900 text-purple-300' },
  MIXED: { label: 'Supplied data + ✦ AI', className: 'bg-purple-950 text-purple-300' },
};

export const SourceIds = ({ ids }: { ids: string[] }) =>
  ids.length === 0 ? null : (
    <span className="inline-flex flex-wrap gap-1 ml-2 align-middle">
      {ids.map((id) => (
        <span
          key={id}
          title="Source record ID"
          className="font-mono text-[10px] leading-4 px-1 rounded border border-gray-700 text-gray-400"
        >
          {id}
        </span>
      ))}
    </span>
  );

const FieldValue = ({ field }: { field: PlanField }) => {
  if (field.status === 'NOT_PROVIDED') {
    return (
      <span className="italic text-gray-500 border border-dashed border-gray-600 rounded px-1.5" data-status="NOT_PROVIDED">
        {NOT_PROVIDED}
      </span>
    );
  }
  return (
    <span className="text-gray-100" data-status={field.status}>
      {field.value}
      {field.status === 'REQUIRES_CONFIRMATION' && (
        <span className="ml-2 text-[10px] uppercase tracking-wide bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">
          {REQUIRES_CONFIRMATION}
        </span>
      )}
    </span>
  );
};

const FieldRow = ({ field }: { field: PlanField }) => (
  <div className="flex text-xs py-1 border-b border-gray-800 last:border-b-0">
    <div className="w-56 flex-shrink-0 text-gray-400 pr-3">{field.label}</div>
    <div className="flex-1">
      <FieldValue field={field} />
      <SourceIds ids={field.sourceRecordIds} />
    </div>
  </div>
);

const RecordBlock = ({ record }: { record: PlanRecord }) => (
  <div
    className="my-2 bg-gray-950 border border-gray-800 rounded p-2"
    style={{ marginLeft: `${record.level * 1.25}rem` }}
    data-record-id={record.recordId}
  >
    <div className="text-xs mb-1">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-2">
        {record.recordType.replace(/_/g, ' ')}
      </span>
      <span className="font-mono text-gray-400 mr-2">{record.recordId}</span>
      <span className="text-white font-medium">{record.title}</span>
    </div>
    {record.fields.map((f, i) => (
      <FieldRow key={`${f.label}-${i}`} field={f} />
    ))}
  </div>
);

const AiBlock = ({ item }: { item: PlanAiItem }) => (
  <div className="my-2 border border-purple-800 bg-purple-950/40 rounded p-3" data-testid="ai-item">
    <div className="text-[10px] uppercase tracking-wide text-purple-300 mb-1">✦ {item.label}</div>
    {item.title && <div className="text-sm text-white font-medium">{item.title}</div>}
    <div className="text-sm text-gray-200">
      {item.text}
      <SourceIds ids={item.sourceRecordIds} />
    </div>
  </div>
);

const Item = ({ item }: { item: PlanItem }) => {
  if (item.type === 'FIELD') return <FieldRow field={item} />;
  if (item.type === 'RECORD') return <RecordBlock record={item} />;
  return <AiBlock item={item} />;
};

export const PreviewLegend = () => (
  <div className="flex flex-wrap gap-4 text-xs text-gray-400" aria-label="Preview legend">
    <span><span className="text-gray-100">Plain text</span>: supplied data, reproduced as entered</span>
    <span><span className="text-purple-300">✦ Purple box</span>: AI recommendation, not verified</span>
    <span>
      <span className="italic text-gray-500 border border-dashed border-gray-600 rounded px-1">{NOT_PROVIDED}</span>: missing
    </span>
    <span>
      <span className="text-[10px] uppercase bg-yellow-900 text-yellow-300 px-1 rounded">{REQUIRES_CONFIRMATION}</span>: unresolved
      or UNKNOWN
    </span>
    <span>
      <span className="font-mono text-[10px] px-1 rounded border border-gray-700">P-02</span>: source record ID
    </span>
  </div>
);

export const PlanPreview = ({ draft }: { draft: RecoveryPlanDraft }) => (
  <article aria-label="Initial Recovery Plan draft preview" className="space-y-4">
    <header>
      <h2 className="text-xl font-bold text-white">{draft.title}</h2>
      <p className="text-xs text-gray-400 mt-1">
        Source data captured {draft.snapshotCapturedAt} · {draft.structure.note}
      </p>
      <p className="text-xs text-purple-300 mt-2">{draft.aiNotice}</p>
    </header>
    {draft.sections.map((section) => (
      <section
        key={section.key}
        aria-labelledby={`section-${section.key}`}
        className="bg-gray-900 rounded-lg p-4 border border-gray-800"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 id={`section-${section.key}`} className="font-medium text-sm text-white">
            {section.title}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded ${ORIGIN_BADGE[section.origin].className}`}>
            {ORIGIN_BADGE[section.origin].label}
          </span>
        </div>
        {section.items.map((item, i) => (
          <Item key={i} item={item} />
        ))}
      </section>
    ))}
  </article>
);
