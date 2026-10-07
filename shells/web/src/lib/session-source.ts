// SPDX-License-Identifier: MPL-2.0
/**
 * session-source - a generic registry for an EXTERNAL source of saved sessions.
 *
 * The sibling of field-policy / input-policy / export-policy: a neutral seam the
 * Projects view consults to show sessions that live somewhere other than this
 * device. It is EMPTY by default, so `getSessionSource()` returns undefined and the
 * Projects view renders exactly as today - local folders and sessions only.
 *
 * It knows nothing about WHO registers a source: a deployment's optional control
 * plane registers one so a team's shared projects appear beside your local ones
 * (see src/org/), but the registry is a standalone primitive - a test or a future
 * feature can drive it the same way. A single source at a time (last registration
 * wins), mirroring the approval-opener seam; there is one "elsewhere" per shell.
 *
 * The source is a pure DATA provider: it lists projects and sessions, fetches a
 * session's full state and, when it carries the optional `write` half, saves one.
 * It does NOT open anything - the Projects view owns opening
 * (it already reconstructs tool URLs via the engine), so no engine or DOM concern
 * leaks into whoever registers the source.
 */

/** What the person may do in a shared project: an owner or manager also decides who
 *  has access, an editor saves, a viewer only opens. */
export type TeamRole = 'owner' | 'manager' | 'editor' | 'viewer';

/** A shared project as the Projects view lists it. */
export interface TeamProjectRef {
  id: string;
  name: string;
  sessionCount?: number;
  createdAt?: string;
  /** When anything in the project last changed. */
  updatedAt?: string;
  /** The display name of whoever made that change, when the source knows the name. */
  updatedByName?: string;
  /** The person's own role in the project, when the source says. Absent: unknown,
   *  and the source's own answer to each action decides. */
  myRole?: TeamRole;
}

/** A shared session, listed without its (potentially large) inputs. */
export interface TeamSessionRef {
  id: string;
  toolId: string;
  label?: string;
  updatedAt?: string;
  updatedBy?: string;
  /** The display name of whoever saved the session last, when the source knows the name. */
  updatedByName?: string;
}

/** A shared session's full state - the shape the Projects view seeds a tool from.
 *  The identity fields are optional because a source may not know them; when a
 *  source does, `rev` is what a later save must quote back (see updateSession). */
export interface TeamSessionData {
  toolId: string;
  toolVersion?: string;
  inputs: Record<string, unknown>;
  meta?: Record<string, unknown>;
  id?: string;
  projectId?: string;
  rev?: number;
  updatedAt?: string;
  updatedBy?: string;
  /** The display name of whoever saved it last, when the source knows the name. */
  updatedByName?: string;
  /** True when the source says that last save was the signed-in person's own (from
   *  another window or device), so a conflict does not name them as someone else. */
  updatedByYou?: boolean;
  /** The signed-in person's effective role in the session's project, when the source
   *  says (a viewer opens the document read-only). Absent: unknown. */
  myRole?: TeamRole;
}

/** Who can see a new shared project: only its creator, or the named groups. */
export type TeamProjectVisibility = 'private' | { groups: string[] };

/** What a new shared session carries. */
export interface TeamSessionWrite {
  toolId: string;
  toolVersion?: string;
  inputs: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/**
 * The outcome of one session write. `saved` carries the new revision; `conflict`
 * means someone saved after the revision the caller quoted, and carries their
 * version so the caller can offer a choice instead of overwriting it; `error`
 * keeps the HTTP status (0 when no answer arrived at all). `file-error` means a file
 * the document uses could not be shared before the save, so nothing was saved:
 * `message` is the source's own sentence for why (plain text, already localised) and
 * `code` its reason, when it has one.
 */
export type TeamSessionSave =
  | { kind: 'saved'; id: string; rev: number }
  | { kind: 'conflict'; current: TeamSessionData }
  | { kind: 'error'; status: number }
  | { kind: 'file-error'; message: string; code?: string };

export type TeamProjectCreate =
  | { kind: 'created'; project: TeamProjectRef }
  | { kind: 'error'; status: number };

/** What the person may choose when creating a project (from the source's own policy). */
export interface TeamProjectOptions {
  /** False when the source says this person may not create projects. */
  canCreate: boolean;
  /** Groups a new project may be shared with, besides "only me". */
  groups: string[];
  /** False when the source says this person may not save new sessions. Absent: allowed,
   *  and the source's own answer to the save decides. */
  canSave?: boolean;
  /** False when the source says this person may not save over an existing session.
   *  Absent: allowed, as above. */
  canEdit?: boolean;
  canShareFiles?: boolean;
}

/**
 * The OPTIONAL write half of a source. A read-only source leaves it out, and every
 * caller treats its absence as "saving elsewhere is not offered here".
 */
export interface SessionSourceWriter {
  projectOptions(): TeamProjectOptions;
  createProject(input: { name: string; visibility: TeamProjectVisibility }): Promise<TeamProjectCreate>;
  createSession(projectId: string, input: TeamSessionWrite): Promise<TeamSessionSave>;
  /** Save over an existing session, quoting the revision the caller last saw. */
  updateSession(input: { id: string; projectId?: string; inputs: Record<string, unknown>; meta?: Record<string, unknown>; rev: number }): Promise<TeamSessionSave>;
}

export interface SessionSource {
  /** A short, already-localised name for the section heading (e.g. the instance name). */
  label: string;
  listProjects(): Promise<TeamProjectRef[]>;
  listSessions(projectId: string): Promise<TeamSessionRef[]>;
  /** Optional reads that distinguish an empty list from a refused or failed load. */
  readProjects?(): Promise<SourceList<TeamProjectRef>>;
  readSessions?(projectId: string): Promise<SourceList<TeamSessionRef>>;
  /** Full state for one session, or null if it's gone (tombstoned/expired). */
  fetchSession(sessionId: string): Promise<TeamSessionData | null>;
  /** Present only when the source can also save. */
  write?: SessionSourceWriter;
}

export type SourceList<T> = { ok: true; items: T[] } | { ok: false; status: number };

export async function readSourceProjects(source: SessionSource): Promise<SourceList<TeamProjectRef>> {
  try { return source.readProjects ? await source.readProjects() : { ok: true, items: await source.listProjects() }; }
  catch { return { ok: false, status: 0 }; }
}

export async function readSourceSessions(source: SessionSource, projectId: string): Promise<SourceList<TeamSessionRef>> {
  try { return source.readSessions ? await source.readSessions(projectId) : { ok: true, items: await source.listSessions(projectId) }; }
  catch { return { ok: false, status: 0 }; }
}

let current: SessionSource | undefined;

/** Register the external session source; returns an unregister fn (last-wins). */
export function registerSessionSource(source: SessionSource): () => void {
  current = source;
  return () => { if (current === source) current = undefined; };
}

/** The registered source, or undefined when dormant (no control plane). */
export function getSessionSource(): SessionSource | undefined {
  return current;
}

/** The registered source's write half, or undefined (dormant, or read-only). */
export function getSessionWriter(): SessionSourceWriter | undefined {
  return current?.write;
}

let projectRequest: string | null = null;

/**
 * Ask the Projects view to open one of the source's projects the next time it
 * mounts: a link to a project opens Projects with that project open, not a
 * page of its own. One-shot, and dormant until something asks.
 */
export function requestSourceProject(projectId: string): void {
  projectRequest = projectId || null;
}

/** The pending project request, cleared as it is read. */
export function takeSourceProjectRequest(): string | null {
  const id = projectRequest;
  projectRequest = null;
  return current ? id : null;
}

/** TEST-ONLY: clear the registry back to its dormant default. */
export function _clearSessionSourceForTests(): void {
  current = undefined;
  projectRequest = null;
}
