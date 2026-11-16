/**
 * Talks to the Django backend (packages/api, app "ppost").
 *
 * Uses the same login tokens the team's LoginPage stores in localStorage
 * (access_token / refresh_token). When the access token expires it is refreshed
 * once with /api/auth/token/refresh/ and the request is retried.
 */
export const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export type RecordKind =
  | 'priority' | 'problem' | 'objective' | 'strategy' | 'tactic' | 'task' | 'cost'
  | 'answer' | 'link' | 'ai_question' | 'insight' | 'meta';

export interface ServerRecord {
  kind: RecordKind;
  record_id: string;
  data: any;
  version: number;
  updated_at: string;
  updated_by: string | null;
}

export interface ChangeIn {
  kind: RecordKind;
  record_id: string;
  action: 'upsert' | 'delete';
  data?: any;
  client_at?: string;
  reason?: string;
}

export interface HistoryEntry {
  id: number;
  kind: RecordKind;
  record_id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  version: number;
  changed_fields: string[];
  before: any;
  after: any;
  user: string | null;
  at: string;
  client_at: string | null;
  reason: string;
}

/** Thrown when there is no valid login (no token, or refresh failed). */
export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'NotSignedInError';
  }
}

/** Thrown when the server answered but refused the request (400/403/500…). */
export class ServerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ServerError';
  }
}

const read = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};

export function hasLogin(): boolean {
  return !!read('access_token');
}

/** Username of whoever is logged in (from the team's stored `user`). */
export function currentUsername(): string | null {
  try {
    const u = JSON.parse(read('user') || 'null');
    return u?.username ?? null;
  } catch {
    return null;
  }
}

async function refreshToken(): Promise<boolean> {
  const refresh = read('refresh_token');
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    window.localStorage.setItem('access_token', data.access);
    if (data.refresh) window.localStorage.setItem('refresh_token', data.refresh); // rotation is on
    return true;
  } catch {
    return false;
  }
}

/** fetch() + JSON + Bearer token + one refresh-and-retry on 401. Network failures throw TypeError. */
export async function apiFetch<T = any>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = read('access_token');
  if (!token) throw new NotSignedInError();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    if (retry && (await refreshToken())) return apiFetch<T>(path, init, false);
    throw new NotSignedInError();
  }
  if (!res.ok) {
    let msg = `Server error ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail || body.error || JSON.stringify(body);
    } catch {
      /* not JSON */
    }
    throw new ServerError(res.status, msg);
  }
  return res.json();
}

const ev = (eventId: string) => `/api/ppost/events/${encodeURIComponent(eventId)}`;

export function fetchState(eventId: string) {
  return apiFetch<{ event_id: string; server_time: string; records: ServerRecord[] }>(`${ev(eventId)}/state/`);
}

export function postChanges(eventId: string, changes: ChangeIn[]) {
  return apiFetch<{ applied: { kind: string; record_id: string; result: string; version: number; change_id: number | null }[]; server_time: string }>(
    `${ev(eventId)}/changes/`,
    { method: 'POST', body: JSON.stringify({ changes }) },
  );
}

export function fetchHistory(eventId: string, opts: { kind?: RecordKind; recordId?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (opts.kind) q.set('kind', opts.kind);
  if (opts.recordId) q.set('record_id', opts.recordId);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return apiFetch<{ changes: HistoryEntry[] }>(`${ev(eventId)}/history/${qs ? `?${qs}` : ''}`);
}
