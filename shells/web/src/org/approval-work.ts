// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-work - this person's approval requests on the connected instance:
 * the list, the match for a tool's current inputs, the file behind a request and the
 * decision on that request.
 *
 * One list per view: the queue, Projects and the review sheet read the same copy,
 * and a read within `maxAgeMs` of the last one asks the instance nothing. Every
 * string in a row is data, and every view sets it through textContent.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { ApprovalFile, ApprovalStatus, SessionApproval } from '../lib/approval-request.ts';
import { ApprovalArtifactError, artifactChecksum } from './approval-artifact.ts';

/** The stored file behind a request, in the instance's own words. */
export interface ExportReviewRow {
  sha256: string;
  size: number;
  name: string;
  format: string;
  mediaType: string;
  preview: 'image' | 'video' | 'audio' | 'pdf' | 'none';
  toolId: string;
  toolVersion: string | null;
  /** What identifies the inputs. Null when the instance could not read them. */
  inputsDigest: string | null;
  fingerprint: string;
  sessionId?: string;
  widthPx?: number;
  heightPx?: number;
  removedAt?: string;
  artifactUrl: string;
}

export interface ApprovalActionRow {
  action: 'approve' | 'reject';
  actorName: string;
  comment?: string;
  at: string;
  step: number;
}

export interface ApprovalRow {
  id: string;
  title: string;
  state: 'submitted' | 'in_review' | 'approved' | 'rejected' | 'withdrawn';
  relation: 'mine' | 'inbox';
  stepIndex: number;
  stepCount: number;
  stepName: string | null;
  createdByName: string;
  createdAt: string;
  actions: ApprovalActionRow[];
  exportReview: ExportReviewRow;
}

const JSON_HEADERS = { 'content-type': 'application/json' };
const isOpen = (state: ApprovalRow['state']): boolean => state === 'submitted' || state === 'in_review';
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** One request from a list answer, or null when it carries no file: those stay with
 *  the console, which can show what they do have. Pure. */
export function rowFromBody(row: unknown): ApprovalRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const file = r.exportReview as Record<string, unknown> | undefined;
  if (typeof r.id !== 'string' || !file || typeof file !== 'object') return null;
  if (typeof file.sha256 !== 'string' || typeof file.fingerprint !== 'string' || typeof file.artifactUrl !== 'string') return null;
  if (r.relation !== 'mine' && r.relation !== 'inbox') return null;
  const state = r.state;
  if (state !== 'submitted' && state !== 'in_review' && state !== 'approved' && state !== 'rejected' && state !== 'withdrawn') return null;
  const preview = file.preview;
  const actions = Array.isArray(r.actions) ? r.actions : [];
  return {
    id: r.id, title: text(r.title), state, relation: r.relation,
    stepIndex: Number(r.stepIndex) || 0, stepCount: Number(r.stepCount) || 1,
    stepName: typeof r.stepName === 'string' ? r.stepName : null,
    createdByName: text(r.createdByName), createdAt: text(r.createdAt),
    actions: actions.flatMap((row2): ApprovalActionRow[] => {
      const a = row2 as Record<string, unknown>;
      if (a?.action !== 'approve' && a?.action !== 'reject') return [];
      return [{ action: a.action, actorName: text(a.actorName), at: text(a.at), step: Number(a.step) || 0, ...(typeof a.comment === 'string' && a.comment ? { comment: a.comment } : {}) }];
    }),
    exportReview: {
      sha256: file.sha256, size: Number(file.size) || 0, name: text(file.name), format: text(file.format), mediaType: text(file.mediaType),
      preview: preview === 'image' || preview === 'video' || preview === 'audio' || preview === 'pdf' ? preview : 'none',
      toolId: text(file.toolId), toolVersion: typeof file.toolVersion === 'string' ? file.toolVersion : null,
      inputsDigest: typeof file.inputsDigest === 'string' ? file.inputsDigest : null, fingerprint: file.fingerprint,
      artifactUrl: file.artifactUrl,
      ...(typeof file.sessionId === 'string' ? { sessionId: file.sessionId } : {}),
      ...(typeof file.widthPx === 'number' ? { widthPx: file.widthPx } : {}),
      ...(typeof file.heightPx === 'number' ? { heightPx: file.heightPx } : {}),
      ...(typeof file.removedAt === 'string' ? { removedAt: file.removedAt } : {}),
    },
  };
}

/** When a finished request was decided: its last action. Pure. */
export const decidedAt = (row: Pick<ApprovalRow, 'actions' | 'createdAt'>): string => row.actions.at(-1)?.at ?? row.createdAt;

/** The newest open or approved request for each saved session. A rejected or
 *  withdrawn request does not hide an older approval: it says nothing about that file,
 *  and the card shows only In review or Approved. Pure. */
export function sessionApprovals(rows: readonly ApprovalRow[]): Map<string, SessionApproval> {
  const newest = new Map<string, { at: string; value: SessionApproval }>();
  for (const row of rows) {
    const slot = row.exportReview.sessionId;
    if (!slot || row.relation !== 'mine') continue;
    const state = isOpen(row.state) ? 'in_review' : row.state === 'approved' ? 'approved' : null;
    if (!state) continue;
    const held = newest.get(slot);
    if (held && held.at >= row.createdAt) continue;
    newest.set(slot, { at: row.createdAt, value: {
      state, approvalId: row.id, title: row.title, ...(state === 'approved' ? { decidedAt: decidedAt(row) } : {}),
    } });
  }
  return new Map([...newest].map(([slot, { value }]) => [slot, value]));
}

/** One request's file and the files of its siblings: requests for the same tool, format,
 *  tool version and inputs. Newest first, leaving out withdrawn requests. A request with no
 *  digest has no provable siblings. Empty when the rows do not hold the request. Pure. */
export function filesLike(list: readonly ApprovalRow[], id: string): ApprovalFile[] {
  const named = list.find(row => row.id === id)?.exportReview;
  if (!named) return [];
  const sibling = (file: ExportReviewRow): boolean => !!named.inputsDigest && file.inputsDigest === named.inputsDigest
    && file.toolId === named.toolId && file.format === named.format && file.toolVersion === named.toolVersion;
  return list
    .filter(row => row.state !== 'withdrawn' && (row.id === id || sibling(row.exportReview)))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .map((row): ApprovalFile => {
      const file = row.exportReview;
      const approved = row.state === 'approved';
      return {
        approvalId: row.id, state: approved ? 'approved' : row.state === 'rejected' ? 'rejected' : 'in_review',
        format: file.format, video: file.preview === 'video',
        ...(file.widthPx !== undefined ? { widthPx: file.widthPx } : {}),
        ...(file.heightPx !== undefined ? { heightPx: file.heightPx } : {}),
        ...(approved ? { decidedAt: decidedAt(row) } : {}),
      };
    });
}

/** The instance's answer about one tool's inputs, or null when it is not one. Pure. */
export function statusFromBody(body: unknown): ApprovalStatus | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const { state } = b;
  if (state !== 'none' && state !== 'in_review' && state !== 'approved' && state !== 'rejected' && state !== 'changed') return null;
  return {
    state,
    ...(typeof b.approvalId === 'string' ? { approvalId: b.approvalId } : {}),
    ...(typeof b.fingerprint === 'string' ? { fingerprint: b.fingerprint } : {}),
    ...(typeof b.title === 'string' ? { title: b.title } : {}),
    ...(typeof b.decidedAt === 'string' ? { decidedAt: b.decidedAt } : {}),
  };
}

async function errorOf(res: Response): Promise<ApprovalArtifactError> {
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: { code?: string } | string; code?: string };
    code = typeof body.error === 'object' ? body.error?.code : body.error ?? body.code;
  } catch { /* no readable body: the status alone */ }
  return new ApprovalArtifactError(res.status, code);
}

let rows: ApprovalRow[] | null = null;
let rowsAt = 0;
let reading: Promise<ApprovalRow[]> | null = null;
const listeners = new Set<() => void>();

/** Ask for this person's requests. Coalesces with a read already running. */
function readApprovals(): Promise<ApprovalRow[]> {
  reading ??= (async () => {
    try {
      const res = await instanceFetch(instancePath('/api/v1/approvals'));
      if (!res.ok) throw await errorOf(res);
      const body = (await res.json()) as { approvals?: unknown };
      const next = Array.isArray(body.approvals) ? body.approvals.flatMap(row => rowFromBody(row) ?? []) : [];
      rows = next; rowsAt = Date.now();
      for (const fn of listeners) { try { fn(); } catch { /* other readers still hear */ } }
      return next;
    } finally { reading = null; }
  })();
  return reading;
}

/** This person's requests that carry a file. `maxAgeMs` 0 always asks. */
export function listApprovals(maxAgeMs = 0): Promise<ApprovalRow[]> {
  if (rows && maxAgeMs > 0 && Date.now() - rowsAt < maxAgeMs) return Promise.resolve(rows);
  return readApprovals();
}

/** The list as last read, without asking. */
export const knownApprovals = (): readonly ApprovalRow[] => rows ?? [];

export function onApprovalsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Find one request. Asks again when it is not in the last answer. */
export async function findApproval(id: string): Promise<ApprovalRow | null> {
  const known = rows?.find(row => row.id === id);
  if (known) return known;
  return (await readApprovals()).find(row => row.id === id) ?? null;
}

/** One request as it stands now, for a person about to read or decide. The last answer
 *  stands in only when the instance cannot be reached. */
export async function currentApproval(id: string): Promise<ApprovalRow | null> {
  try { return (await readApprovals()).find(row => row.id === id) ?? null; }
  catch { return rows?.find(row => row.id === id) ?? null; }
}

/** Fetch the stored file. `token` is what the instance returns only with the bytes,
 *  for a person who may decide this step; `checked` says the bytes matched the digest
 *  the request recorded. A file that does not match never reaches the caller. */
export async function fetchApprovalFile(row: ApprovalRow): Promise<{ blob: Blob; token: string | null; checked: boolean }> {
  const res = await instanceFetch(instancePath(row.exportReview.artifactUrl));
  if (!res.ok) throw await errorOf(res);
  const blob = await res.blob();
  const typed = blob.type || !row.exportReview.mediaType ? blob : blob.slice(0, blob.size, row.exportReview.mediaType);
  const canCheck = !!globalThis.crypto?.subtle;
  if (canCheck && (await artifactChecksum(typed)) !== row.exportReview.sha256) throw new ApprovalArtifactError(res.status, 'ARTIFACT_DIGEST_MISMATCH');
  return { blob: typed, token: res.headers.get('x-lolly-review-token'), checked: canCheck };
}

/** Record this person's decision on the current step. */
export async function decideApproval(row: ApprovalRow, action: 'approve' | 'reject', comment: string, token: string | null): Promise<void> {
  const res = await instanceFetch(instancePath(`/api/v1/approvals/${encodeURIComponent(row.id)}/act`), {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({
      action, ...(comment ? { comment } : {}), artifactFingerprint: row.exportReview.fingerprint,
      ...(action === 'approve' && token ? { reviewToken: token } : {}),
    }),
  });
  if (!res.ok) throw await errorOf(res);
  void readApprovals().catch(() => {});
}

/** The instance's word on one tool, format and set of inputs. Null when it gives none. */
export async function approvalStatus(query: { toolId: string; format: string; query: string }, signal?: AbortSignal): Promise<ApprovalStatus | null> {
  const res = await instanceFetch(instancePath('/api/v1/approvals/match'), {
    method: 'POST', headers: JSON_HEADERS, ...(signal ? { signal } : {}), body: JSON.stringify(query),
  });
  return res.ok ? statusFromBody(await res.json()) : null;
}

/** The approved file's exact bytes. */
export async function approvedFile(id: string): Promise<{ blob: Blob; name: string }> {
  const row = await findApproval(id);
  if (row) {
    const { blob } = await fetchApprovalFile(row);
    return { blob, name: row.exportReview.name };
  }
  // A match can name a request this person did not raise: the same inputs, approved for
  // someone they share the file with. The route decides, and its digest header checks the bytes.
  const res = await instanceFetch(instancePath(`/api/v1/approvals/${encodeURIComponent(id)}/artifact`));
  if (!res.ok) throw await errorOf(res);
  const blob = await res.blob();
  const digest = /^"([a-f0-9]{64})"$/.exec(res.headers.get('etag') ?? '')?.[1];
  if (digest && globalThis.crypto?.subtle && (await artifactChecksum(blob)) !== digest) throw new ApprovalArtifactError(res.status, 'ARTIFACT_DIGEST_MISMATCH');
  return { blob, name: fileNameOf(res.headers.get('content-disposition')) };
}

/** A request's file and its siblings, from a fresh read of the list. */
export async function approvalFiles(id: string): Promise<ApprovalFile[]> {
  return filesLike(await listApprovals(0), id);
}

/** The file name a download header gives, or a plain fallback. Pure. */
export function fileNameOf(disposition: string | null): string {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '')?.[1];
  if (encoded) { try { return decodeURIComponent(encoded); } catch { /* the fallback below */ } }
  return 'approved-file';
}

/** The newest request per saved session, from the list as read within the last minute. */
export async function approvalSessions(): Promise<ReadonlyMap<string, SessionApproval>> {
  return sessionApprovals(await listApprovals(60_000));
}

/** TEST-ONLY: forget the list. */
export function _resetApprovalsForTests(): void {
  rows = null; rowsAt = 0; reading = null; listeners.clear();
}
