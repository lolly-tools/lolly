// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-save - the "Team" section of the Share dialog: save the document on screen
 * to a team project on this instance, save changes back to the team session it came
 * from, and copy a link that opens that session for anyone who can see its project.
 *
 * Registered by org/index.ts through the generic lib/share-sections.ts seam, for
 * members only, and lazy-loaded when the dialog opens. It renders nothing unless the
 * registered session source can write (lib/session-source.ts `write`), so a plain
 * deployment, a read-only instance and a non-member all get the dialog unchanged.
 *
 * Two shapes, chosen by the live mount's team origin (org/team-session-origin.ts):
 *
 *  - a fresh document (no origin): "Save to a team project". Pick a project this
 *    person can see, or create one ("Only me", or a group the instance offers).
 *    Saving makes the document a team document, so the next save is a save back.
 *  - a team document: "Save changes" quotes the revision it was opened or last saved
 *    at. When someone saved after that, the server answers 409 with their version and
 *    this asks: "Open theirs", or "Save mine as a copy" in the same project. Nothing
 *    is overwritten without that choice. "Copy team link" gives `#/team/<id>`.
 *    A viewer of the session's project (its `myRole` in the project list) is not
 *    offered "Save changes": "Save a copy to a project" saves it as a new session in
 *    a project they can write to instead (org/team-access.ts teamSaveChoice). "People"
 *    opens the project's "People with access" (org/team-people.ts) for anyone the
 *    instance lets see the panel. When the instance takes access requests, a viewer
 *    also gets "Ask to edit" (org/access-request.ts), here and beside the empty
 *    project picker's "Ask a project owner for edit access." line.
 *
 * Images and files added on this device are referenced, not uploaded (they live in
 * the device's own asset store), unless the instance shares project files: then the
 * save uploads them to the project first (org/team-files.ts), and a file that cannot
 * be shared stops the save with its own sentence (teamSaveFailure). A file input's
 * bytes (a FileRef, or a list of them) are left out of the save, so before any save
 * the section says plainly how many stay on this device. The values saved are the
 * ones a local Save keeps (views/tool-session-snapshot.ts `sessionInputValues`,
 * handed in through the section context), so blocks and tables travel whole.
 */
import type { ShareDocument, ShareSectionContext } from '../lib/share-sections.ts';
import { getSessionSource, type TeamProjectRef, type TeamRole, type TeamSessionData, type TeamSessionSave } from '../lib/session-source.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { collectSessionAssetRefs } from '../lib/beam-pack.ts';
import { choiceDialog } from '../components/confirm-dialog.ts';
import { announce } from '../a11y.ts';
import { tRaw } from '../i18n.ts';
import {
  activeTeamSessionOrigin, adoptTeamSessionOrigin, noteTeamSessionSaved, releaseTeamSessionOrigin, teamOriginGeneration,
  teamSessionLive, type TeamSessionOrigin,
} from './team-session-origin.ts';
import { openTeamSession, teamOpenMessage, teamSessionLabel } from './team-open.ts';
import { buildNewProjectForm } from './team-project-form.ts';
import { canWriteProject, conflictCopy, invitePolicy, isReadOnlyRole, peopleAccess, teamPickerEmpty, teamSaveChoice, type InviteConfig } from './team-access.ts';
import { COLLAB_ACTIVE, saveErrorCode } from './session-source.ts';
import { buildAskForm, projectRequestsOn } from './access-request.ts';
import { getCollabOpener } from '../lib/collab-launch.ts';

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/** The link that opens a team session: the instance's app with `#/team/<id>`. */
export function teamLinkUrl(sessionId: string, base = getInstanceBase() || globalThis.location?.origin || ''): string {
  return `${base.replace(/\/+$/, '')}/#/team/${encodeURIComponent(sessionId)}`;
}

/** True for bytes held in memory directly. */
function isBinary(value: unknown): boolean {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

/** True for a loaded file input value: the engine's FileRef (`{__file, name, type,
 *  bytes}`, engine/src/inputs.ts `isFileValue`), which carries the file's bytes. */
function isFileRef(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { __file?: unknown; bytes?: unknown };
  return Boolean(v.__file) && Boolean(v.bytes);
}

/** How many files held in memory a value is: 1 for one file, n for a `multiple` file
 *  input's list, 0 for anything else. A JSON body cannot carry them. */
function heldFiles(value: unknown): number {
  if (isBinary(value) || isFileRef(value)) return 1;
  if (Array.isArray(value) && value.length && value.every((v) => isBinary(v) || isFileRef(v))) return value.length;
  return 0;
}

/**
 * The inputs a team save sends, and how many images or files stay behind on this
 * device: every `user/` asset the values reference (the same walk a .lolly pack uses
 * to find device-local files), plus every file a file input holds in memory, which is
 * left out of the save. Pure.
 */
export function teamSaveInputs(inputs: Record<string, unknown>): { inputs: Record<string, unknown>; deviceLocal: number } {
  const kept: Record<string, unknown> = {};
  let files = 0;
  for (const [id, value] of Object.entries(inputs)) {
    const n = heldFiles(value);
    if (n) { files += n; continue; }
    kept[id] = value;
  }
  return { inputs: kept, deviceLocal: collectSessionAssetRefs(kept).user.length + files };
}

/** A value with every object's keys sorted, so two equal documents compare equal
 *  whatever order a store wrote their keys in (Postgres jsonb reorders them). */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortedKeys(obj[k])]));
  }
  return value;
}

/** Whether two sets of input values are the same, ignoring object key order. Pure. */
export function sameInputs(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortedKeys(a)) === JSON.stringify(sortedKeys(b));
}

/** The honest sentence about device-local files, or '' when there are none. */
export function deviceLocalNote(count: number): string {
  if (count <= 0) return '';
  return count === 1
    ? tRaw('1 image or file was added on this device. It stays on this device, and others will not see that file.')
    : tRaw('{n} images or files were added on this device. They stay on this device, and others will not see those files.', { n: count });
}

/**
 * Whether this person can join a live collab from the Share dialog and edit there: the
 * Work collab section's own gate (org/collab-share.ts: `collab.join` and a registered
 * `'work'` opener) plus the `collab.edit` bit the opener checks on press. Read from the
 * config `buildTeamShareSection` is handed, since this module never imports
 * org/index.ts. Pure apart from the opener registry.
 */
export function liveCollabJoinable(config: InviteConfig | null | undefined): boolean {
  const can = config?.can;
  return can?.['collab.join'] === true && can?.['collab.edit'] === true && !!getCollabOpener('work');
}

/** The sentence for a failed save, by status, or by the instance's error code when it
 *  sent one this section knows (org/session-source.ts saveErrorCode). `joinable` is
 *  {@link liveCollabJoinable}. Plain text. */
export function teamSaveMessage(status: number, code?: string, joinable = false): string {
  // A live collab holds the session and saves it as people edit, so the instance takes
  // no save from outside the room until the room closes. The way in is the Work collab
  // section's Start a collab, which joins the room already there (rooms are keyed by
  // session); without that section, or without edit rights in a room, there is no way in.
  if (code === COLLAB_ACTIVE) {
    return joinable
      ? tRaw('This session is open for live editing. Use Start a collab to join in.')
      : tRaw('This session is open for live editing. Try again when it closes.');
  }
  switch (status) {
    case 413: return tRaw('This document is too large to save to a team project. The limit is 4 MB.');
    case 403: return tRaw('You cannot save to that project.');
    case 404: return tRaw('That project or session is no longer on this instance.');
    case 410: return tRaw('That team session was deleted.');
    case 401: return tRaw('Your sign-in has expired. Sign in again, then save.');
    case 0: return tRaw('The instance could not be reached. Try again when you are back online.');
    default: return tRaw('Could not save. Try again.');
  }
}

/** The sentence for a save that did not happen: a file the document uses could not be
 *  shared (the source's own sentence, never a session status), a refusal by status,
 *  or a conflict with no version to offer. Plain text. */
export function teamSaveFailure(result: Exclude<TeamSessionSave, { kind: 'saved' }>, joinable = false): string {
  if (result.kind === 'file-error') return result.message;
  return teamSaveMessage(result.kind === 'error' ? result.status : 409, saveErrorCode(result), joinable);
}

// ── DOM ─────────────────────────────────────────────────────────────────────

let sectionSeq = 0;

/** The docked Share panel rebuilds its sections whenever the document changes, so the
 *  project list is kept for a short while instead of being fetched on every edit. */
const PROJECTS_TTL_MS = 30_000;
let projectsMemo: { source: object; at: number; list: Promise<TeamProjectRef[]> } | null = null;

/** The person's role in each project, from the last project list that said. Read
 *  synchronously, so a section rebuilt on an edit renders the right save at once. */
const knownRoles = new Map<string, TeamRole>();
/** Each project's name from the same list, for "Ask to edit {project}". */
const knownNames = new Map<string, string>();
/** Projects this person asked to edit from this dialog, while the page is open. The
 *  docked panel rebuilds its sections on every edit, and the button keeps saying the
 *  request went. */
const editAsked = new Set<string>();

function teamProjects(): Promise<TeamProjectRef[]> {
  const source = getSessionSource();
  if (!source) return Promise.resolve([]);
  if (projectsMemo && projectsMemo.source === source && Date.now() - projectsMemo.at < PROJECTS_TTL_MS) return projectsMemo.list;
  const list = source.listProjects().catch(() => [] as TeamProjectRef[]).then((l) => {
    for (const p of l) {
      if (p.myRole) knownRoles.set(p.id, p.myRole);
      if (p.name) knownNames.set(p.id, p.name);
    }
    return l;
  });
  projectsMemo = { source, at: Date.now(), list };
  return list;
}

/** A project just created goes to the top of the kept list. The person who created it
 *  owns it, so "People" is offered at once instead of after the kept list expires. */
function rememberProject(project: TeamProjectRef): void {
  knownRoles.set(project.id, project.myRole ?? 'owner');
  if (project.name) knownNames.set(project.id, project.name);
  if (!projectsMemo) return;
  const prev = projectsMemo.list;
  projectsMemo = { ...projectsMemo, list: prev.then((l) => [project, ...l.filter((x) => x.id !== project.id)]) };
}

/** What a finished save leaves to show: a sentence, and whether it is an error. Null
 *  when there is nothing to say (the person cancelled, or moved to another document). */
interface SaveOutcome { message: string; error: boolean }

/**
 * Saves still running, by tool and mount. The docked Share panel rebuilds its sections
 * on every edit, so the section that started a save may be gone by the time the save
 * ends; a section built meanwhile shows the save as running (and offers no second
 * save), then shows how it ended.
 */
const inflight = new Map<string, Promise<SaveOutcome | null>>();
const inflightKey = (toolId: string): string => `${toolId}#${teamOriginGeneration()}`;

function trackSave(toolId: string, work: () => Promise<SaveOutcome | null>): Promise<SaveOutcome | null> {
  const key = inflightKey(toolId);
  const run = work().catch(() => ({ message: tRaw('Could not save. Try again.'), error: true }));
  inflight.set(key, run);
  void run.finally(() => { if (inflight.get(key) === run) inflight.delete(key); });
  return run;
}

/** TEST-ONLY: forget the kept project list and any running saves. */
export function _clearTeamProjectsForTests(): void {
  projectsMemo = null;
  knownRoles.clear();
  knownNames.clear();
  editAsked.clear();
  inflight.clear();
}

/** A field's label: 13px at the default type size, growing with Large text as the fields do. */
const LABEL_STYLE = 'font-size:var(--fs-md);font-weight:600';
const HEADING_STYLE = 'margin:0 0 .5rem;font-size:.82rem;font-weight:650;letter-spacing:.02em;text-transform:uppercase;color:hsl(var(--muted-foreground))';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: { className?: string; text?: string; style?: string } = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.className) node.className = attrs.className;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.style) node.style.cssText = attrs.style;
  return node;
}

function option(label: string, value: string): HTMLOptionElement {
  const o = el('option', { text: label });
  o.value = value;
  return o;
}

function button(label: string, act: string, primary = false): HTMLButtonElement {
  const b = el('button', { className: primary ? 'btn btn--primary btn--sm' : 'btn btn--sm', text: label });
  b.type = 'button';
  b.dataset.act = act;
  return b;
}

/** A status line under the rows: errors in the destructive colour, success muted. */
function statusLine(): { node: HTMLElement; error(msg: string): void; ok(msg: string): void; clear(): void } {
  const node = el('p', { className: 'share-team-status', style: 'margin:.45rem 0 0;font-size:12px' });
  node.setAttribute('role', 'status');
  node.hidden = true;
  const show = (msg: string, error: boolean): void => {
    node.textContent = msg;
    node.style.color = error ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';
    node.hidden = false;
    announce(msg, { assertive: error });
  };
  return {
    node,
    error: (msg) => show(msg, true),
    ok: (msg) => show(msg, false),
    clear: () => { node.hidden = true; node.textContent = ''; },
  };
}

/** Run `work` with the button disabled and relabelled; restores it afterwards. */
async function busy<T>(btn: HTMLButtonElement, label: string, work: () => Promise<T>): Promise<T> {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try { return await work(); } finally { btn.disabled = false; btn.textContent = prev; }
}

/**
 * Build the Team section, or null when there is nothing to offer: no writable session
 * source, no tool, or a fresh document the dialog cannot read (a saved creation
 * shared from Projects, which has no live document) or the instance does not let this
 * person save (`can['session.create']` false, a viewer). "Save changes" follows
 * `can['session.edit']` the same way when the instance sends that bit.
 *
 * `readConfig` reads the instance's org-config when the section draws, for the
 * invite policy behind "People". org/index.ts passes its own reader in: this module
 * never imports org/index.ts, which lazy-loads it, so the two stay out of a cycle.
 * Without a reader there is no invite policy and "People" is not offered.
 */
export function buildTeamShareSection(ctx: ShareSectionContext, readConfig: () => InviteConfig | null = () => null): HTMLElement | null {
  const writer = getSessionSource()?.write;
  const toolId = ctx.toolId;
  if (!writer || !toolId) return null;
  const options = writer.projectOptions();
  const canSave = options.canSave !== false;
  const canEdit = options.canEdit !== false;
  const startOrigin = activeTeamSessionOrigin(toolId);
  if (!startOrigin && !(ctx.document && canSave)) return null;

  // Above the dialog's own rows (placement 'lead') the divider goes under the section,
  // between it and the dialog's link; below them it goes on top, like the others.
  const section = el('section', {
    className: 'share-instance share-team',
    style: ctx.placement === 'lead'
      ? 'padding-bottom:.9rem;border-bottom:1px solid hsl(var(--border))'
      : 'margin-top:.9rem;padding-top:.8rem;border-top:1px solid hsl(var(--border))',
  });
  section.append(el('h3', { text: tRaw('Team'), style: HEADING_STYLE }));
  const body = el('div');
  section.append(body);

  /** The document as it is now, ready to send, with its device-local count. */
  const readDoc = (): (ShareDocument & { deviceLocal: number }) | null => {
    const doc = ctx.document?.();
    if (!doc) return null;
    const { inputs, deviceLocal } = teamSaveInputs(doc.inputs);
    return { ...doc, inputs, deviceLocal };
  };
  /** The meta a save sends: the name, and the emoji set the document draws with. */
  const docMeta = (doc: ShareDocument, label: string | undefined): Record<string, unknown> | undefined => {
    const meta: Record<string, unknown> = {
      ...(label ? { label } : {}),
      ...(doc.emoji ? { emoji: doc.emoji } : {}),
    };
    return Object.keys(meta).length ? meta : undefined;
  };
  const warning = (): HTMLElement | null => {
    const doc = readDoc();
    const shared = writer.projectOptions().canShareFiles ? collectSessionAssetRefs(doc?.inputs ?? {}).user.length : 0;
    const note = [shared ? tRaw('Uploaded images and files are shared with everyone who can see this project when you save.') : '',
      deviceLocalNote((doc?.deviceLocal ?? 0) - shared)].filter(Boolean).join(' ');
    return note ? el('p', { className: 'share-shortest-note', text: note, style: 'display:block;margin:.4rem 0 0' }) : null;
  };

  /**
   * "Ask to edit" for a viewer of `projectId`, when the instance takes access
   * requests: a button that opens the ask form (org/access-request.ts) in `slot`, and
   * reads "Edit request sent" once the request has gone. Null otherwise.
   */
  const askEditButton = (projectId: string, slot: HTMLElement): HTMLButtonElement | null => {
    if (!projectRequestsOn(readConfig())) return null;
    const sent = (b: HTMLButtonElement): void => {
      b.textContent = tRaw('Edit request sent');
      b.disabled = true;
    };
    const ask = button(tRaw('Ask to edit'), 'team-ask-edit');
    ask.setAttribute('aria-expanded', 'false');
    if (editAsked.has(projectId)) sent(ask);
    ask.addEventListener('click', () => {
      if (slot.firstChild) {
        slot.replaceChildren();
        ask.setAttribute('aria-expanded', 'false');
        return;
      }
      ask.setAttribute('aria-expanded', 'true');
      const project = knownNames.get(projectId);
      slot.replaceChildren(buildAskForm({
        target: { projectId },
        defaultRole: 'editor',
        fixedRole: 'editor',
        level: 4,
        heading: project ? tRaw('Ask to edit {project}', { project }) : tRaw('Ask to edit'),
        ...(project ? { intro: tRaw('The managers of {project} will see your request.', { project }) } : {}),
        onState: (state) => {
          if (state !== 'sent') return;
          editAsked.add(projectId);
          sent(ask);
        },
      }));
    });
    return ask;
  };

  // ── A team document: save changes, copy its link ─────────────────────────────
  // Bumped on every render, so a role that arrives after a render only redraws the
  // section when nothing else has redrawn it since.
  let renderSeq = 0;
  const renderOrigin = (origin: TeamSessionOrigin, outcome?: SaveOutcome | null): void => {
    const seq = ++renderSeq;
    body.replaceChildren();
    const name = origin.label ? tRaw('Team session: {name}', { name: origin.label }) : tRaw('This document is a team session.');
    body.append(el('span', { className: 'share-shortest-note', text: name, style: 'display:block;margin-bottom:.5rem' }));
    const status = statusLine();
    const actions = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;align-items:center' });
    const role = origin.projectId ? knownRoles.get(origin.projectId) : undefined;
    const choice = teamSaveChoice(role, { hasDocument: !!ctx.document, canEdit, canSave });
    // This tab is in the live collab on this session: the room saves every change, and
    // the instance refuses a save from outside the room, so "Save changes" is not offered.
    const live = teamSessionLive(origin.sessionId);
    if (choice === 'save-changes' && live) {
      body.append(el('span', {
        className: 'share-shortest-note',
        text: tRaw('The live collab saves your changes to this session.'),
        style: 'display:block;margin-bottom:.5rem',
      }));
    } else if (choice === 'save-changes') {
      const save = button(tRaw('Save changes'), 'team-save-changes', true);
      save.addEventListener('click', () => { void trackSave(toolId, () => saveChanges(save, status)); });
      actions.append(save);
    } else if (choice === 'save-copy') {
      const copy = button(tRaw('Save a copy to a project'), 'team-save-copy', true);
      copy.addEventListener('click', () => renderFresh(null, origin));
      actions.append(copy);
    }
    // A viewer or commenter may ask the project's managers for edit access.
    const askSlot = el('div');
    const askEdit = isReadOnlyRole(role) && origin.projectId ? askEditButton(origin.projectId, askSlot) : null;
    if (askEdit) actions.append(askEdit);
    const peopleSlot = el('div');
    const policy = invitePolicy(readConfig());
    if (origin.projectId && peopleAccess(role, policy) !== 'hidden') {
      const projectId = origin.projectId;
      const people = button(tRaw('People'), 'team-people');
      people.setAttribute('aria-expanded', 'false');
      people.addEventListener('click', () => {
        if (peopleSlot.firstChild) {
          peopleSlot.replaceChildren();
          peopleSlot.style.marginTop = '';
          people.setAttribute('aria-expanded', 'false');
          return;
        }
        people.setAttribute('aria-expanded', 'true');
        void import('./team-people.ts').then(({ buildPeoplePanel, revealPeoplePanel }) => {
          if (people.getAttribute('aria-expanded') !== 'true') return;
          // Spaced from the status line above it, only while it is open.
          peopleSlot.style.marginTop = '.75rem';
          // The panel's own copier, which says when the clipboard refused the link.
          const panel = buildPeoplePanel({ projectId, policy });
          peopleSlot.replaceChildren(panel);
          // It is drawn under the team link; bring it into view and onto its heading.
          revealPeoplePanel(panel);
        }).catch(() => status.error(tRaw('That could not be opened. Try again.')));
      });
      actions.append(people);
    }
    body.append(actions, askSlot);
    const w = choice === 'save-changes' && !live ? warning() : null;
    if (w) body.append(w);
    // Read the role again on every render (the kept list bounds this to one request
    // per 30 seconds), and redraw if it changed what is offered: a viewer promoted to
    // editor gets Save changes, a demoted editor loses it, without a reload. The
    // server refuses a viewer's save either way; this only keeps the offer right.
    if (origin.projectId) {
      void teamProjects().then(() => {
        const next = knownRoles.get(origin.projectId!);
        if (seq !== renderSeq || !next || next === role || !section.isConnected || inflight.has(inflightKey(toolId))) return;
        const nextChoice = teamSaveChoice(next, { hasDocument: !!ctx.document, canEdit, canSave });
        const askChanged = isReadOnlyRole(next) !== isReadOnlyRole(role);
        if (nextChoice !== choice || peopleAccess(next, policy) !== peopleAccess(role, policy) || askChanged) renderOrigin(origin, outcome);
      });
    }

    const linkRow = el('div', { className: 'share-link-row', style: 'margin-top:.6rem' });
    const field = el('input', { className: 'share-link-field' });
    field.type = 'text';
    field.readOnly = true;
    field.value = teamLinkUrl(origin.sessionId);
    field.setAttribute('aria-label', tRaw('Team link'));
    const copyBtn = el('button', { className: 'share-copy-btn', text: tRaw('Copy team link') });
    copyBtn.type = 'button';
    copyBtn.dataset.act = 'team-copy-link';
    copyBtn.addEventListener('click', async () => {
      await ctx.copy(field.value);
      announce(tRaw('Link copied'));
      const prev = copyBtn.textContent;
      copyBtn.textContent = tRaw('Copied!');
      setTimeout(() => { copyBtn.textContent = prev; }, 1500);
    });
    linkRow.append(field, copyBtn);
    body.append(linkRow, el('span', {
      className: 'share-shortest-note',
      text: tRaw('Opens this session for anyone on this instance who can see its project.'),
      style: 'display:block;margin-top:.2rem',
    }), status.node, peopleSlot);
    if (outcome) (outcome.error ? status.error : status.ok)(outcome.message);
  };

  const saveChanges = async (btn: HTMLButtonElement, status: ReturnType<typeof statusLine>): Promise<SaveOutcome | null> => {
    const origin = activeTeamSessionOrigin(toolId);
    const doc = readDoc();
    if (!origin || !doc) return null;
    const generation = teamOriginGeneration();
    status.clear();
    const label = doc.label || origin.label;
    const meta = docMeta(doc, label);
    const fail = (message: string): SaveOutcome => { status.error(message); return { message, error: true }; };
    if (origin.rev === undefined) {
      // No revision to quote (the instance did not report one when the session was
      // opened), so a save could not tell a newer version from this one. Never save
      // over it blind: fetch what is there and ask, as for a conflict.
      const current = await busy(btn, tRaw('Saving…'), async () => getSessionSource()?.fetchSession(origin.sessionId) ?? null);
      if (!current) return fail(teamSaveMessage(404));
      return resolveConflict(origin, doc, current, status, generation, true);
    }
    const rev = origin.rev;
    const result = await busy(btn, tRaw('Saving…'), () =>
      writer.updateSession({ id: origin.sessionId, ...(origin.projectId ? { projectId: origin.projectId } : {}), inputs: doc.inputs, ...(meta ? { meta } : {}), rev }));
    if (result.kind === 'saved') {
      noteTeamSessionSaved(origin.sessionId, result.rev, label, { generation });
      status.ok(tRaw('Saved.'));
      return { message: tRaw('Saved.'), error: false };
    }
    if (result.kind === 'conflict') return resolveConflict(origin, doc, result.current, status, generation, false);
    if (result.kind === 'file-error') return fail(result.message);
    if (result.status === 404 || result.status === 410) {
      // The session is gone, so the document is no longer a team document. Tell the
      // person and show the fresh save, because "Save changes" could only fail again.
      if (teamOriginGeneration() === generation) releaseTeamSessionOrigin();
      const message = result.status === 410
        ? tRaw('That team session was deleted. You can save this document as a new session.')
        : tRaw('That team session is no longer on this instance. You can save this document as a new session.');
      const outcome = { message, error: true };
      show(outcome);
      return outcome;
    }
    return fail(result.status === 403
      ? tRaw('You do not have permission to save changes to this team session.')
      : teamSaveMessage(result.status, saveErrorCode(result), liveCollabJoinable(readConfig())));
  };

  /** Their version, or mine as a copy. `unknownRev`: there was no revision to compare,
   *  so the dialog says that instead of claiming someone saved after this person. */
  const resolveConflict = async (
    origin: TeamSessionOrigin,
    doc: ShareDocument & { deviceLocal: number },
    current: TeamSessionData,
    status: ReturnType<typeof statusLine>,
    generation: number,
    unknownRev: boolean,
  ): Promise<SaveOutcome | null> => {
    const fail = (message: string): SaveOutcome => { status.error(message); return { message, error: true }; };
    const done = (message: string): SaveOutcome => { status.ok(message); return { message, error: false }; };
    const copy = conflictCopy(current, unknownRev);
    const choice = await choiceDialog({
      title: copy.title,
      message: copy.message,
      choices: [
        { id: 'theirs', label: copy.open },
        ...(canSave ? [{ id: 'copy', label: copy.copy, primary: true }] : []),
      ],
    });
    if (choice === 'theirs') {
      const theirs: TeamSessionData = {
        ...current,
        id: origin.sessionId,
        ...(current.projectId ?? origin.projectId ? { projectId: current.projectId ?? origin.projectId } : {}),
      };
      // Their version already matches what is on screen: nothing to open, only the
      // revision to catch up with, so the next save is not refused again.
      if (sameInputs(theirs.inputs, doc.inputs)) {
        if (theirs.rev !== undefined) noteTeamSessionSaved(origin.sessionId, theirs.rev, teamSessionLabel(theirs), { generation });
        return done(tRaw('Their version matches yours.'));
      }
      // The revision moves with the open itself: the remount takes theirs from the
      // stash. A failed open leaves this document on its old revision, so the next
      // save conflicts again instead of quietly overwriting theirs.
      const got = await openTeamSession(origin.sessionId, { data: theirs, beforeNavigate: () => ctx.close?.() });
      if (got.ok) return got.same ? done(tRaw('Their version matches yours.')) : null;
      return fail(teamOpenMessage(got.status));
    }
    if (choice === 'copy') {
      const projectId = current.projectId ?? origin.projectId;
      if (!projectId) return fail(tRaw('Could not tell which project this session is in.'));
      const base = doc.label || origin.label;
      const label = base ? tRaw('{name} (copy)', { name: base }) : undefined;
      const meta = docMeta(doc, label);
      const saved = await writer.createSession(projectId, {
        toolId, ...(doc.toolVersion ? { toolVersion: doc.toolVersion } : {}), inputs: doc.inputs, ...(meta ? { meta } : {}),
      });
      if (saved.kind !== 'saved') return fail(teamSaveFailure(saved, liveCollabJoinable(readConfig())));
      const next = adoptTeamSessionOrigin({ sessionId: saved.id, toolId, projectId, rev: saved.rev, ...(label ? { label } : {}) }, { generation });
      if (!next) return null;
      const outcome = { message: tRaw('Saved as a new copy.'), error: false };
      renderOrigin(next, outcome);
      return outcome;
    }
    return null;
  };

  // ── A fresh document: save it to a team project ──────────────────────────────
  /** `copyOf`: the team document on screen, saved as a new session (a viewer's only
   *  save); Cancel goes back to the team document. */
  const renderFresh = (notice?: SaveOutcome | null, copyOf?: TeamSessionOrigin): void => {
    ++renderSeq;
    body.replaceChildren();
    body.append(el('span', {
      className: 'share-shortest-note',
      text: copyOf
        ? tRaw('Save a copy of this document to a team project you can save to.')
        : tRaw('Save this document to a team project, where others on this instance can open the document.'),
      style: 'display:block;margin-bottom:.5rem',
    }));
    const uid = `share-team-${++sectionSeq}`;
    const grid = el('div', { style: 'display:flex;flex-direction:column;gap:.35rem' });
    const projLabel = el('label', { text: tRaw('Project'), style: LABEL_STYLE });
    projLabel.htmlFor = `${uid}-project`;
    const project = el('select', { className: 'field-select field-select--sm' });
    project.id = `${uid}-project`;
    project.disabled = true;
    project.append(option(tRaw('Loading…'), ''));
    const nameLabel = el('label', { text: tRaw('Name'), style: LABEL_STYLE });
    nameLabel.htmlFor = `${uid}-name`;
    const name = el('input', { className: 'field-input' });
    name.type = 'text';
    name.id = `${uid}-name`;
    name.autocomplete = 'off';
    name.maxLength = 200;
    const baseName = ctx.document?.().label || copyOf?.label || '';
    name.value = copyOf && baseName ? tRaw('{name} (copy)', { name: baseName }) : baseName;
    const formSlot = el('div');
    grid.append(projLabel, project, formSlot, nameLabel, name);
    body.append(grid);
    const w = warning();
    if (w) body.append(w);
    const actions = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem' });
    const save = button(tRaw('Save to project'), 'team-save-new', true);
    save.disabled = true;
    actions.append(save);
    if (copyOf) {
      const cancel = button(tRaw('Cancel'), 'team-save-copy-cancel');
      cancel.addEventListener('click', () => {
        const live = activeTeamSessionOrigin(toolId);
        if (live) renderOrigin(live);
        else show();
      });
      actions.append(cancel);
    }
    const status = statusLine();
    body.append(actions, status.node);
    if (notice) (notice.error ? status.error : status.ok)(notice.message);

    const NEW = '__new__';
    const { canCreate } = writer.projectOptions();
    let projects: TeamProjectRef[] = [];
    // How many projects the person can see at all, viewer ones included.
    let listed = 0;
    // The empty picker's next step, said and offered where it can be seen: the select's
    // "New project…" only shows once the list is opened.
    const emptyRow = el('div', { style: 'display:flex;align-items:center;flex-wrap:wrap;gap:.35rem .6rem;margin:.2rem 0 0' });
    const emptyNote = el('p', { className: 'share-shortest-note', style: 'display:block;margin:0;flex:1 1 12rem' });
    const startNew = button(tRaw('New project'), 'team-new-project');
    startNew.addEventListener('click', () => { project.value = NEW; sync(); });
    emptyRow.append(emptyNote, startNew);
    // A viewer of the document's project, with nowhere to save and no way to make a
    // project, can ask that project's managers for edit access from the hint.
    const askSlot = el('div');
    const askProjectId = copyOf?.projectId;
    const askEdit = askProjectId ? askEditButton(askProjectId, askSlot) : null;
    if (askEdit) {
      askEdit.hidden = true;
      emptyRow.append(askEdit);
    }
    // Its inline display:flex would outrank [hidden], so the row is shown and hidden by display.
    emptyRow.style.display = 'none';
    grid.insertBefore(emptyRow, formSlot);
    grid.insertBefore(askSlot, formSlot);
    const fill = (selectId?: string): void => {
      project.replaceChildren();
      const empty = projects.length ? null : teamPickerEmpty({ listed, canCreate });
      if (empty) {
        const line = option(empty.placeholder, '');
        line.disabled = true;
        project.append(line);
      }
      emptyRow.style.display = empty ? 'flex' : 'none';
      emptyNote.textContent = empty?.note ?? '';
      startNew.hidden = !empty?.offerNew;
      if (askEdit) {
        // The hint that asks for edit access: projects listed, none to save to, none to make.
        const offer = !!empty && !empty.offerNew && listed > 0 && !!askProjectId && isReadOnlyRole(knownRoles.get(askProjectId));
        askEdit.hidden = !offer;
        if (!offer) askSlot.replaceChildren();
      }
      // Nowhere to save and no way to make somewhere: the line says who can help, and
      // a Name field over a Save button that can never be pressed is left out.
      const dead = !!empty && !empty.offerNew;
      nameLabel.hidden = dead;
      name.hidden = dead;
      save.hidden = dead;
      for (const p of projects) project.append(option(p.name, p.id));
      if (canCreate) project.append(option(tRaw('New project…'), NEW));
      // Nothing to pick: a select with only a disabled line stays disabled.
      project.disabled = !projects.length && !canCreate;
      // Never opens the New project form by itself: the form takes focus, and the
      // docked panel rebuilds this section on every edit. The person picks New project.
      project.value = selectId ?? '';
      sync();
    };
    const sync = (): void => {
      const creating = project.value === NEW;
      save.disabled = creating || !project.value;
      // The form is open: its own Create is the way forward, not a second button.
      if (creating) startNew.hidden = true;
      if (creating && !formSlot.firstChild) {
        formSlot.append(buildNewProjectForm(writer, {
          onCreated: (p) => {
            rememberProject(p);
            projects = [p, ...projects.filter(x => x.id !== p.id)];
            formSlot.replaceChildren();
            fill(p.id);
            save.focus();
          },
          onCancel: () => { formSlot.replaceChildren(); fill(projects[0]?.id); (projects.length ? project : startNew).focus(); },
        }));
      } else if (!creating) {
        formSlot.replaceChildren();
      }
    };
    project.addEventListener('change', sync);
    void teamProjects().then((list) => {
      // Only projects this person can save into: a viewer's projects are left out.
      projects = list.filter((p) => canWriteProject(p.myRole));
      listed = list.length;
      fill(projects[0]?.id);
    });

    save.addEventListener('click', () => { void trackSave(toolId, () => saveNew(save, status, project, name)); });
  };

  const saveNew = async (
    btn: HTMLButtonElement,
    status: ReturnType<typeof statusLine>,
    project: HTMLSelectElement,
    name: HTMLInputElement,
  ): Promise<SaveOutcome | null> => {
    const doc = readDoc();
    const projectId = project.value;
    if (!doc || !projectId || projectId === '__new__') return null;
    const generation = teamOriginGeneration();
    status.clear();
    const label = name.value.trim() || doc.label || '';
    const meta = docMeta(doc, label);
    const result = await busy(btn, tRaw('Saving…'), () => writer.createSession(projectId, {
      toolId, ...(doc.toolVersion ? { toolVersion: doc.toolVersion } : {}), inputs: doc.inputs, ...(meta ? { meta } : {}),
    }));
    if (result.kind !== 'saved') {
      const message = teamSaveFailure(result, liveCollabJoinable(readConfig()));
      status.error(message);
      return { message, error: true };
    }
    const projectName = project.selectedOptions[0]?.textContent || '';
    // Adopted only while the mount the save started under is still the live one.
    const origin = adoptTeamSessionOrigin({ sessionId: result.id, toolId, projectId, rev: result.rev, ...(label ? { label } : {}) }, { generation });
    if (!origin) return null;
    const outcome = { message: projectName ? tRaw('Saved to {project}.', { project: projectName }) : tRaw('Saved.'), error: false };
    renderOrigin(origin, outcome);
    return outcome;
  };

  /** Show the section for the document as it now is, with how the last save ended. */
  function show(outcome?: SaveOutcome | null): void {
    const origin = activeTeamSessionOrigin(toolId!);
    if (origin) renderOrigin(origin, outcome);
    else if (ctx.document && canSave) renderFresh(outcome);
    else {
      body.replaceChildren();
      if (outcome) body.append(el('p', { className: 'share-team-status', text: outcome.message, style: 'margin:0;font-size:12px' }));
    }
  }

  // A save started from an earlier build of this section is still running: show it as
  // running, with nothing to press, until it ends.
  const running = inflight.get(inflightKey(toolId));
  if (running) {
    body.replaceChildren(el('span', { className: 'share-shortest-note', text: tRaw('Saving…'), style: 'display:block' }));
    void running.then((outcome) => show(outcome));
    return section;
  }
  show();
  return section;
}
