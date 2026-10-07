// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-open - open a team session into its tool, as a working copy that remembers
 * where it came from.
 *
 * One path for every way in: the Team projects modal (org/team-projects.ts), the
 * `#/team/<sessionId>` deep link (org/team-link.ts) and "Open theirs" after a save
 * conflict (org/team-save.ts). Each builds the tool URL the same way a shared
 * creation does (createRuntime, then serializeUrlState over the runtime's model, so
 * blocks and tables come through whole), arms the origin stash
 * (org/team-session-origin.ts) with the session id, project, revision and the address
 * it is about to open, and only then navigates. When that address is already the one
 * on screen there is nothing to navigate to, so the document on screen takes the origin
 * at once instead of arming a stash no mount would spend. Nothing local is written: the
 * session stays on the instance.
 *
 * The fetch is org/session-source.ts's status-carrying one, because a deep link has
 * to tell a deleted session (410) from one that never existed (404) from a refusal.
 *
 * The origin also carries the person's role in the session's project (the session
 * read's `myRole`, or on an older instance the project row's), and the open waits for
 * the team documents' scope provider (org/team-scope.ts, through
 * org/team-session-origin.ts `prepareTeamScope`) before navigating: the scope chip
 * says where the document belongs, Save writes back to the session, and a viewer's
 * inputs are read-only from the tool's first sidebar draw.
 */
import { serializeUrlState } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createToolRuntime as createRuntime } from '../lib/mount-runtime.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { getSessionSource, readSourceProjects, type TeamRole, type TeamSessionData } from '../lib/session-source.ts';
import { tRaw } from '../i18n.ts';
import { fetchTeamSession } from './session-source.ts';
import { noteProjectOpened } from './opened-projects.ts';
import { refreshToolReady } from '../lib/tool-ready.ts';
import { adoptTeamSessionOrigin, prepareTeamScope, rememberTeamSessionOrigin, teamAddressKey } from './team-session-origin.ts';

/** How one open ended. `status` is the HTTP status of a failed fetch (0: no answer,
 *  -1: the session arrived but its tool could not be built, -2: the person moved on,
 *  -3: a shared project file the session uses could not be put on this device). */
export type TeamOpenOutcome =
  | { ok: true; toolId: string; hash: string; /** The address was already on screen. */ same?: boolean }
  | { ok: false; status: number };

export interface TeamOpenOptions {
  /** The host to build the runtime with; the live web host when omitted. */
  host?: HostV1 | null;
  /** The project the session was picked from, when the server does not say. */
  projectId?: string | null;
  /** The session's state, when the caller already holds that state (a 409 carries one). */
  data?: TeamSessionData;
  /** Replace the current history entry instead of adding one (a deep link). */
  replace?: boolean;
  /** Runs after everything that can fail and right before the navigation. May return
   *  a promise, awaited first: a caller that closes a dialog here waits for the history
   *  entry that dialog pushed to be popped, so that pop cannot undo the navigation. */
  beforeNavigate?: () => void | Promise<void>;
  /** Checked right before the navigation; false abandons it (the person moved on). */
  stillWanted?: () => boolean;
}

/** The session's display name from its meta, when it has one. Pure. */
export function teamSessionLabel(data: Pick<TeamSessionData, 'meta'>): string | undefined {
  const label = data.meta?.label;
  return typeof label === 'string' && label.trim() ? label.trim() : undefined;
}

/** The URL params a session's meta carries beside its inputs: today the emoji set the
 *  document draws with (`meta.emoji`, as its reserved `emoji`/`emojifx`/`emojistyle`
 *  params). Appended to `query`; a malformed stamp adds nothing, and the tool's own
 *  mount checks the set against the sets it has. Pure. */
export function teamSessionQuery(query: string, meta: Record<string, unknown> | undefined): string {
  const stamp = meta?.emoji;
  if (!stamp || typeof stamp !== 'object') return query;
  const extra = new URLSearchParams();
  for (const key of ['emoji', 'emojifx', 'emojistyle'] as const) {
    const value = (stamp as Record<string, unknown>)[key];
    if (typeof value === 'string' && value && value.length <= 8192) extra.set(key, value);
  }
  if (!extra.has('emoji') && !extra.has('emojistyle')) return query;
  const tail = extra.toString();
  return query ? `${query}&${tail}` : tail;
}

/**
 * The `#/tool/<id>?<state>` address a session's model opens at. Pure.
 *
 * `keepUserIds`: this is the address bar of THIS device, not a link to share, so it keeps
 * `user/` image and file ids the way the tool view's own address does. Without it the
 * engine drops every `user/` id, and a teammate who opened a session with an uploaded
 * image opened the tool without that image: restoreTeamFiles had put the project file
 * (`user/team/…`) on this device, but the address no longer named the file. Every `user/` id
 * is kept, not only `user/team/` ones: an instance that does not share project files saves
 * device uploads as plain `user/` ids (team-save.ts deviceLocalNote), the person who
 * added one still sees it on their own device, and the save after that keeps the
 * reference. On another device such an id finds nothing and the image is left out, the
 * same as any address with a `user/` id from another device.
 */
export function teamSessionAddress(toolId: string, model: Parameters<typeof serializeUrlState>[0], meta?: Record<string, unknown>): string {
  const query = teamSessionQuery(serializeUrlState(model, { keepUserIds: true }), meta);
  return `#/tool/${toolId}${query ? `?${query}` : ''}`;
}

/** The `#/tool/<id>?<state>` address a session's inputs open at. */
export async function teamSessionHash(host: HostV1, data: TeamSessionData): Promise<string> {
  const tool = await getTool(data.toolId);
  const runtime = await createRuntime(tool, host, data.inputs as Parameters<typeof createRuntime>[2]);
  return teamSessionAddress(data.toolId, runtime.getModel(), data.meta);
}

/**
 * The person's role in a session's project: the session read's own `myRole`, else, on
 * an instance that does not send one, the project row's from the project list.
 * Undefined when neither says (the instance's own answer to a save then decides).
 */
export async function teamSessionRole(data: Pick<TeamSessionData, 'myRole'>, projectId: string | undefined): Promise<TeamRole | undefined> {
  if (data.myRole) return data.myRole;
  const source = getSessionSource();
  if (!projectId || !source) return undefined;
  const list = await readSourceProjects(source);
  return list.ok ? list.items.find((p) => p.id === projectId)?.myRole : undefined;
}

/**
 * Fetch (unless given) and open one team session. Never throws: the outcome says
 * what happened, and {@link teamOpenMessage} turns a failure into a sentence.
 */
export async function openTeamSession(sessionId: string, opts: TeamOpenOptions = {}): Promise<TeamOpenOutcome> {
  const host = opts.host ?? getHostRef();
  if (!host) return { ok: false, status: -1 };
  let data = opts.data;
  if (!data) {
    const got = await fetchTeamSession(sessionId);
    if (!got.ok) return { ok: false, status: got.status };
    data = got.data;
  }
  const files = await import('./team-files.ts').catch(() => null);
  if (!files) return { ok: false, status: -1 };
  try {
    await files.restoreTeamFiles(host, data);
  } catch (err) {
    // No answer, or a sign-in that lapsed, keeps its own sentence; anything else is a
    // file that is gone, refused or damaged.
    host.log?.('warn', 'team session: a shared file could not be restored', { sessionId, error: String(err) });
    const status = err instanceof files.TeamFileError && (err.status === 0 || err.status === 401) && err.code !== 'CANCELLED' ? err.status : -3;
    return { ok: false, status };
  }
  let hash: string;
  try {
    hash = await teamSessionHash(host, data);
  } catch (err) {
    host.log?.('warn', 'team session: could not build the tool', { sessionId, error: String(err) });
    return { ok: false, status: -1 };
  }
  if (opts.stillWanted && !opts.stillWanted()) return { ok: false, status: -2 };
  const projectId = data.projectId ?? opts.projectId ?? undefined;
  // A session in a project opens that project too, so a "shared it with you" message is done.
  if (projectId) noteProjectOpened(projectId);
  const label = teamSessionLabel(data);
  const role = await teamSessionRole(data, projectId);
  const origin = {
    sessionId: data.id ?? sessionId,
    toolId: data.toolId,
    ...(projectId ? { projectId } : {}),
    ...(data.rev !== undefined ? { rev: data.rev } : {}),
    ...(label ? { label } : {}),
    ...(role ? { role } : {}),
  };
  // The scope provider is registered before the mount it governs starts.
  await prepareTeamScope();
  if (opts.stillWanted && !opts.stillWanted()) return { ok: false, status: -2 };
  // Already on screen (the same document at the same address): setting the hash would
  // remount nothing, so a stash would wait for some later, unrelated mount. The
  // document on screen IS this session, so it takes the origin now.
  if (teamAddressKey(hash) === teamAddressKey(window.location.hash)) {
    adoptTeamSessionOrigin(origin);
    refreshToolReady();
    return { ok: true, toolId: data.toolId, hash, same: true };
  }
  await opts.beforeNavigate?.();
  // The address is a faithful working copy that has otherwise forgotten where it came
  // from: the instance's id for this session is not an input and is deliberately not
  // serialised into a link. Armed LAST, immediately before the navigation it belongs
  // to, so a failure above leaves nothing armed, and with the address it opens, so
  // only the mount at that address can spend the stash.
  rememberTeamSessionOrigin(origin, { hash });
  if (opts.replace) window.location.replace(hash);
  else window.location.hash = hash;
  return { ok: true, toolId: data.toolId, hash };
}

/** The sentence for a failed open, by status. Plain text (a text sink). */
export function teamOpenMessage(status: number): string {
  switch (status) {
    case 404: return tRaw('That team session was not found. It may have been moved, or the link is incomplete.');
    case 410: return tRaw('That team session was deleted.');
    case 403: return tRaw('You do not have access to this team session.');
    case 401: return tRaw('Your sign-in has expired. Sign in again, then open the link.');
    case 0: return tRaw('The instance could not be reached. Try again when you are back online.');
    case -3: return tRaw('A shared file this session uses is not available, so the session could not be opened.');
    default: return tRaw('That session could not be opened.');
  }
}
