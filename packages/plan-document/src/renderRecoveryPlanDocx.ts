import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type {
  PlanAiItem,
  PlanField,
  PlanItem,
  PlanRecord,
  PlanSection,
  RecoveryPlanDraft,
  RenderRecoveryPlanOptions,
} from './types';

export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const NOT_PROVIDED = 'Not provided';
export const REQUIRES_CONFIRMATION = 'Requires confirmation';

const COLOR = {
  banner: 'B91C1C',
  bannerFill: 'FEE2E2',
  ai: '6D28D9',
  aiFill: 'F3E8FF',
  confirm: 'B45309',
  muted: '6B7280',
  label: '374151',
  border: 'D1D5DB',
};
const MONO = 'Courier New';

const ORIGIN_LABEL: Record<PlanSection['origin'], string> = {
  SOURCE_DATA: 'Supplied data',
  AI_RECOMMENDATION: 'AI recommendation',
  MIXED: 'Supplied data and AI recommendations',
};

/**
 * Renders the exact reviewed draft as a DOCX file and returns its bytes.
 * Pure with respect to the outside world: no network, storage or AI calls.
 * Browser: `new Blob([bytes], { type: DOCX_MIME_TYPE })`; Node: `Buffer.from(bytes)`.
 */
export async function renderRecoveryPlanDocx(
  draft: RecoveryPlanDraft,
  options: RenderRecoveryPlanOptions,
): Promise<ArrayBuffer> {
  return Packer.toArrayBuffer(createRecoveryPlanDocument(draft, options));
}

/** The banner that must appear on every page, or null for a real approved plan. */
export function demoBanner(draft: RecoveryPlanDraft, options: RenderRecoveryPlanOptions): string | null {
  const parts = [
    draft.isSynthetic ? 'SYNTHETIC DEMO DATA' : null,
    options.approval.kind === 'SIMULATED' ? 'SIMULATED APPROVAL' : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? [...parts, 'NOT AN OFFICIAL PLAN'].join(' · ') : null;
}

export function recoveryPlanDocxFilename(draft: RecoveryPlanDraft, options: RenderRecoveryPlanOptions): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const prefix = demoBanner(draft, options) ? 'SYNTHETIC-DEMO_' : '';
  return `${prefix}Initial-Recovery-Plan_${safe(draft.disasterId)}_${safe(options.draftId)}.docx`;
}

function createRecoveryPlanDocument(draft: RecoveryPlanDraft, options: RenderRecoveryPlanOptions): Document {
  assertRenderable(draft, options);
  const banner = demoBanner(draft, options);

  return new Document({
    creator: 'PPOST RecoveryOS',
    title: draft.title,
    description: banner ?? 'Initial Recovery Plan',
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              banner
                ? new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: banner, bold: true, color: COLOR.banner, size: 18 })],
                  })
                : new Paragraph({ children: [new TextRun({ text: draft.title, color: COLOR.muted, size: 16 })] }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    color: COLOR.muted,
                    size: 16,
                    children: [`Draft ${options.draftId} · Page `, PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(draft.title)] }),
          ...(banner ? demoNotice(banner, options) : []),
          approvalTable(draft, options),
          spacer(),
          shaded(COLOR.aiFill, [new TextRun({ text: draft.aiNotice, color: COLOR.ai })]),
          ...legend(),
          ...draft.sections.flatMap(renderSection),
        ],
      },
    ],
  });
}

function demoNotice(banner: string, options: RenderRecoveryPlanOptions) {
  const lines = [
    'This document was generated in a demonstration from synthetic data. It is not real client data.',
    options.approval.kind === 'SIMULATED'
      ? 'Approval was simulated in the demo; nothing was saved. Do not use this document for operational decisions.'
      : null,
  ].filter((l): l is string => l !== null);
  return [
    shaded(COLOR.bannerFill, [new TextRun({ text: banner, bold: true, color: COLOR.banner })]),
    ...lines.map((l) => shaded(COLOR.bannerFill, [new TextRun({ text: l, color: COLOR.banner })])),
  ];
}

function approvalTable(draft: RecoveryPlanDraft, options: RenderRecoveryPlanOptions): Table {
  const a = options.approval;
  const rows: [string, string][] = [
    ['Draft ID', options.draftId],
    ['Approval', a.kind === 'SIMULATED' ? 'SIMULATED (demo only; nothing was saved)' : 'Approved'],
    ['Approved by', a.kind === 'SIMULATED' ? 'Not applicable (simulated approval)' : a.approvedBy],
    ['Approved at', a.approvedAt],
    ['Disaster ID', draft.disasterId],
    ['Source data captured at', draft.snapshotCapturedAt],
    ['Document structure', draft.structure.note],
  ];
  return table(rows.map(([label, value]) => [labelCell(label), cell([new TextRun(value)])]));
}

function legend(): Paragraph[] {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('How to read this document')] }),
    bullet([new TextRun('Plain text: supplied planning data, reproduced as entered.')]),
    bullet([new TextRun({ text: '✦ AI recommendation', bold: true, color: COLOR.ai }), new TextRun(' (shaded): drafted by an AI model; not verified.')]),
    bullet([new TextRun({ text: NOT_PROVIDED, italics: true, color: COLOR.muted }), new TextRun(': the information was not supplied.')]),
    bullet([new TextRun({ text: REQUIRES_CONFIRMATION, bold: true, color: COLOR.confirm }), new TextRun(': unresolved, UNKNOWN or unverified.')]),
    bullet([new TextRun({ text: '[P-02]', font: MONO, color: COLOR.muted }), new TextRun(': source record IDs the content refers to.')]),
  ];
}

function renderSection(section: PlanSection): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: section.key === 'PPOST_CHAINS' || section.key === 'SOURCE_RECORD_INDEX',
      children: [new TextRun(section.title)],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: ORIGIN_LABEL[section.origin],
          italics: true,
          color: section.origin === 'SOURCE_DATA' ? COLOR.muted : COLOR.ai,
          size: 16,
        }),
      ],
    }),
  ];

  // Consecutive fields share one table; records and AI items break the run.
  let fields: PlanField[] = [];
  const flush = () => {
    if (fields.length > 0) out.push(fieldTable(fields, 0), spacer());
    fields = [];
  };
  for (const item of section.items) {
    if (item.type === 'FIELD') {
      fields.push(item);
      continue;
    }
    flush();
    out.push(...renderItem(item));
  }
  flush();
  return out;
}

function renderItem(item: Exclude<PlanItem, PlanField>): (Paragraph | Table)[] {
  return item.type === 'RECORD' ? renderRecord(item) : [renderAi(item), spacer()];
}

function renderRecord(record: PlanRecord): (Paragraph | Table)[] {
  const indent = Math.min(record.level, 4) * 360;
  return [
    new Paragraph({
      indent: { left: indent },
      spacing: { before: 120 },
      keepNext: true,
      children: [
        new TextRun({ text: `${record.recordType.replace(/_/g, ' ')} `, color: COLOR.muted, size: 16 }),
        new TextRun({ text: `${record.recordId} `, font: MONO, color: COLOR.label }),
        new TextRun({ text: record.title, bold: true }),
      ],
    }),
    fieldTable(record.fields, indent),
  ];
}

function renderAi(item: PlanAiItem): Paragraph {
  return shaded(COLOR.aiFill, [
    new TextRun({ text: `✦ ${item.label}`, bold: true, color: COLOR.ai, size: 16 }),
    ...(item.title ? [new TextRun({ text: item.title, bold: true, break: 1 })] : []),
    new TextRun({ text: item.text, break: 1 }),
    ...sourceIds(item.sourceRecordIds),
  ]);
}

function fieldTable(fields: PlanField[], indent: number): Table {
  return table(
    fields.map((f) => [labelCell(f.label), cell([...valueRuns(f), ...sourceIds(f.sourceRecordIds)])]),
    indent,
  );
}

/** Missing values are never left blank; UNKNOWN and unresolved values keep their text. */
function valueRuns(field: PlanField): TextRun[] {
  if (field.status === 'NOT_PROVIDED') return [new TextRun({ text: NOT_PROVIDED, italics: true, color: COLOR.muted })];
  const value = new TextRun(field.value ?? '');
  if (field.status === 'REQUIRES_CONFIRMATION')
    return [value, new TextRun({ text: `  ${REQUIRES_CONFIRMATION}`, bold: true, color: COLOR.confirm })];
  return [value];
}

function sourceIds(ids: string[]): TextRun[] {
  return ids.length === 0 ? [] : [new TextRun({ text: `  [${ids.join(', ')}]`, font: MONO, size: 16, color: COLOR.muted })];
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function table(rows: TableCell[][], indent = 0): Table {
  const line = { style: BorderStyle.SINGLE, size: 4, color: COLOR.border };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    indent: { size: indent, type: WidthType.DXA },
    borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
    rows: rows.map((cells) => new TableRow({ cantSplit: true, children: cells })),
  });
}

function labelCell(label: string): TableCell {
  return new TableCell({
    width: { size: 32, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: label, color: COLOR.label, bold: true, size: 18 })] })],
  });
}

function cell(runs: TextRun[]): TableCell {
  return new TableCell({ width: { size: 68, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: runs })] });
}

function shaded(fill: string, runs: TextRun[]): Paragraph {
  return new Paragraph({ shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, spacing: { after: 60 }, children: runs });
}

function bullet(runs: TextRun[]): Paragraph {
  return new Paragraph({ bullet: { level: 0 }, children: runs });
}

function spacer(): Paragraph {
  return new Paragraph({ children: [] });
}

function assertRenderable(draft: RecoveryPlanDraft, options: RenderRecoveryPlanOptions): void {
  if (!draft || draft.kind !== 'INITIAL_RECOVERY_PLAN_DRAFT' || !Array.isArray(draft.sections))
    throw new Error('Not an Initial Recovery Plan draft.');
  if (!options || !options.draftId) throw new Error('A draft ID is required to render the document.');
  if (!options.approval || !options.approval.approvedAt) throw new Error('An approval is required to render the document.');
  if (options.approval.kind === 'APPROVED' && !options.approval.approvedBy)
    throw new Error('A real approval must name who approved the plan.');
}
