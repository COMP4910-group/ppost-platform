// Runs against the compiled package (npm test builds first), as a backend would use it.
const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');
const path = require('node:path');
const JSZip = require('jszip');
const {
  DOCX_MIME_TYPE,
  demoBanner,
  recoveryPlanDocxFilename,
  renderRecoveryPlanDocx,
} = require('../dist');

// The synthetic draft produced by ai-service's real assembly (kept in sync by
// packages/ai-service/test/webMockDraft.test.ts).
const draft = require(path.join(__dirname, '../../web/src/recoveryPlan/mockDraft.json'));

const simulated = { draftId: 'mock-draft-1', approval: { kind: 'SIMULATED', approvedAt: '2026-11-02T10:15:00.000Z' } };
const BANNER = 'SYNTHETIC DEMO DATA · SIMULATED APPROVAL · NOT AN OFFICIAL PLAN';

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Text of each paragraph (<w:p>) in an XML part, in document order. */
function paragraphs(xml) {
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map((p) =>
    decode((p.match(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')),
  );
}

async function open(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const part = async (name) => {
    const file = zip.file(name);
    assert.ok(file, `missing ${name}`);
    return file.async('string');
  };
  const headers = await Promise.all(zip.file(/^word\/header\d*\.xml$/).map((f) => f.async('string')));
  return { zip, document: await part('word/document.xml'), headers, part };
}

const allItems = draft.sections.flatMap((s) => s.items);
const allFields = allItems.flatMap((i) => (i.type === 'FIELD' ? [i] : i.type === 'RECORD' ? i.fields : []));

describe('renderRecoveryPlanDocx (synthetic draft, simulated approval)', () => {
  let doc;
  let text;

  before(async () => {
    const bytes = await renderRecoveryPlanDocx(draft, simulated);
    assert.ok(bytes instanceof ArrayBuffer);
    doc = await open(Buffer.from(bytes));
    text = paragraphs(doc.document);
  });

  it('produces a valid Word document package', async () => {
    const types = await doc.part('[Content_Types].xml');
    assert.match(types, /wordprocessingml\.document\.main\+xml/);
    assert.equal(DOCX_MIME_TYPE, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('marks every page as synthetic demo data with simulated approval', () => {
    assert.equal(demoBanner(draft, simulated), BANNER);
    assert.ok(doc.headers.length > 0);
    for (const header of doc.headers) assert.ok(paragraphs(header).includes(BANNER));
    assert.ok(text.includes(BANNER));
    assert.ok(text.some((t) => t.includes('synthetic data. It is not real client data')));
    assert.ok(text.some((t) => t.includes('Approval was simulated in the demo; nothing was saved')));
    assert.equal(recoveryPlanDocxFilename(draft, simulated), 'SYNTHETIC-DEMO_Initial-Recovery-Plan_EV-2026-014_mock-draft-1.docx');
  });

  it('records the reviewed draft and the simulated approval', () => {
    for (const expected of [
      'Draft ID', 'mock-draft-1',
      'Approval', 'SIMULATED (demo only; nothing was saved)',
      'Approved by', 'Not applicable (simulated approval)',
      'Approved at', '2026-11-02T10:15:00.000Z',
      'Source data captured at', draft.snapshotCapturedAt,
      draft.structure.note,
    ]) {
      assert.ok(text.includes(expected), expected);
    }
    assert.ok(text.includes(draft.title));
    assert.ok(text.includes(draft.aiNotice));
  });

  it('includes every section, record and supplied fact', () => {
    for (const section of draft.sections) assert.ok(text.includes(section.title), section.title);
    for (const item of allItems.filter((i) => i.type === 'RECORD')) {
      assert.ok(
        text.some((t) => t.includes(item.recordId) && t.includes(item.title)),
        `record ${item.recordId}`,
      );
    }
    for (const field of allFields.filter((f) => f.status === 'PROVIDED')) {
      assert.ok(text.includes(field.label), `label ${field.label}`);
      assert.ok(text.some((t) => t.startsWith(field.value)), `value of ${field.label}: ${field.value}`);
    }
    // Spot-check exact supplied facts.
    for (const fact of ['L. Tremblay', '2026-10-12', '2026-11-02', '2,122,900 (currency not provided)', 'Interior British Columbia, Canada']) {
      assert.ok(text.some((t) => t.startsWith(fact)), fact);
    }
  });

  it('keeps missing-information markers and UNKNOWN answers', () => {
    const notProvided = allFields.filter((f) => f.status === 'NOT_PROVIDED').length;
    const confirm = allFields.filter((f) => f.status === 'REQUIRES_CONFIRMATION').length;
    const cellTexts = text.filter((t) => !t.includes(':')); // field value cells, not the legend
    assert.equal(cellTexts.filter((t) => t.startsWith('Not provided')).length, notProvided);
    assert.equal(text.filter((t) => t.includes('  Requires confirmation')).length, confirm);
    assert.ok(text.some((t) => t.startsWith('UNKNOWN  Requires confirmation  [Q-W03]')));
  });

  it('labels every AI recommendation and keeps its source IDs', () => {
    const aiItems = allItems.filter((i) => i.type === 'AI_RECOMMENDATION');
    assert.equal(aiItems.length, 5);
    for (const item of aiItems) {
      const para = text.find((t) => t.includes(item.text));
      assert.ok(para, item.text);
      assert.ok(para.startsWith(`✦ ${item.label}`), 'AI label precedes the text');
      assert.ok(para.includes(`[${item.sourceRecordIds.join(', ')}]`), 'source IDs kept');
      if (item.title) assert.ok(para.includes(item.title));
    }
  });

  it('keeps source record IDs on supplied facts', () => {
    assert.ok(text.some((t) => t.startsWith('Clearwater Ridge Wildfire  [EV-2026-014]')));
    for (const field of allFields.filter((f) => f.sourceRecordIds.length > 0 && f.status === 'PROVIDED').slice(0, 25)) {
      assert.ok(text.some((t) => t.includes(`[${field.sourceRecordIds.join(', ')}]`)), field.label);
    }
  });
});

describe('renderRecoveryPlanDocx (real approval, for a future backend)', () => {
  const realDraft = { ...draft, isSynthetic: false };
  const approved = { draftId: 'd-42', approval: { kind: 'APPROVED', approvedAt: '2026-11-03T09:00:00.000Z', approvedBy: 'Planning Section Chief' } };

  it('omits the demo banner only when the data is real and the approval is real', async () => {
    assert.equal(demoBanner(realDraft, approved), null);
    assert.equal(demoBanner(draft, approved), 'SYNTHETIC DEMO DATA · NOT AN OFFICIAL PLAN');
    assert.equal(demoBanner(realDraft, simulated), 'SIMULATED APPROVAL · NOT AN OFFICIAL PLAN');

    const doc = await open(Buffer.from(await renderRecoveryPlanDocx(realDraft, approved)));
    const text = paragraphs(doc.document);
    assert.ok(!text.some((t) => t.includes('NOT AN OFFICIAL PLAN')));
    assert.ok(text.includes('Planning Section Chief'));
    assert.equal(recoveryPlanDocxFilename(realDraft, approved), 'Initial-Recovery-Plan_EV-2026-014_d-42.docx');
  });

  it('refuses to render without a draft, a draft ID or a complete approval', async () => {
    await assert.rejects(renderRecoveryPlanDocx({ kind: 'OTHER' }, simulated), /Not an Initial Recovery Plan draft/);
    await assert.rejects(renderRecoveryPlanDocx(draft, { ...simulated, draftId: '' }), /draft ID is required/);
    await assert.rejects(renderRecoveryPlanDocx(draft, { draftId: 'x', approval: { kind: 'SIMULATED' } }), /approval is required/);
    await assert.rejects(
      renderRecoveryPlanDocx(draft, { draftId: 'x', approval: { kind: 'APPROVED', approvedAt: 'now' } }),
      /must name who approved/,
    );
  });
});
