// SPDX-License-Identifier: MPL-2.0
/**
 * The control-plane's SessionSource - a thin adapter over the instance's
 * projects/sessions API, registered into the generic lib/session-source.ts seam
 * by org/index.ts when a control plane is present. Pure data: fetch + shape, no
 * engine, no DOM. Everything goes through instanceFetch/instancePath, so a remote
 * instance base works exactly as the same-origin one.
 *
 * Maps the server contract (plans/08 section 6b) onto the seam's neutral types. A failed
 * read degrades to an empty list / null rather than throwing into the view. The
 * optional write half (POST a project or a session, PUT a session quoting its rev)
 * never throws either: it resolves `saved`, `conflict` (409, with the newer version),
 * `error` with the HTTP status, or `file-error` when a file the document uses could
 * not be shared with the project first (org/team-files.ts).
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type {
  SessionSource, SessionSourceWriter, TeamProjectCreate, TeamProjectOptions, TeamProjectRef,
  TeamProjectVisibility, TeamRole, TeamSessionData, TeamSessionRef, TeamSessionSave, TeamSessionWrite,
  SourceList,
} from '../lib/session-source.ts';

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await instanceFetch(instancePath(path));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The server structure of one full session (plans/08 section 6b). */
interface SessionBody {
  id?: string;
  projectId?: string;
  toolId?: string;
  toolVersion?: string;
  inputs?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  rev?: number;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string | null;
  updatedByYou?: boolean;
}

/**
 * A server session body as the seam's type, or null when it is not a usable
 * session (no tool, or no inputs). Optional fields are carried only when the
 * server sent them in the right type, so a caller never sees an own key holding
 * `undefined`. Pure; exported for tests.
 */
export function sessionDataFromBody(body: unknown): TeamSessionData | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as SessionBody;
  if (typeof b.toolId !== 'string' || !b.toolId || !b.inputs || typeof b.inputs !== 'object') return null;
  const out: TeamSessionData = { toolId: b.toolId, inputs: b.inputs };
  if (typeof b.toolVersion === 'string') out.toolVersion = b.toolVersion;
  if (b.meta && typeof b.meta === 'object') out.meta = b.meta;
  if (typeof b.id === 'string' && b.id) out.id = b.id;
  if (typeof b.projectId === 'string' && b.projectId) out.projectId = b.projectId;
  if (typeof b.rev === 'number' && Number.isFinite(b.rev)) out.rev = b.rev;
  if (typeof b.updatedAt === 'string') out.updatedAt = b.updatedAt;
  if (typeof b.updatedBy === 'string') out.updatedBy = b.updatedBy;
  if (typeof b.updatedByName === 'string' && b.updatedByName.trim()) out.updatedByName = b.updatedByName.trim();
  if (b.updatedByYou === true) out.updatedByYou = true;
  return out;
}

/**
 * One session fetch that KEEPS the HTTP status.
 *
 * The `SessionSource` seam deliberately collapses every failure to `null` - the
 * Projects view only ever says "that session could not be opened", so a status
 * would be a field nobody reads. A collab invite is the one caller that must tell
 * three failures apart, because the honest sentence differs each time: the session
 * was deleted (410), the caller's access was revoked (403), or it never existed /
 * the instance is unreachable. So the status-carrying fetch is the primitive and
 * `createInstanceSessionSource`'s `fetchSession` is the lossy view of it - one
 * request path, not two, so a change to the endpoint cannot fix one and miss the
 * other.
 *
 * `status: 0` is "no answer at all" (network error, abort, non-JSON body): the
 * request never reached a verdict, which is a different thing from a refusal and
 * is the one case worth retrying.
 */
export type TeamSessionFetch =
  | { ok: true; data: TeamSessionData }
  | { ok: false; status: number };

export async function fetchTeamSession(sessionId: string): Promise<TeamSessionFetch> {
  let res: Response;
  try {
    res = await instanceFetch(instancePath(`/api/v1/sessions/${encodeURIComponent(sessionId)}`));
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) return { ok: false, status: res.status };
  let body: SessionBody | null = null;
  try {
    body = (await res.json()) as SessionBody;
  } catch {
    return { ok: false, status: 0 };
  }
  // A 200 whose body is not a usable session is not a session - treat it as no
  // answer rather than inventing one, exactly as getJson does.
  const data = sessionDataFromBody(body);
  if (!data) return { ok: false, status: 0 };
  return { ok: true, data };
}

// ── Lists ─────────────────────────────────────────────────────────────────────

const ROLES: readonly TeamRole[] = ['owner', 'manager', 'editor', 'viewer'];

/** A role the server sent, or undefined when it sent none this shell knows. Pure. */
export function teamRoleOf(value: unknown): TeamRole | undefined {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value) ? value as TeamRole : undefined;
}

/** The newer list fields of a project row (the caller's role, who changed it last),
 *  each carried only when the server sent it in the right type. Pure. */
function projectExtras(p: { myRole?: unknown; updatedByName?: unknown }): Pick<TeamProjectRef, 'myRole' | 'updatedByName'> {
  const myRole = teamRoleOf(p.myRole);
  const name = typeof p.updatedByName === 'string' && p.updatedByName.trim() ? p.updatedByName.trim() : undefined;
  return { ...(myRole ? { myRole } : {}), ...(name ? { updatedByName: name } : {}) };
}

/** One session row of a project's list, without its inputs. The instance sends
 *  `label: null` and `updatedByName: null` when there is none; both become absent
 *  here, as the seam's types say. Pure; exported for tests. */
export function sessionRefFromRow(s: TeamSessionRef): TeamSessionRef {
  const name = typeof s.updatedByName === 'string' && s.updatedByName.trim() ? s.updatedByName.trim() : undefined;
  const label = typeof s.label === 'string' && s.label ? s.label : undefined;
  return {
    id: s.id, toolId: s.toolId, updatedAt: s.updatedAt, updatedBy: s.updatedBy,
    ...(label ? { label } : {}),
    ...(name ? { updatedByName: name } : {}),
  };
}

/**
 * A project's session list that KEEPS the HTTP status, for the `#/team/project/<id>`
 * link: it has to tell a project that is not there (404) from one this person cannot
 * see (403) from no answer (0). The source's `listSessions` is the lossy view.
 */
export type TeamProjectFetch =
  | { ok: true; sessions: TeamSessionRef[] }
  | { ok: false; status: number };

export async function fetchTeamProjectSessions(projectId: string): Promise<TeamProjectFetch> {
  let res: Response;
  try {
    res = await instanceFetch(instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/sessions`));
  } catch {
    return { ok: false, status: 0 };
  }
  if (!res.ok) return { ok: false, status: res.status };
  const body = await readJson(res) as { sessions?: unknown } | null;
  if (!body || !Array.isArray(body.sessions)) return { ok: false, status: 0 };
  return { ok: true, sessions: (body.sessions as TeamSessionRef[]).map(sessionRefFromRow) };
}

export async function fetchTeamProjects(): Promise<SourceList<TeamProjectRef>> {
  let res: Response;
  try { res = await instanceFetch(instancePath('/api/v1/projects')); }
  catch { return { ok: false, status: 0 }; }
  if (!res.ok) return { ok: false, status: res.status };
  const body = await readJson(res) as { projects?: unknown } | null;
  if (!body || !Array.isArray(body.projects)) return { ok: false, status: 0 };
  const items = (body.projects as TeamProjectRef[]).filter(p => p && typeof p.id === 'string' && typeof p.name === 'string').map(p => ({
    id: p.id, name: p.name, sessionCount: p.sessionCount, updatedAt: p.updatedAt, ...projectExtras(p),
  }));
  return { ok: true, items };
}

// ── Writes ────────────────────────────────────────────────────────────────────
//
// The server caps a session body at 4 MiB. Measured here first, so an oversized
// document is refused with the same status the server would send (413) without
// uploading megabytes only to be told no.
export const SESSION_BODY_LIMIT = 4 * 1024 * 1024;

/** Bytes a JSON body takes on the wire (UTF-8). */
function bodyBytes(json: string): number {
  return new TextEncoder().encode(json).length;
}

/** One JSON write. Resolves the response, or null when no answer arrived. Same
 *  origin requests carry the session cookie; the JSON content type is what the
 *  instance's cross-site guard expects of a same-origin write. */
async function sendJson(method: 'POST' | 'PUT', path: string, json: string): Promise<Response | null> {
  try {
    return await instanceFetch(instancePath(path), {
      method,
      headers: { 'content-type': 'application/json' },
      body: json,
    });
  } catch {
    return null;
  }
}

async function readJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

/** The code an instance sends with a 409 when a live collab holds the session: the room
 *  saves the session, and no save from outside is taken until the room closes. Not a
 *  newer version to choose between, so never a conflict. */
export const COLLAB_ACTIVE = 'COLLAB_ACTIVE';

/** The instance's error code on a refused save, when this adapter kept one (today only
 *  {@link COLLAB_ACTIVE}). The seam's `error` outcome has a field for the HTTP status
 *  only, so the code rides on the same object beside the status. Pure. */
export function saveErrorCode(result: TeamSessionSave): string | undefined {
  if (result.kind !== 'error') return undefined;
  const code = (result as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : undefined;
}

/** Map a write response onto the seam's outcome. `fallbackId` is the session id to
 *  report when the server's body has none (a PUT may answer with only the new rev). */
async function sessionSaveFrom(res: Response | null, fallbackId: string): Promise<TeamSessionSave> {
  if (!res) return { kind: 'error', status: 0 };
  if (res.status === 409) {
    const body = await readJson(res) as { current?: unknown; error?: { code?: unknown } } | null;
    // Checked before the version: a live collab's refusal is never offered as "open
    // theirs or save a copy", whatever the body carries beside the code.
    if (body?.error?.code === COLLAB_ACTIVE) {
      const refused: TeamSessionSave & { code: string } = { kind: 'error', status: 409, code: COLLAB_ACTIVE };
      return refused;
    }
    const current = sessionDataFromBody(body?.current);
    // A 409 without a readable current version cannot be offered as a choice, so it
    // is reported as an error rather than as an empty conflict.
    return current ? { kind: 'conflict', current } : { kind: 'error', status: 409 };
  }
  if (!res.ok) return { kind: 'error', status: res.status };
  const body = await readJson(res) as { id?: unknown; rev?: unknown } | null;
  const rev = typeof body?.rev === 'number' && Number.isFinite(body.rev) ? body.rev : null;
  const id = typeof body?.id === 'string' && body.id ? body.id : fallbackId;
  if (rev === null || !id) return { kind: 'error', status: 0 };
  return { kind: 'saved', id, rev };
}

/** The org-config fields the write half reads: the caller's capability bits and
 *  the groups it may share a new project with. Structural, so this module does
 *  not import org/index.ts. */
export interface TeamWriteConfig {
  can?: Record<string, boolean>;
  sharing?: { groups?: unknown; projectFiles?: boolean };
}

/**
 * What the person may choose when creating a project. Creation is offered unless
 * the instance says `can['project.create'] === false`; the server still decides.
 * An older instance sends no `sharing.groups`, and then only "only me" is offered.
 * Saving a new session follows `can['session.create']`, and saving over one follows
 * `can['session.edit']` when the instance sends that bit. Pure; exported for tests.
 */
export function teamProjectOptions(config: TeamWriteConfig | null | undefined): TeamProjectOptions {
  const raw = config?.sharing?.groups;
  const groups = Array.isArray(raw)
    ? [...new Set(raw.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map((g) => g.trim()))]
    : [];
  const can = config?.can;
  return {
    canCreate: can?.['project.create'] !== false,
    groups,
    canSave: can?.['session.create'] !== false,
    canEdit: can?.['session.edit'] !== false,
    ...(config?.sharing?.projectFiles === true ? { canShareFiles: true } : {}),
  };
}

/**
 * Share the document's device uploads with the project before a save
 * (org/team-files.ts). A file that cannot be shared stops the save with its own
 * outcome and sentence rather than a status: a 413 or a 410 here is about one file,
 * not about the document or the session.
 */
async function shareFiles(projectId: string, inputs: Record<string, unknown>): Promise<{ ok: true; inputs: Record<string, unknown> } | { ok: false; outcome: TeamSessionSave }> {
  const files = await import('./team-files.ts').catch(() => null);
  if (!files) return { ok: false, outcome: { kind: 'error', status: 0 } };
  try {
    return { ok: true, inputs: await files.shareTeamFiles(projectId, inputs) };
  } catch (error) {
    const code = error instanceof files.TeamFileError ? error.code : undefined;
    return { ok: false, outcome: { kind: 'file-error', message: files.teamFileMessage(error, 'upload'), ...(code ? { code } : {}) } };
  }
}

/** Build the write half. `config` is read on every call, so policy that changes
 *  mid-session applies at once. */
export function createInstanceSessionWriter(config: () => TeamWriteConfig | null): SessionSourceWriter {
  return {
    projectOptions: () => teamProjectOptions(config()),
    async createProject(input: { name: string; visibility: TeamProjectVisibility }): Promise<TeamProjectCreate> {
      const name = input.name.trim();
      if (!name) return { kind: 'error', status: 400 };
      const res = await sendJson('POST', '/api/v1/projects', JSON.stringify({ name, visibility: input.visibility }));
      if (!res) return { kind: 'error', status: 0 };
      if (!res.ok) return { kind: 'error', status: res.status };
      const body = await readJson(res) as { id?: unknown; name?: unknown; project?: { id?: unknown; name?: unknown } } | null;
      const p = body?.project && typeof body.project === 'object' ? body.project : body;
      if (!p || typeof p.id !== 'string' || !p.id) return { kind: 'error', status: 0 };
      return { kind: 'created', project: { id: p.id, name: typeof p.name === 'string' && p.name ? p.name : name } };
    },
    async createSession(projectId: string, input: TeamSessionWrite): Promise<TeamSessionSave> {
      let inputs = input.inputs;
      if (config()?.sharing?.projectFiles) {
        const shared = await shareFiles(projectId, inputs);
        if (!shared.ok) return shared.outcome;
        inputs = shared.inputs;
      }
      const json = JSON.stringify({
        toolId: input.toolId,
        ...(input.toolVersion ? { toolVersion: input.toolVersion } : {}),
        inputs,
        ...(input.meta ? { meta: input.meta } : {}),
      });
      if (bodyBytes(json) > SESSION_BODY_LIMIT) return { kind: 'error', status: 413 };
      const res = await sendJson('POST', `/api/v1/projects/${encodeURIComponent(projectId)}/sessions`, json);
      return sessionSaveFrom(res, '');
    },
    async updateSession(input): Promise<TeamSessionSave> {
      let inputs = input.inputs;
      if (config()?.sharing?.projectFiles) {
        const refs = await import('../lib/beam-pack.ts').then((m) => m.collectSessionAssetRefs(inputs).user.length, () => -1);
        if (refs < 0) return { kind: 'error', status: 0 };
        if (refs) {
          const projectId = input.projectId || (await getJson<SessionBody>(`/api/v1/sessions/${encodeURIComponent(input.id)}`))?.projectId;
          if (!projectId) return { kind: 'error', status: 404 };
          const shared = await shareFiles(projectId, inputs);
          if (!shared.ok) return shared.outcome;
          inputs = shared.inputs;
        }
      }
      const json = JSON.stringify({ inputs, ...(input.meta ? { meta: input.meta } : {}), rev: input.rev });
      if (bodyBytes(json) > SESSION_BODY_LIMIT) return { kind: 'error', status: 413 };
      const res = await sendJson('PUT', `/api/v1/sessions/${encodeURIComponent(input.id)}`, json);
      return sessionSaveFrom(res, input.id);
    },
  };
}

/** Build the source. `label` is the already-localised instance name for the heading.
 *  With `config`, the source also carries the write half (see createInstanceSessionWriter). */
export function createInstanceSessionSource(label: string, config?: () => TeamWriteConfig | null): SessionSource {
  return {
    label,
    ...(config ? { write: createInstanceSessionWriter(config) } : {}),
    readProjects: fetchTeamProjects,
    async readSessions(projectId) {
      const got = await fetchTeamProjectSessions(projectId);
      return got.ok ? { ok: true, items: got.sessions } : got;
    },
    async listProjects(): Promise<TeamProjectRef[]> {
      const data = await getJson<{ projects?: TeamProjectRef[] }>('/api/v1/projects');
      return (data?.projects ?? []).map((p) => ({
        id: p.id, name: p.name, sessionCount: p.sessionCount, updatedAt: p.updatedAt, ...projectExtras(p),
      }));
    },
    async listSessions(projectId: string): Promise<TeamSessionRef[]> {
      const data = await getJson<{ sessions?: TeamSessionRef[] }>(`/api/v1/projects/${encodeURIComponent(projectId)}/sessions`);
      return (data?.sessions ?? []).map(sessionRefFromRow);
    },
    async fetchSession(sessionId: string): Promise<TeamSessionData | null> {
      const got = await fetchTeamSession(sessionId);
      return got.ok ? got.data : null;
    },
  };
}
