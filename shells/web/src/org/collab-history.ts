// SPDX-License-Identifier: MPL-2.0
/**
 * Work history adapter. It prefers the instance's saved versions (`/versions`): they
 * carry contributors, named saves, previews, a restore through the live document and
 * a manager delete. An older instance answers 404 there, and the adapter falls back to
 * the bounded, read-only `/revisions` window.
 */

import type { SavedStateData } from '../bridge/state.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { collabHistoryPolicy, UNNAMED_VERSION_LABEL } from '../lib/collab-history.ts';
import type { CollabHistoryCapability, CollabHistoryEntry, CollabHistoryPage, CollabHistoryRestoreResult } from '../lib/collab-history.ts';
import { currentLang, tRaw } from '../i18n.ts';

interface WireRevision {
  sessionId?: string; rev?: number; inputs?: Record<string, unknown>; meta?: Record<string, unknown>;
  actor?: string; actorLabel?: string; at?: string;
}

type VersionKind = 'auto' | 'close' | 'save' | 'named' | 'restore' | 'before';
interface WireVersion {
  id: string; kind: VersionKind; rev: number; at: string; label?: string;
  createdBy?: string; createdByName?: string; contributors: { id: string; label?: string }[];
}
interface SessionFacts { toolId: string; label?: string; projectId?: string }
interface LoadedState { inputs: Record<string, unknown>; toolId: string; label: string; toolVersion?: string }

export type WorkHistoryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** What a version preview renders from. */
export interface WorkHistoryRender {
  sessionId: string; projectId?: string; versionId: string; toolId: string; inputs: Record<string, unknown>;
}

export interface WorkHistoryOptions {
  /** The signed-in member when this history was made; every request refuses once it changes. */
  principal?: () => string | undefined;
  /** Renders a version's preview image (a data URL). Tests pass their own. */
  render?: (job: WorkHistoryRender) => Promise<string | null>;
  /** A fresh id per save or restore, so a repeated request is not applied twice. */
  requestId?: () => string;
}

/** What a request was for: reading history, saving a version, or another change. */
export type WorkHistoryOperation = 'read' | 'save' | 'change';

/** A refused or failed history request. `message` is the copy to show, in the person's language. */
export class WorkHistoryError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  constructor(status: number, code?: string, operation: WorkHistoryOperation = 'change') {
    super(versionFailure(status, code, operation));
    this.status = status;
    this.code = code;
  }
}

/** What GET /versions says this person may do, when the instance says (plan 76 M4 hand-off to W3). */
interface VersionPermissions { save?: boolean; restore?: boolean; delete?: boolean }

/** Version ids, as the instance mints them (`ver_` plus base32); never a path. */
const VERSION_ID = /^[A-Za-z0-9_-]{1,80}$/;
const REASONS: Record<Exclude<VersionKind, 'before'>, CollabHistoryEntry['reason']> = {
  auto: 'checkpoint', close: 'checkpoint', save: 'save', named: 'named', restore: 'restore',
};
const LABEL_MAX = 120;

/**
 * Adapts Work's session history to the shell history contract. Every action reaches
 * the server again, so a list refreshes and a copy rechecks access. A restore always
 * goes through the instance, which applies it through the live document with the same
 * checks as a person's own edits; the shell never writes a restored head itself.
 */
export function createWorkCollabHistory(sessionId: string, fetcher: WorkHistoryFetch = instanceFetch, options: WorkHistoryOptions = {}): CollabHistoryCapability {
  const id = encodeURIComponent(sessionId);
  const instance = getInstanceBase();
  const person = options.principal?.();
  const endpoint = instancePath(`/api/v1/sessions/${id}`);
  const newRequestId = options.requestId ?? (() => crypto.randomUUID());
  // Unknown until the first list: the instance either has versions or answers 404.
  let mode: 'versions' | 'revisions' | undefined;
  let role: string | undefined;
  let allowed: VersionPermissions | undefined;
  let projectId: string | undefined;
  let lastSession: SessionFacts | undefined;
  const assertInstance = (): void => {
    if (getInstanceBase() !== instance) throw new WorkHistoryError(401, 'INSTANCE_CHANGED');
    if (options.principal && options.principal() !== person) throw new WorkHistoryError(401);
  };
  const call = async (url: string, init: RequestInit = {}): Promise<Response> => {
    assertInstance();
    const response = await fetcher(url, { credentials: 'include', cache: 'no-store', ...init });
    assertInstance();
    return response;
  };
  const json = async (response: Response): Promise<Record<string, unknown>> => {
    const body: unknown = await response.json().catch(() => undefined);
    assertInstance();
    if (!record(body)) throw invalid();
    return body;
  };
  const request = async (url: string): Promise<Record<string, unknown>> => {
    const response = await call(url);
    if (!response.ok) throw new WorkHistoryError(response.status, undefined, 'read');
    return json(response);
  };
  const write = async (url: string, method: 'POST' | 'DELETE', body?: object, operation: WorkHistoryOperation = 'change'): Promise<Record<string, unknown>> => {
    const response = await call(url, { method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new WorkHistoryError(response.status, await errorCode(response), operation);
    // The change is made; an empty or unreadable answer only means less to report.
    const answer: unknown = response.status === 204 ? {} : await response.json().catch(() => ({}));
    assertInstance();
    return record(answer) ? answer : {};
  };
  // Session metadata supplies the tool identity older revision rows lack, the name a
  // copy is given, and the caller's role, which decides what History offers them.
  const loadSession = async (): Promise<SessionFacts> => {
    const session = await request(endpoint);
    if (typeof session.toolId !== 'string' || !session.toolId) throw invalid('NO_TOOL_IDENTITY');
    role = typeof session.myRole === 'string' ? session.myRole : undefined;
    projectId = typeof session.projectId === 'string' && session.projectId ? session.projectId : undefined;
    const label = text(session.label, 256);
    lastSession = { toolId: session.toolId, ...(label ? { label } : {}), ...(projectId ? { projectId } : {}) };
    return lastSession;
  };
  // The older endpoint returns its last twenty full snapshots. Do not cache those
  // across actions: list must refresh and copy must recheck access.
  const loadRevisions = async (): Promise<WireRevision[]> => {
    const body = await request(`${endpoint}/revisions`);
    if (!Array.isArray(body.revisions)) throw invalid();
    return body.revisions.filter((item): item is WireRevision => record(item)
      && Number.isSafeInteger(item.rev) && Number(item.rev) >= 0
      && (item.sessionId === undefined || item.sessionId === sessionId))
      .sort((a, b) => b.rev! - a.rev!);
  };
  const revisionEntry = (revision: WireRevision, toolId: string): CollabHistoryEntry => ({
    id: `${sessionId}:${revision.rev}`,
    documentId: sessionId,
    toolId: typeof revision.meta?.toolId === 'string' && revision.meta.toolId ? revision.meta.toolId : toolId,
    label: typeof revision.meta?.label === 'string' ? revision.meta.label : `Revision ${revision.rev ?? '?'}`,
    reason: 'checkpoint',
    actor: { id: typeof revision.actor === 'string' ? revision.actor : 'work',
      ...(typeof revision.actorLabel === 'string' && revision.actorLabel.trim() ? { label: revision.actorLabel.trim() } : {}) },
    at: typeof revision.at === 'string' ? revision.at : new Date(0).toISOString(),
    revision: typeof revision.rev === 'number' ? revision.rev : 0,
  });
  const versionEntry = (version: WireVersion, session: SessionFacts): CollabHistoryEntry => ({
    id: version.id,
    documentId: sessionId,
    toolId: session.toolId,
    label: version.kind === 'named' && version.label ? namedLabel(version.label, version.at) : session.label ?? versionFrom(version.at),
    reason: REASONS[version.kind as Exclude<VersionKind, 'before'>],
    actor: version.createdBy
      ? { id: version.createdBy, ...(version.createdByName ? { label: version.createdByName } : {}) }
      : { id: 'collab' },
    at: version.at,
    revision: version.rev,
    contributors: version.contributors,
  });
  const listRevisions = async (session: SessionFacts, query?: { before?: string; limit?: number }): Promise<CollabHistoryPage> => {
    const revisions = await loadRevisions();
    const before = query?.before;
    const index = before ? revisions.findIndex(item => `${sessionId}:${item.rev}` === before) : -1;
    const rows = before ? (index < 0 ? [] : revisions.slice(index + 1)) : revisions;
    const limit = Number.isFinite(query?.limit) ? Math.max(1, Math.min(200, Math.floor(query!.limit!))) : 30;
    const page = rows.slice(0, limit).map(item => revisionEntry(item, session.toolId));
    return { entries: page, before: page.length < rows.length ? page.at(-1)?.id : undefined };
  };
  // `known` lets a thumbnail reuse the session facts of the last list: the version
  // request itself is still checked by the instance, so access is never cached.
  const load = async (entryId: string, known?: SessionFacts): Promise<LoadedState | null> => {
    // Revision ids carry the session id and a colon; version ids never contain one.
    if (entryId.startsWith(`${sessionId}:`)) {
      const session = await loadSession();
      const revision = (await loadRevisions()).find(item => `${sessionId}:${item.rev}` === entryId);
      if (!revision || !record(revision.inputs)) return null;
      const identity = revisionEntry(revision, session.toolId);
      return { inputs: revision.inputs, toolId: identity.toolId, label: identity.label,
        ...(typeof revision.meta?.toolVersion === 'string' ? { toolVersion: revision.meta.toolVersion } : {}) };
    }
    if (!VERSION_ID.test(entryId)) return null;
    const session = known ?? await loadSession();
    const response = await call(`${endpoint}/versions/${encodeURIComponent(entryId)}`);
    if (response.status === 404 || response.status === 410) return null;
    if (!response.ok) throw new WorkHistoryError(response.status, undefined, 'read');
    const version = (await json(response)).version;
    if (!record(version) || version.id !== entryId || !record(version.inputs)
      || (version.sessionId !== undefined && version.sessionId !== sessionId)) return null;
    const meta = record(version.meta) ? version.meta : {};
    const named = version.kind === 'named' ? text(version.label, LABEL_MAX) : undefined;
    const at = typeof version.at === 'string' ? version.at : new Date(0).toISOString();
    return {
      inputs: version.inputs,
      toolId: typeof meta.toolId === 'string' && meta.toolId ? meta.toolId : session.toolId,
      label: (named && namedLabel(named, at)) ?? text(meta.label, 256) ?? session.label ?? versionFrom(at),
      ...(typeof meta.toolVersion === 'string' ? { toolVersion: meta.toolVersion } : {}),
    };
  };
  const read = async (entryId: string): Promise<SavedStateData | null> => {
    const state = await load(entryId);
    return state ? { ...state.inputs, __toolId: state.toolId, __label: state.label,
      ...(state.toolVersion ? { __toolVersion: state.toolVersion } : {}) } : null;
  };
  const preview = async (entryId: string): Promise<string | null> => {
    if (!VERSION_ID.test(entryId)) return null;
    const state = await load(entryId, lastSession);
    if (!state) return null;
    const image = await (options.render ?? renderPreview)({ sessionId, ...(projectId ? { projectId } : {}),
      versionId: entryId, toolId: state.toolId, inputs: state.inputs }).catch(() => null);
    assertInstance();
    return typeof image === 'string' && /^data:image\/(?:png|jpeg|webp|svg\+xml)[;,]/.test(image) ? image : null;
  };
  const remove = async (versionId: string): Promise<void> => {
    if (!VERSION_ID.test(versionId)) throw new WorkHistoryError(404);
    await write(`${endpoint}/versions/${encodeURIComponent(versionId)}`, 'DELETE');
  };
  return {
    scope: 'shared', durability: 'durable', canSaveCopy: true,
    /**
     * What the instance says this person may do, from GET /versions; an instance that does
     * not say falls back to the role (writers restore and save, managers delete). The
     * instance's 403 stays the boundary either way.
     */
    get canRestore(): boolean {
      return mode === 'versions' && (allowed?.restore ?? writer(role));
    },
    get canSave(): boolean {
      return mode === 'versions' && (allowed?.save ?? writer(role));
    },
    get remove(): ((versionId: string) => Promise<void>) | undefined {
      return mode === 'versions' && (allowed?.delete ?? (role === 'owner' || role === 'manager')) ? remove : undefined;
    },
    async list(query): Promise<CollabHistoryPage> {
      const session = await loadSession();
      if (mode !== 'revisions') {
        const limit = Number.isFinite(query?.limit) ? Math.max(1, Math.min(100, Math.floor(query!.limit!))) : 30;
        const params = new URLSearchParams({ limit: String(limit) });
        if (query?.before) params.set('before', query.before);
        const response = await call(`${endpoint}/versions?${params}`);
        if (response.status === 404) mode = 'revisions';
        else {
          if (!response.ok) throw new WorkHistoryError(response.status, undefined, 'read');
          const body = await json(response);
          if (!Array.isArray(body.versions)) throw invalid();
          mode = 'versions';
          allowed = readPermissions(body.permissions);
          // A `before` row is the state a restore replaced: reachable only through Undo restore.
          const entries = body.versions.map(value => readVersion(value, sessionId))
            .filter((version): version is WireVersion => !!version && version.kind !== 'before')
            .map(version => versionEntry(version, session));
          const before = text(body.before, 200);
          return { entries, ...(before ? { before } : {}) };
        }
      }
      return listRevisions(session, query);
    },
    read,
    saveCopy: read,
    async saveVersion(label: string): Promise<void> {
      const name = clip(label.trim(), LABEL_MAX);
      if (!name) throw new WorkHistoryError(400, 'INVALID_INPUT');
      await write(`${endpoint}/versions`, 'POST', { label: name, requestId: newRequestId() }, 'save');
    },
    /** Version previews; an older instance's twenty full revisions are not fetched for thumbnails. */
    get preview(): ((entryId: string) => Promise<string | null>) | undefined {
      return mode === 'revisions' ? undefined : preview;
    },
    async restore(versionId: string): Promise<CollabHistoryRestoreResult> {
      if (!VERSION_ID.test(versionId)) throw new WorkHistoryError(404);
      const body = await write(`${endpoint}/versions/${encodeURIComponent(versionId)}/restore`, 'POST', { requestId: newRequestId() });
      const before = typeof body.before === 'string' ? body.before : record(body.before) ? body.before.id : undefined;
      return { ...(typeof before === 'string' && VERSION_ID.test(before) ? { undoId: before } : {}),
        skipped: inputIds(body.skipped), vetoed: inputIds(body.vetoed) };
    },
  };
}

/** The copy for a refused or failed request. Codes are the instance's (plan 76 M4, 2.5). */
function versionFailure(status: number, code: string | undefined, operation: WorkHistoryOperation): string {
  if (operation === 'read') return tRaw('Could not load history.');
  if (status === 429) return tRaw('Too many version changes. Try again in a minute.');
  if (status === 404 || status === 410) return tRaw('This version is no longer available.');
  if (code === 'READ_ONLY') return operation === 'save' ? tRaw('Only editors can save versions.') : tRaw('Only editors can restore versions.');
  // One person's own limit on named versions (20 per document): they can delete one of theirs.
  if (code === 'VERSION_LIMIT') return tRaw('You have saved the most named versions allowed. Delete one of yours first.');
  if (code === 'VERSION_SPACE') return tRaw('History is full. Ask a manager to delete old versions.');
  if (code === 'RESTORE_INCOMPLETE') return tRaw('Nothing was restored because the document could not take every change. Try again.');
  if (code === 'SESSION_CHANGED') return tRaw('The document changed while restoring. Try again.');
  return tRaw('Could not complete this action. Please try again.');
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const code = record(body) && record(body.error) ? body.error.code : undefined;
    return typeof code === 'string' && /^[A-Z_]{1,40}$/.test(code) ? code : undefined;
  } catch { return undefined; }
}

/** One row of `GET /versions`, or null when it cannot be shown safely. Names never carry an email: the instance strips them. */
function readVersion(value: unknown, sessionId: string): WireVersion | null {
  if (!record(value) || typeof value.id !== 'string' || !VERSION_ID.test(value.id)) return null;
  if (value.sessionId !== undefined && value.sessionId !== sessionId) return null;
  if (typeof value.kind !== 'string' || !(value.kind in REASONS || value.kind === 'before')) return null;
  if (!Number.isSafeInteger(value.rev) || Number(value.rev) < 0) return null;
  if (typeof value.at !== 'string' || Number.isNaN(Date.parse(value.at))) return null;
  const contributors = (Array.isArray(value.contributors) ? value.contributors : []).slice(0, 50).flatMap(item => {
    if (!record(item) || typeof item.id !== 'string' || !item.id || item.id.length > 200) return [];
    // Guests are one aggregate with no link id; their name is the shell's own word.
    if (item.kind === 'guest' || item.id === 'guest') return [{ id: 'guest' }];
    const label = text(item.name, 256);
    return [{ id: item.id, ...(label ? { label } : {}) }];
  });
  const label = text(value.label, LABEL_MAX);
  const createdBy = text(value.createdBy, 200);
  const createdByName = text(value.createdByName, 256);
  return { id: value.id, kind: value.kind as VersionKind, rev: Number(value.rev), at: value.at, contributors,
    ...(label ? { label } : {}), ...(createdBy ? { createdBy } : {}), ...(createdByName ? { createdByName } : {}) };
}

/** Default preview: the version's inputs rendered through the shared preview path. */
async function renderPreview(job: WorkHistoryRender): Promise<string | null> {
  const host = getHostRef();
  if (!host) return null;
  const [{ getTool }, { renderFeaturedVariant, rasterFormatOf }, { restoreTeamFiles }] = await Promise.all([
    import('../bridge/tool-loader.ts'), import('../lib/featured-render.ts'), import('./team-files.ts')]);
  // Project files the version uses come from the project, as a shared tile's do; a file
  // that is gone leaves its image blank rather than hiding the whole preview.
  await restoreTeamFiles(host, { toolId: job.toolId, inputs: job.inputs, ...(job.projectId ? { projectId: job.projectId } : {}) }).catch(() => {});
  const formats = (await getTool(job.toolId)).manifest.render?.formats;
  // History thumbnails accept raster images only; a vector-only tool still gets an SVG.
  const raster = rasterFormatOf(formats);
  return renderFeaturedVariant(host, job.toolId, raster ? [raster] : formats, job.versionId, job.inputs,
    `team-version:${getInstanceBase()}:${job.sessionId}`);
}

/** An answer the shell cannot read. */
function invalid(code?: string): WorkHistoryError {
  return new WorkHistoryError(422, code, 'read');
}

/** The permissions object of GET /versions; only true or false is read, anything else is not said. */
function readPermissions(value: unknown): VersionPermissions | undefined {
  if (!record(value)) return undefined;
  const said: VersionPermissions = {};
  if (typeof value.save === 'boolean') said.save = value.save;
  if (typeof value.restore === 'boolean') said.restore = value.restore;
  if (typeof value.delete === 'boolean') said.delete = value.delete;
  return said;
}

/** "Version from {time}" in the language of whoever reads the history, made when they read the list. */
function versionFrom(at: string): string {
  const date = new Date(at), shape: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  let time: string;
  try { time = date.toLocaleString(currentLang(), shape); } catch { time = date.toLocaleString(undefined, shape); }
  return tRaw('Version from {time}', { time });
}

/** A named version's label, unless it was saved unnamed (stored as its minute), which reads as its time. */
function namedLabel(label: string, at: string): string {
  return UNNAMED_VERSION_LABEL.test(label) ? versionFrom(at) : label;
}

/** Writers restore and save versions (collabHistoryPolicy) when the instance does not say. */
function writer(role: string | undefined): boolean {
  const writes = role === 'owner' || role === 'manager' || role === 'editor';
  return collabHistoryPolicy({ track: 'work', role: writes ? 'writer' : 'observer', host: false }).canRestore;
}

function inputIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 200).slice(0, 200) : [];
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? clip(trimmed, max) : undefined;
}

/** At most `max` UTF-16 units, never splitting a character. */
function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  let out = '';
  for (const char of value) { if (out.length + char.length > max) break; out += char; }
  return out;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
