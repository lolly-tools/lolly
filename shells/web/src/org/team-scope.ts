// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-scope - a team document's place, said and kept (plan 75 G1, G2 and J5/J6).
 *
 * The provider behind lib/document-scope.ts for documents opened from a team project.
 * It claims the mounted document when org/team-session-origin.ts holds an origin for
 * it, and then:
 *
 *  - the scope chip says which project and the person's role there ("Brand refresh ·
 *    Can edit", "Brand refresh · View only", the workspace-role variant) with the save
 *    state ("Not saved yet", "Saving…", "Saved just now");
 *  - Save, Cmd-S and the leave prompt's Save write back to the session with the
 *    revision it was opened at (compare-and-set), and a newer save by someone else is a
 *    choice, never an overwrite: "Open theirs" keeps these edits as a device copy
 *    first, "Save mine as a copy" files them as a new session in the same project;
 *    inside a live work collab the room saves every change, so Save says so instead
 *    of sending a save the instance would refuse;
 *  - for a viewer (their project role, or a workspace role that cannot edit) every
 *    input is read-only through the document layer of lib/input-policy.ts, a view-only
 *    banner says so, and Save offers "Make a copy" instead: on this device, or in a
 *    project they can edit. The copy then opens with its own scope.
 *
 * Loaded and registered by org/team-session-origin.ts `prepareTeamScope`, which
 * org/team-open.ts awaits before opening a session. That module hands its own reader
 * in ({@link registerTeamScope}) so this one never imports it back. It also never
 * imports org/index.ts, org/team-open.ts or org/team-save.ts, which reach this module
 * in turn; the few save sentences it needs are the same strings those modules use.
 */
import {
  notifyDocumentScopeChange, onDocumentScopeChange, registerDocumentScope,
  type DocumentScopeChip, type DocumentScopeMenuItem, type DocumentScopeMount, type DocumentScopeProvider,
} from '../lib/document-scope.ts';
import { clearDocumentReadOnly, onToolInputMount, setDocumentReadOnly } from '../lib/input-policy.ts';
import { releaseReadableLocks } from '../lib/input-readonly.ts';
import {
  getSessionSource, getSessionWriter, readSourceProjects,
  type TeamRole, type TeamSessionData, type TeamSessionSave,
} from '../lib/session-source.ts';
import type { ShareDocument } from '../lib/share-sections.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import { COLLAB_ACTIVE, saveErrorCode } from './session-source.ts';
import { canWriteProject, conflictCopy, isReadOnlyRole } from './team-access.ts';
import type { TeamOriginApi, TeamSessionOrigin } from './team-session-origin.ts';

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/** The link that opens a team session (org/team-save.ts `teamLinkUrl`, which this
 *  module may not import). */
export function teamScopeLink(sessionId: string, base = getInstanceBase() || globalThis.location?.origin || ''): string {
  return `${base.replace(/\/+$/, '')}/#/team/${encodeURIComponent(sessionId)}`;
}

/** True for a value that is file bytes held in memory, which a JSON body cannot carry. */
function heldFile(value: unknown): boolean {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
  const v = value as { __file?: unknown; bytes?: unknown } | null;
  return typeof value === 'object' && !!v && !!v.__file && !!v.bytes;
}

/** The inputs a save sends: every value except file bytes held in memory (the same
 *  rule as the Share dialog's team save). Pure. */
export function scopeSaveInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(inputs)) {
    if (heldFile(value) || (Array.isArray(value) && value.length > 0 && value.every(heldFile))) continue;
    kept[id] = value;
  }
  return kept;
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortedKeys(obj[k])]));
  }
  return value;
}

/** Whether two sets of input values are the same, ignoring object key order. Pure. */
export function sameScopeInputs(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortedKeys(a)) === JSON.stringify(sortedKeys(b));
}

/** The sentence for a refused save, by status or the instance's code. Plain text. */
export function scopeSaveMessage(status: number, code?: string): string {
  if (code === COLLAB_ACTIVE) return tRaw('This session is open for live editing. Try again when it closes.');
  switch (status) {
    case 413: return tRaw('This document is too large to save to a team project. The limit is 4 MB.');
    case 403: return tRaw('You do not have permission to save changes to this team session.');
    case 404: return tRaw('That team session is no longer on this instance. You can save this document as a new session.');
    case 410: return tRaw('That team session was deleted. You can save this document as a new session.');
    case 401: return tRaw('Your sign-in has expired. Sign in again, then save.');
    case 0: return tRaw('The instance could not be reached. Try again when you are back online.');
    default: return tRaw('Could not save. Try again.');
  }
}

/** The sentence for a refused new session (a copy into a project). Plain text. */
function copyFailure(result: Exclude<TeamSessionSave, { kind: 'saved' }>): string {
  if (result.kind === 'file-error') return result.message;
  if (result.kind === 'conflict') return tRaw('Could not save. Try again.');
  if (result.status === 403) return tRaw('You cannot save to that project.');
  if (result.status === 404) return tRaw('That project or session is no longer on this instance.');
  return scopeSaveMessage(result.status, saveErrorCode(result));
}

/** True when the workspace lets this person change no team session at all: no writer,
 *  or one that says this person may not save over a session (`can['session.edit']`). */
function workspaceViewOnly(): boolean {
  const writer = getSessionWriter();
  return !writer || writer.projectOptions().canEdit === false;
}

/** True when the document of `origin` is view-only for this person. */
export function originViewOnly(origin: Pick<TeamSessionOrigin, 'role'>): boolean {
  return isReadOnlyRole(origin.role) || workspaceViewOnly();
}

// ── State ─────────────────────────────────────────────────────────────────────

let api: TeamOriginApi | null = null;
let registered: Array<() => void> = [];
/** Sessions with a save running, so the chip says "Saving…" and a second save waits. */
const saving = new Set<string>();
/** When each session was last saved from here, for "Saved just now". */
const savedAt = new Map<string, number>();
/** "Saved just now" is honest for this long after the save. */
const SAVED_JUST_NOW_MS = 5 * 60_000;
/** Project names and this person's roles, from the source's project list. */
const projectNames = new Map<string, string>();
const projectRoles = new Map<string, TeamRole>();
const PROJECTS_TTL_MS = 30_000;
let projectsAt = 0;
let projectsLoad: Promise<void> | null = null;

/** Read the project list (at most every 30 seconds) for names and roles. */
function loadProjects(force = false): Promise<void> {
  const source = getSessionSource();
  if (!source) return Promise.resolve();
  if (projectsLoad && (!force || Date.now() - projectsAt < PROJECTS_TTL_MS)) return projectsLoad;
  projectsAt = Date.now();
  projectsLoad = readSourceProjects(source).then((list) => {
    if (!list.ok) return;
    for (const p of list.items) {
      if (p.name) projectNames.set(p.id, p.name);
      if (p.myRole) projectRoles.set(p.id, p.myRole);
    }
    notifyDocumentScopeChange();
  });
  return projectsLoad;
}

/** The place the document belongs, in words: its project's name, when known. */
function placeName(origin: TeamSessionOrigin): string {
  const known = origin.projectName || (origin.projectId ? projectNames.get(origin.projectId) : undefined);
  if (!known && origin.projectId) void loadProjects();
  return known || tRaw('Team project');
}

/** The live origin of the mounted document, when this provider claims the document. */
function originOf(mount: Pick<DocumentScopeMount, 'toolId'>): TeamSessionOrigin | null {
  return api?.active(mount.toolId) ?? null;
}

/** The mount this provider is attached to, per tool: what "Make a copy" copies. */
const attached = new Map<string, DocumentScopeMount>();
/** When a refused edit was last said, so a drag that writes on every move says it once. */
let refusedSaidAt = 0;
const REFUSED_QUIET_MS = 4000;

/** Say that the document is view-only, offering a copy when the mount is known. */
function sayViewOnly(mount: DocumentScopeMount | undefined): void {
  const message = tRaw('This is view only. Make a copy to keep your changes.');
  if (mount) void toast(message, tRaw('Make a copy'), () => { void makeCopy(mount); });
  else announce(message);
}

/** An edit of a view-only document was turned away (lib/input-policy.ts refuseDocumentEdit). */
function editRefused(toolId: string): void {
  const now = Date.now();
  if (now - refusedSaidAt < REFUSED_QUIET_MS) return;
  refusedSaidAt = now;
  sayViewOnly(attached.get(toolId));
}

/** Lock or unlock `toolId`'s inputs for the document now live in that tool. */
function applyViewerLayer(toolId: string): void {
  const origin = api?.active(toolId);
  if (origin && originViewOnly(origin)) setDocumentReadOnly(toolId, tRaw('View only'), () => editRefused(toolId));
  else clearDocumentReadOnly(toolId);
}

async function toast(message: string, actionLabel: string, action: () => void): Promise<void> {
  announce(message);
  try {
    const { showUndoToast } = await import('../lib/undo-toast.ts');
    showUndoToast({ message, actionLabel, undo: action, duration: 8000 });
  } catch { /* the announcement stands on its own */ }
}

async function copyLink(sessionId: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(teamScopeLink(sessionId));
    announce(tRaw('Link copied'));
  } catch {
    announce(tRaw('Could not copy link'), { assertive: true });
  }
}

/** The meta a save sends: the name, and the emoji set the document draws with. */
function docMeta(doc: ShareDocument, label: string | undefined): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = { ...(label ? { label } : {}), ...(doc.emoji ? { emoji: doc.emoji } : {}) };
  return Object.keys(meta).length ? meta : undefined;
}

// ── Make a copy ───────────────────────────────────────────────────────────────

/** Open the "Make a copy" sheet over the mounted document. */
export async function makeCopy(mount: DocumentScopeMount): Promise<boolean> {
  const origin = originOf(mount);
  if (!origin || !api) return false;
  const from = placeName(origin);
  const writer = getSessionWriter();
  const canCopyToProject = !!writer && writer.projectOptions().canSave !== false;
  const projects = canCopyToProject
    ? loadProjects(true).then(() => [...projectRoles].filter(([, role]) => canWriteProject(role))
      .map(([id]) => ({ id, name: projectNames.get(id) ?? id })))
    : [];
  const { openMakeCopySheet } = await import('../components/make-copy-sheet.ts');
  return openMakeCopySheet({
    note: tRaw('The copy is separate. Changes to the copy don’t reach {project}.', { project: from }),
    projects,
    make: async (choice) => {
      if (!api || api.active(mount.toolId)?.sessionId !== origin.sessionId) return null;
      if (choice.where === 'device') {
        // The document stops being the team document first, so the save below is an
        // ordinary save on this device and the chip says so.
        api.detach(mount.toolId);
        const ok = await mount.saveOnDevice();
        if (!ok) return tRaw('Could not save. Try again.');
        announce(tRaw('Copy saved on this device.'));
        return null;
      }
      if (!writer) return scopeSaveMessage(0);
      const doc = mount.document();
      const base = doc.label || origin.label;
      const label = base ? tRaw('{name} (copy)', { name: base }) : undefined;
      const generation = api.generation();
      const saved = await writer.createSession(choice.projectId, {
        toolId: mount.toolId, ...(doc.toolVersion ? { toolVersion: doc.toolVersion } : {}),
        inputs: scopeSaveInputs(doc.inputs), ...(docMeta(doc, label) ? { meta: docMeta(doc, label) } : {}),
      });
      if (saved.kind !== 'saved') return copyFailure(saved);
      const projectName = projectNames.get(choice.projectId);
      api.adopt({
        sessionId: saved.id, toolId: mount.toolId, projectId: choice.projectId, rev: saved.rev,
        role: projectRoles.get(choice.projectId) ?? 'editor',
        ...(label ? { label } : {}), ...(projectName ? { projectName } : {}),
      }, { generation });
      announce(projectName ? tRaw('Saved to {project}.', { project: projectName }) : tRaw('Saved.'));
      return null;
    },
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────

/** Their version, or mine as a copy, after a newer save (or with no revision to quote). */
async function resolveConflict(
  mount: DocumentScopeMount, origin: TeamSessionOrigin, current: TeamSessionData, generation: number, unknownRev: boolean,
): Promise<boolean> {
  if (!api) return false;
  const writer = getSessionWriter();
  const canSave = !!writer && writer.projectOptions().canSave !== false;
  const doc = mount.document();
  const inputs = scopeSaveInputs(doc.inputs);
  const copy = conflictCopy(current, unknownRev);
  const { choiceDialog } = await import('../components/confirm-dialog.ts');
  const choice = await choiceDialog({
    title: copy.title,
    message: copy.message,
    choices: [{ id: 'theirs', label: copy.open }, ...(canSave ? [{ id: 'copy', label: copy.copy, primary: true }] : [])],
  });
  if (choice === 'theirs') {
    // Already the same document: only the revision catches up.
    if (sameScopeInputs(current.inputs, inputs)) {
      if (current.rev !== undefined) api.noteSaved(origin.sessionId, current.rev, undefined, { generation });
      announce(tRaw('Their version matches yours.'));
      return true;
    }
    // These edits stay on this device as a copy first, then their version opens.
    await mount.saveOnDevice();
    globalThis.location.hash = `#/team/${encodeURIComponent(origin.sessionId)}`;
    return false;
  }
  if (choice === 'copy' && writer) {
    const projectId = current.projectId ?? origin.projectId;
    if (!projectId) { announce(tRaw('Could not tell which project this session is in.'), { assertive: true }); return false; }
    const base = doc.label || origin.label;
    const label = base ? tRaw('{name} (copy)', { name: base }) : undefined;
    const saved = await writer.createSession(projectId, {
      toolId: mount.toolId, ...(doc.toolVersion ? { toolVersion: doc.toolVersion } : {}),
      inputs, ...(docMeta(doc, label) ? { meta: docMeta(doc, label) } : {}),
    });
    if (saved.kind !== 'saved') {
      void toast(copyFailure(saved), tRaw('Try again'), () => { void resolveConflict(mount, origin, current, generation, unknownRev); });
      return false;
    }
    const next = api.adopt({ ...origin, sessionId: saved.id, projectId, rev: saved.rev, ...(label ? { label } : {}) }, { generation });
    if (!next) return false;
    savedAt.set(next.sessionId, Date.now());
    announce(tRaw('Saved as a new copy.'));
    return true;
  }
  return false;
}

/** Save the mounted team document back to its session. Resolves true when saved. */
async function save(mount: DocumentScopeMount): Promise<boolean> {
  const origin = originOf(mount);
  if (!origin || !api) return false;
  if (originViewOnly(origin)) {
    sayViewOnly(mount);
    return false;
  }
  if (api.live(origin.sessionId)) {
    announce(tRaw('The live collab saves your changes to this session.'));
    return true;
  }
  const writer = getSessionWriter();
  if (!writer || saving.has(origin.sessionId)) return false;
  const generation = api.generation();
  const retry = (): void => { void save(mount); };
  saving.add(origin.sessionId);
  notifyDocumentScopeChange();
  try {
    if (origin.rev === undefined) {
      // No revision to quote: never save over the session blind. Fetch it and ask.
      const current = await getSessionSource()?.fetchSession(origin.sessionId);
      if (!current) { void toast(scopeSaveMessage(404), tRaw('Try again'), retry); return false; }
      return await resolveConflict(mount, origin, current, generation, true);
    }
    const doc = mount.document();
    const label = doc.label || origin.label;
    const meta = docMeta(doc, label);
    const result = await writer.updateSession({
      id: origin.sessionId, ...(origin.projectId ? { projectId: origin.projectId } : {}),
      inputs: scopeSaveInputs(doc.inputs), ...(meta ? { meta } : {}), rev: origin.rev,
    });
    if (result.kind === 'saved') {
      api.noteSaved(origin.sessionId, result.rev, label, { generation });
      savedAt.set(origin.sessionId, Date.now());
      void toast(tRaw('Saved to {project}.', { project: placeName(origin) }), tRaw('Copy team link'), () => { void copyLink(origin.sessionId); });
      return true;
    }
    if (result.kind === 'conflict') return await resolveConflict(mount, origin, result.current, generation, false);
    if (result.kind === 'file-error') { void toast(result.message, tRaw('Try again'), retry); return false; }
    if (result.status === 404 || result.status === 410) {
      // The session is gone: the document is this device's again, and says so.
      if (api.generation() === generation) api.detach(mount.toolId);
      announce(scopeSaveMessage(result.status), { assertive: true });
      return false;
    }
    void toast(scopeSaveMessage(result.status, saveErrorCode(result)), tRaw('Try again'), retry);
    return false;
  } finally {
    saving.delete(origin.sessionId);
    notifyDocumentScopeChange();
  }
}

// ── The provider ──────────────────────────────────────────────────────────────

/** The chip for the mounted team document, or null when it is not one. */
export function teamScopeChip(mount: DocumentScopeMount): DocumentScopeChip | null {
  const origin = originOf(mount);
  if (!origin) return null;
  const project = placeName(origin);
  if (workspaceViewOnly()) return { label: tRaw('{project} · View only (workspace role)', { project }), role: 'view' };
  if (isReadOnlyRole(origin.role)) return { label: tRaw('{project} · View only', { project }), role: 'view' };
  // In a live work collab the room saves every change: there is no save state to say.
  if (api?.live(origin.sessionId)) return { label: tRaw('{project} · Can edit', { project }), role: 'edit' };
  const at = savedAt.get(origin.sessionId);
  const state = saving.has(origin.sessionId) ? tRaw('Saving…')
    : mount.unsaved() ? tRaw('Not saved yet')
      : at !== undefined && Date.now() - at < SAVED_JUST_NOW_MS ? tRaw('Saved just now')
        : undefined;
  return { label: tRaw('{project} · Can edit', { project }), role: 'edit', ...(state ? { state } : {}) };
}

function menu(mount: DocumentScopeMount): DocumentScopeMenuItem[] {
  const origin = originOf(mount);
  if (!origin) return [];
  const link: DocumentScopeMenuItem = { id: 'copy-link', label: tRaw('Copy team link'), run: () => { void copyLink(origin.sessionId); } };
  if (originViewOnly(origin)) return [{ id: 'make-copy', label: tRaw('Make a copy'), run: () => { void makeCopy(mount); } }, link];
  return [
    {
      id: 'save',
      label: tRaw('Save changes'),
      // The tool's own Save, so the button, the leave guard and this chip agree.
      run: () => {
        const button = mount.view.querySelector<HTMLElement>('#render-save, [data-action="save"]');
        if (button) button.click();
        else void save(mount);
      },
    },
    {
      id: 'save-device',
      label: tRaw('Save a copy on this device'),
      run: () => { void mount.saveOnDevice().then((ok) => { if (ok) announce(tRaw('Copy saved on this device.')); }); },
    },
    link,
  ];
}

/** The view-only banner's sentence for `origin`. Plain text. */
function bannerMessage(origin: TeamSessionOrigin): string {
  if (workspaceViewOnly()) {
    const workspace = getSessionSource()?.label || tRaw('Team project');
    return tRaw('Your role on {workspace} lets you view only. Ask an admin of {workspace} to change your role.', { workspace });
  }
  return tRaw('View only. Changes can’t be saved to {project}.', { project: placeName(origin) });
}

/** The banner and read-only layer for as long as this provider claims the mount. */
function attach(mount: DocumentScopeMount): () => void {
  let banner: { update(message: string): void; destroy(): void } | null = null;
  let loading = false;
  let ended = false;
  let locked = false;
  // Runs on every scope change: the origin moved, a save ended, a project name came in.
  const sync = (): void => {
    if (ended) return;
    const origin = originOf(mount);
    const viewOnly = !!origin && originViewOnly(origin);
    applyViewerLayer(mount.toolId);
    if (locked && !viewOnly) releaseReadableLocks(mount.view);
    locked = viewOnly;
    if (!viewOnly || !origin) { banner?.destroy(); banner = null; return; }
    if (banner) { banner.update(bannerMessage(origin)); return; }
    if (loading) return;
    loading = true;
    void import('../components/viewer-banner.ts').then(({ mountViewerBanner }) => {
      loading = false;
      const now = originOf(mount);
      if (ended || banner || !now || !originViewOnly(now)) return;
      banner = mountViewerBanner(mount.view, { message: bannerMessage(now), action: { label: tRaw('Make a copy'), run: () => { void makeCopy(mount); } } });
    }).catch(() => { loading = false; });
  };
  attached.set(mount.toolId, mount);
  const off = onDocumentScopeChange(sync);
  sync();
  return () => {
    ended = true;
    if (attached.get(mount.toolId) === mount) attached.delete(mount.toolId);
    off();
    banner?.destroy();
    banner = null;
    clearDocumentReadOnly(mount.toolId);
    if (locked) releaseReadableLocks(mount.view);
  };
}

const provider: DocumentScopeProvider = {
  chip: teamScopeChip,
  save,
  leavePrompt: (mount) => {
    const origin = originOf(mount);
    return origin && !originViewOnly(origin) && !api?.live(origin.sessionId)
      ? tRaw('Save changes to {project}?', { project: placeName(origin) }) : null;
  },
  menu,
  attach,
};

/**
 * Register the provider, the read-only layer's mount hook and the origin listener,
 * with `origin` as the reader of team-session-origin.ts. Idempotent: a second call
 * only swaps the reader.
 */
export function registerTeamScope(origin: TeamOriginApi): void {
  api = origin;
  if (registered.length) return;
  registered = [
    registerDocumentScope(provider),
    // Before every sidebar's first draw: a viewer's document is read-only from the start.
    onToolInputMount(applyViewerLayer),
    origin.onChange(() => notifyDocumentScopeChange()),
  ];
}

/** TEST-ONLY: unregister everything and forget what was learned. */
export function _resetTeamScopeForTests(): void {
  for (const off of registered) off();
  registered = [];
  api = null;
  saving.clear();
  savedAt.clear();
  projectNames.clear();
  projectRoles.clear();
  projectsAt = 0;
  projectsLoad = null;
  attached.clear();
  refusedSaidAt = 0;
}

export { save as _saveTeamScopeForTests };
