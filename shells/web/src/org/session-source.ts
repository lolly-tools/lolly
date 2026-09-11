// SPDX-License-Identifier: MPL-2.0
/**
 * The control-plane's SessionSource - a thin adapter over the instance's
 * projects/sessions API, registered into the generic lib/session-source.ts seam
 * by org/index.ts when a control plane is present. Pure data: fetch + shape, no
 * engine, no DOM. Everything goes through instanceFetch/instancePath, so a remote
 * instance base works exactly as the same-origin one.
 *
 * Maps the server contract (plans/08 section 6b) onto the seam's neutral types. A failed
 * request degrades to an empty list / null rather than throwing into the view.
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type {
  SessionSource, TeamProjectRef, TeamSessionRef, TeamSessionData,
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
  toolId?: string;
  toolVersion?: string;
  inputs?: Record<string, unknown>;
  meta?: Record<string, unknown>;
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
  if (!body?.toolId || !body.inputs) return { ok: false, status: 0 };
  return { ok: true, data: { toolId: body.toolId, toolVersion: body.toolVersion, inputs: body.inputs, meta: body.meta } };
}

/** Build the source. `label` is the already-localised instance name for the heading. */
export function createInstanceSessionSource(label: string): SessionSource {
  return {
    label,
    async listProjects(): Promise<TeamProjectRef[]> {
      const data = await getJson<{ projects?: TeamProjectRef[] }>('/api/v1/projects');
      return (data?.projects ?? []).map((p) => ({
        id: p.id, name: p.name, sessionCount: p.sessionCount, updatedAt: p.updatedAt,
      }));
    },
    async listSessions(projectId: string): Promise<TeamSessionRef[]> {
      const data = await getJson<{ sessions?: TeamSessionRef[] }>(`/api/v1/projects/${encodeURIComponent(projectId)}/sessions`);
      return (data?.sessions ?? []).map((s) => ({
        id: s.id, toolId: s.toolId, label: s.label, updatedAt: s.updatedAt, updatedBy: s.updatedBy,
      }));
    },
    async fetchSession(sessionId: string): Promise<TeamSessionData | null> {
      const got = await fetchTeamSession(sessionId);
      return got.ok ? got.data : null;
    },
  };
}
