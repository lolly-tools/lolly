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
 * The source is a pure DATA provider: it lists projects and sessions and fetches a
 * session's full state. It does NOT open anything - the Projects view owns opening
 * (it already reconstructs tool URLs via the engine), so no engine or DOM concern
 * leaks into whoever registers the source.
 */

/** A shared project as the Projects view lists it. */
export interface TeamProjectRef {
  id: string;
  name: string;
  sessionCount?: number;
  updatedAt?: string;
}

/** A shared session, listed without its (potentially large) inputs. */
export interface TeamSessionRef {
  id: string;
  toolId: string;
  label?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** A shared session's full state - the shape the Projects view seeds a tool from. */
export interface TeamSessionData {
  toolId: string;
  toolVersion?: string;
  inputs: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface SessionSource {
  /** A short, already-localised name for the section heading (e.g. the instance name). */
  label: string;
  listProjects(): Promise<TeamProjectRef[]>;
  listSessions(projectId: string): Promise<TeamSessionRef[]>;
  /** Full state for one session, or null if it's gone (tombstoned/expired). */
  fetchSession(sessionId: string): Promise<TeamSessionData | null>;
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

/** TEST-ONLY: clear the registry back to its dormant default. */
export function _clearSessionSourceForTests(): void {
  current = undefined;
}
