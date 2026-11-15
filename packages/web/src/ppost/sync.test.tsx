import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { getState, resetDemoData, setAnswer, setNote, archive } from './store';
import {
  __resetSyncForTests, diffRecords, flush, fromRecords, getSyncStatus, hydrate, stableStringify, startSync, stopSync, toRecords,
} from './sync';
import { HistoryPanel } from './HistoryPanel';

type Call = { url: string; method: string; body: any; auth: string | null };
let calls: Call[] = [];
let serverRecords: any[] = [];
let failPosts = false;

function mockFetch() {
  (global as any).fetch = jest.fn(async (url: string, init: any = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body, auth: init.headers?.Authorization ?? null });
    const ok = (data: any) => ({ ok: true, status: 200, json: async () => data });
    if (url.endsWith('/state/')) return ok({ event_id: 'EV-2026-014', server_time: '2026-11-14T10:00:00Z', records: serverRecords });
    if (url.endsWith('/changes/')) {
      if (failPosts) throw new TypeError('Failed to fetch');
      return ok({ applied: body.changes.map((c: any) => ({ ...c, result: 'created', version: 1, change_id: 1 })), server_time: '2026-11-14T10:00:05Z' });
    }
    if (url.includes('/history/')) {
      return ok({
        changes: [
          { id: 2, kind: 'answer', record_id: 'Q-W03', action: 'update', version: 2, changed_fields: ['answer'],
            before: { answer: 'YES' }, after: { answer: 'UNKNOWN' }, user: 'test', at: '2026-11-14T10:05:00Z', client_at: null, reason: '' },
          { id: 1, kind: 'answer', record_id: 'Q-W03', action: 'create', version: 1, changed_fields: [],
            before: null, after: { answer: 'YES' }, user: 'test', at: '2026-11-14T10:00:00Z', client_at: null, reason: '' },
        ],
      });
    }
    return { ok: false, status: 404, json: async () => ({ detail: 'nope' }) };
  });
}

const posts = () => calls.filter((c) => c.method === 'POST');
const allChanges = () => posts().flatMap((c) => c.body.changes);

beforeEach(() => {
  window.localStorage.clear();
  __resetSyncForTests();
  resetDemoData();
  calls = [];
  serverRecords = [];
  failPosts = false;
  mockFetch();
});
afterEach(() => {
  stopSync();
  __resetSyncForTests();
});

describe('store <-> records', () => {
  it('round-trips the whole PPOST state', () => {
    setAnswer('Q-W03', 'UNKNOWN');
    setNote('Q-W03', 'Utility has not reported');
    const s = getState();
    const recs = Array.from(toRecords(s).values());
    const back = fromRecords(recs, s);
    const a = toRecords(back); const b = toRecords(s);
    const diff = Array.from(b.keys()).filter((k) => stableStringify(a.get(k)) !== stableStringify(b.get(k)));
    expect(diff).toEqual([]);
    expect(a.size).toBe(b.size);
    expect(back.assessment.answers['Q-W03']).toBe('UNKNOWN');
    expect(back.assessment.notes['Q-W03']).toBe('Utility has not reported');
  });

  it('finds created, changed and removed records; key order does not matter', () => {
    const before = new Map([['problem|P-1', stableStringify({ a: 1, b: 2 })], ['problem|P-2', stableStringify({ a: 1 })]]);
    const after = new Map<string, any>([
      ['problem|P-1', { kind: 'problem', record_id: 'P-1', data: { b: 2, a: 1 } }], // same, other key order
      ['problem|P-3', { kind: 'problem', record_id: 'P-3', data: { a: 3 } }],
    ]);
    const ch = diffRecords(before, after);
    expect(ch.map((c) => `${c.action}:${c.record_id}`).sort()).toEqual(['delete:P-2', 'upsert:P-3']);
  });
});

describe('server sync', () => {
  it('does nothing without a login', async () => {
    await hydrate();
    expect(getSyncStatus().mode).toBe('signed-out');
    expect(calls).toHaveLength(0);
  });

  it('uploads this browser\'s data the first time, then sends each change with the login token', async () => {
    window.localStorage.setItem('access_token', 'tok');
    startSync();
    await waitFor(() => expect(getSyncStatus().mode).toBe('saved'));
    const first = allChanges();
    expect(first.length).toBeGreaterThan(10);
    expect(first[0].reason).toMatch(/First upload/);
    expect(posts()[0].auth).toBe('Bearer tok');

    calls = [];
    setAnswer('Q-W03', 'UNKNOWN');
    await waitFor(() => expect(posts()).toHaveLength(1), { timeout: 3000 });
    const ch = allChanges();
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({ kind: 'answer', record_id: 'Q-W03', action: 'upsert' });
    expect(ch[0].data).toMatchObject({ questionId: 'Q-W03', answer: 'UNKNOWN' });
    expect(ch[0].client_at).toBeTruthy();
  });

  it('sends archive as an update (records are never thrown away)', async () => {
    window.localStorage.setItem('access_token', 'tok');
    startSync();
    await waitFor(() => expect(getSyncStatus().mode).toBe('saved'));
    calls = [];
    const id = getState().problems[0].id;
    archive('problem', id);
    await waitFor(() => expect(posts()).toHaveLength(1), { timeout: 3000 });
    expect(allChanges()[0]).toMatchObject({ kind: 'problem', record_id: id, action: 'upsert', data: { status: 'ARCHIVED' } });
  });

  it('keeps changes while offline and sends them when the server is back', async () => {
    window.localStorage.setItem('access_token', 'tok');
    startSync();
    await waitFor(() => expect(getSyncStatus().mode).toBe('saved'));
    failPosts = true;
    setAnswer('Q-H01', 'NO');
    await waitFor(() => expect(getSyncStatus().mode).toBe('offline'), { timeout: 3000 });
    expect(getSyncStatus().pending).toBe(1);
    expect(JSON.parse(window.localStorage.getItem('ppost-sync-queue-v1')!)).toHaveLength(1);

    failPosts = false;
    calls = [];
    await flush();
    expect(getSyncStatus().mode).toBe('saved');
    expect(allChanges()[0]).toMatchObject({ record_id: 'Q-H01', data: { answer: 'NO' } });
    expect(JSON.parse(window.localStorage.getItem('ppost-sync-queue-v1')!)).toHaveLength(0);
  });

  it('loads saved data from the server instead of the browser copy', async () => {
    window.localStorage.setItem('access_token', 'tok');
    const s = getState();
    serverRecords = Array.from(toRecords(s).values()).map((r) => ({ ...r, version: 1, updated_at: '', updated_by: 'earl' }));
    serverRecords.push({ kind: 'answer', record_id: 'Q-P01', data: { questionId: 'Q-P01', answer: 'YES', note: 'from server', confirmedFromSituation: false } });
    await hydrate();
    expect(getState().assessment.answers['Q-P01']).toBe('YES');
    expect(getState().assessment.notes['Q-P01']).toBe('from server');
    expect(posts()).toHaveLength(0); // nothing to upload
  });
});

describe('HistoryPanel', () => {
  it('shows who changed the answer, when, and before → after', async () => {
    window.localStorage.setItem('access_token', 'tok');
    render(<HistoryPanel kind="answer" recordId="Q-W03" />);
    fireEvent.click(screen.getByRole('button', { name: /change history/i }));
    const rows = await screen.findAllByTestId('history-entry');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Changed');
    expect(rows[0]).toHaveTextContent('test');
    expect(rows[0]).toHaveTextContent('YES');
    expect(rows[0]).toHaveTextContent('UNKNOWN');
    expect(rows[1]).toHaveTextContent('Created');
    expect(calls[0].url).toContain('/api/ppost/events/EV-2026-014/history/?kind=answer&record_id=Q-W03');
  });

  it('asks to sign in when there is no login', async () => {
    render(<HistoryPanel kind="answer" recordId="Q-W03" />);
    fireEvent.click(screen.getByRole('button', { name: /change history/i }));
    expect(await screen.findByText(/sign in to see/i)).toBeInTheDocument();
  });
});
