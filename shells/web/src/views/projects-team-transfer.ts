// SPDX-License-Identifier: MPL-2.0
/**
 * Move work from a person's own Projects into a shared project (plan 296): drop local
 * tiles on a shared project tile (or a shortcut to one), or choose "Shared project…"
 * in the Move to dialog.
 *
 * The originals are never put at risk. Every item is read and checked before anything
 * is written. Each shared copy, folder and placement must be acknowledged by the
 * instance. The local originals are then compared with the snapshot taken before the
 * writes, and only when nothing changed do local sessions and folders move to the
 * Trash, where they can be restored. Uploads stay in Assets. A failure or a cancel
 * leaves the originals where they were and reports how many shared copies were saved.
 *
 * The Projects view hands in its own folder store and Trash, so this module never
 * opens a second Trash (lib/trash-doors.test.ts).
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import { descendantFolderIds, type Folder, type FolderItem } from '../folders.ts';
import { getSessionSource, readSourceProjects, type TeamProjectRef, type TeamSessionWrite } from '../lib/session-source.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { collectSessionAssetRefs } from '../lib/beam-pack.ts';
import { isBatchSlot } from '../lib/batch-slots.ts';
import { isRecord } from '../lib/util/guards.ts';
import { startJob } from '../lib/jobs.ts';
import { icon } from '../lib/icons.ts';
import { actionButton } from '../components/action-button.ts';
import { mountModal } from '../components/modal.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { canWriteProject } from '../org/team-access.ts';
import { teamSaveInputs } from '../org/team-save.ts';
import { duplicateTeamFile, listTeamFiles, teamFileMessage, uploadTeamFile, type TeamFile } from '../org/team-files.ts';
import { createTeamFolder, listTeamFolders, moveTeamFolderItem, teamFolderHref, teamFolderPath, TeamFolderError } from '../org/team-folders.ts';

export type LocalItemKind = 'session' | 'image' | 'folder';
export interface LocalProjectItem { kind: LocalItemKind; ref: string }
/** A local drag of one or more Projects tiles. Its own type, so neither the desktop
 *  file drop (lib/drop-router.ts) nor a shared project's own drags react to this type. */
export const LOCAL_ITEMS_MIME = 'application/x-lolly-local-items';
const SINGLE_TYPES = ['text/lolly-session', 'text/lolly-image', 'text/lolly-folder'];

/** What the Projects view lends a move: the host, its folder store and Trash. */
export interface TeamTransferDeps {
  host: HostV1;
  store: {
    list(): Promise<Folder[]>;
    moveItem(ref: string, toFolderId: string | null, type?: FolderItem['type']): Promise<void>;
  };
  trash: {
    trashSessions(slots: readonly string[], labelOf?: (slot: string) => string | undefined): Promise<unknown>;
    trashFolder(id: string): Promise<unknown>;
  };
  /** False once the Projects view is gone; the move itself carries on. */
  mounted(): boolean;
  /** The view's selection (ref to kind), read when a drag starts. */
  selection?(): ReadonlyMap<string, string>;
  /** Draw the view again after a move. */
  refresh?(): Promise<void>;
}
type TransferHost = HostV1 & { state: WebStateAPI; assets: { _getBlob?(id: string): Promise<Blob | null> } };

const isLocalKind = (kind: unknown): kind is LocalItemKind => kind === 'session' || kind === 'image' || kind === 'folder';
const instance = (): string => getInstanceBase() || location.origin;

/** Whether a drag carries local Projects tiles (and so is not a desktop file drop). */
export function isLocalItemsDrag(types: readonly string[] | undefined): boolean {
  return !!types && types.some(type => type === LOCAL_ITEMS_MIME || SINGLE_TYPES.includes(type));
}

/** The local items a drop carries: the whole dragged selection, or the one tile. */
export function localDragItems(event: DragEvent): LocalProjectItem[] {
  const data = event.dataTransfer;
  if (!data) return [];
  try {
    const items: unknown = JSON.parse(data.getData(LOCAL_ITEMS_MIME) || 'null');
    if (Array.isArray(items) && items.length <= 1000 && items.every(item => isRecord(item) && isLocalKind(item.kind) && typeof item.ref === 'string')) return items as LocalProjectItem[];
  } catch { /* A ribbon preview carries one item under its single type. */ }
  for (const kind of ['session', 'image', 'folder'] as const) {
    const ref = data.getData(`text/lolly-${kind}`);
    if (ref) return [{ kind, ref }];
  }
  return [];
}

/** The shared project and folder a writable shared tile opens. */
function tileDestination(tile: HTMLElement): { project: string; folder: string | null } | null {
  const project = tile.dataset.ref;
  if (!project) return null;
  const href = tile.querySelector<HTMLAnchorElement>('a.tile-primary')?.getAttribute('href') ?? '';
  return { project, folder: new URLSearchParams(href.split('?')[1] ?? '').get('folder') || null };
}

/**
 * Wire one render of the Projects root: a local drag records every dragged item,
 * and each shared project tile the person may write to takes a drop of local tiles.
 * A desktop file drag passes straight through to the view's file drop.
 */
export function wireLocalTeamDrops(root: HTMLElement, deps: TeamTransferDeps): void {
  const writer = getSessionSource()?.write;
  if (!writer || writer.projectOptions().canSave === false) return;
  root.addEventListener('dragstart', event => {
    const tile = (event.target as Element | null)?.closest?.<HTMLElement>('.folder-tile[data-ref][draggable="true"]');
    const kind = tile?.dataset.kind, ref = tile?.dataset.ref;
    if (!tile || !ref || !isLocalKind(kind) || !event.dataTransfer) return;
    const selection = deps.selection?.();
    const items = selection?.has(ref)
      ? [...selection].flatMap(([key, value]) => isLocalKind(value) ? [{ kind: value, ref: key }] : [])
      : [{ kind, ref }];
    event.dataTransfer.setData(LOCAL_ITEMS_MIME, JSON.stringify(items));
  });
  for (const tile of root.querySelectorAll<HTMLElement>('.folder-tile[data-kind="team-project"][data-team-writable="true"]')) {
    tile.addEventListener('dragover', event => {
      if (!isLocalItemsDrag(event.dataTransfer?.types)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      tile.classList.add('is-drop');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('is-drop'));
    tile.addEventListener('drop', event => {
      tile.classList.remove('is-drop');
      if (!isLocalItemsDrag(event.dataTransfer?.types)) return;
      event.preventDefault(); event.stopPropagation();
      const items = localDragItems(event), target = tileDestination(tile);
      if (items.length && target) void moveLocalItemsToTeam(deps, items, target.project, target.folder);
    });
  }
}

/** The "Shared project…" button for the Move to dialog's footer, or nothing when this
 *  person cannot save to a shared project. */
export function teamMoveButtonHtml(items: readonly LocalProjectItem[]): string {
  const writer = getSessionSource()?.write;
  if (!writer || writer.projectOptions().canSave === false || !items.length) return '';
  return `<button type="button" class="btn" data-move-team>${icon('folderUsers')}<span>${t('Shared project…')}</span></button>`;
}

/** The Move to dialog's click on "Shared project…": close it, ask where, then move.
 *  True when the click was this button's. */
export function onTeamMoveClick(event: Event, items: readonly LocalProjectItem[], deps: TeamTransferDeps, close: () => void): boolean {
  if (!(event.target as Element | null)?.closest?.('[data-move-team]')) return false;
  close();
  void chooseTeamDestination().then(target => { if (target) void moveLocalItemsToTeam(deps, items, target.project, target.folder); });
  return true;
}

/** Ask which shared project, and which folder in it, takes the items. */
export async function chooseTeamDestination(): Promise<{ project: string; folder: string | null } | undefined> {
  const source = getSessionSource();
  if (!source?.write || source.write.projectOptions().canSave === false) return;
  const got = await readSourceProjects(source);
  if (source !== getSessionSource()) return;
  if (!got.ok) { announce(tRaw('Shared projects could not be loaded. Try again.')); return; }
  const projects = got.items.filter(project => canWriteProject(project.myRole));
  if (!projects.length) { announce(tRaw('There is no shared project you can save to.')); return; }
  return new Promise(resolve => {
    let request = 0, ready = false;
    const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
      const el = document.createElement(tag); el.className = cls; el.textContent = text; return el;
    };
    const modal = mountModal<{ project: string; folder: string | null }>('', {
      className: 'modal team-move-dialog', ariaLabel: tRaw('Move to a shared project'),
      onClose: value => { ++request; resolve(value ?? undefined); },
    });
    const title = node('h2', 'modal-title', tRaw('Move to a shared project'));
    const projectLabel = node('label', 'document-agent-field', tRaw('Shared project')), projectSelect = node('select', 'field-select');
    for (const project of projects) { const option = node('option', '', project.name); option.value = project.id; projectSelect.append(option); }
    projectLabel.append(projectSelect);
    const folderLabel = node('label', 'document-agent-field', tRaw('Folder')), folderSelect = node('select', 'field-select');
    folderLabel.append(folderSelect);
    const status = node('p', 'team-project-notice'); status.setAttribute('role', 'status');
    const controls = node('div', 'modal-actions'), cancel = actionButton(tRaw('Cancel'), 'close'), move = actionButton(tRaw('Move'), 'move', true);
    move.disabled = true;
    controls.append(cancel, move); modal.el.append(title, projectLabel, folderLabel, status, controls);
    const load = async (): Promise<void> => {
      const ticket = ++request, project = projects.find(entry => entry.id === projectSelect.value)!;
      ready = false; move.disabled = true; folderSelect.replaceChildren(); status.textContent = tRaw('Loading…');
      let folders: Awaited<ReturnType<typeof listTeamFolders>> = [];
      try { folders = await listTeamFolders(projectSelect.value); }
      catch (error) {
        // An instance without shared folders still takes items at the project root.
        if (!(error instanceof TeamFolderError && error.status === 404)) {
          if (modal.el.isConnected && ticket === request) status.textContent = tRaw('Folders could not be loaded. Choose another project or try again.');
          return;
        }
      }
      if (!modal.el.isConnected || ticket !== request || source !== getSessionSource()) return;
      const root = node('option', '', project.name); root.value = ''; folderSelect.append(root);
      for (const folder of folders) {
        const option = node('option', '', teamFolderPath(folders, folder.id).map(part => part.name).join(' / '));
        option.value = folder.id; folderSelect.append(option);
      }
      ready = true; move.disabled = false; status.textContent = '';
    };
    projectSelect.addEventListener('change', () => { void load(); });
    cancel.addEventListener('click', () => modal.close());
    move.addEventListener('click', () => { if (ready) modal.close({ project: projectSelect.value, folder: folderSelect.value || null }); });
    projectSelect.focus();
    void load();
  });
}

/** Only one move at a time: a second drop of the same tiles must not copy them twice. */
let running = false;

/** What happened, in words, after a move stopped part way. */
function outcome(phase: 'check' | 'write' | 'archive', saved: number): string {
  if (phase === 'archive') return tRaw('Every item is saved in the shared project. Local originals are in Trash or still in place.');
  const kept = tRaw('Your local items have not changed.');
  if (!saved) return kept;
  return `${saved === 1 ? tRaw('1 item was saved to the shared project.') : tRaw('{n} items were saved to the shared project.', { n: saved })} ${kept}`;
}

/**
 * Move local items into a shared project folder (`destination` null: its root).
 * Resolves true when every item was saved and every local original is in the Trash.
 */
export async function moveLocalItemsToTeam(deps: TeamTransferDeps, items: readonly LocalProjectItem[], project: string, destination: string | null): Promise<boolean> {
  const source = getSessionSource(), writer = source?.write, h = deps.host as TransferHost;
  if (!source || !writer || writer.projectOptions().canSave === false || !items.length) return false;
  if (running) { announce(tRaw('Wait for the current move to finish.')); return false; }
  const origin = instance();
  const projects = await readSourceProjects(source);
  if (!projects.ok) { announce(tRaw('Shared projects could not be loaded. Try again.')); return false; }
  const target: TeamProjectRef | undefined = projects.items.find(item => item.id === project && canWriteProject(item.myRole));
  if (!target) { announce(tRaw('You cannot save to that shared project.')); return false; }
  const accepted = await confirmDialog({
    title: tRaw('Move to a shared project'),
    message: tRaw('Everyone who can open {project} will see these items. After every item is saved there, the local originals move to Trash, where you can restore them.', { project: target.name }),
    confirmLabel: tRaw('Move'), danger: false,
  });
  if (!accepted || running || source !== getSessionSource() || origin !== instance()) return false;
  running = true;
  let cancelled = false, phase: 'check' | 'write' | 'archive' = 'check', saved = 0;
  const job = startJob({ title: tRaw('Move to a shared project'), heavy: false, cancel: () => { cancelled = true; } });
  const check = (): void => {
    if (cancelled || source !== getSessionSource() || origin !== instance()) throw new Error(tRaw('Move cancelled.'));
  };
  try {
    // 1. Read and check everything before a single write.
    const folders = await deps.store.list(), rows = await h.state.list();
    const bySlot = new Map(rows.map(row => [row.slot, row]));
    const wanted = [...new Map(items.filter(item => isLocalKind(item.kind)).map(item => [item.ref, item])).values()];
    for (const item of wanted) if (item.kind === 'folder' && !folders.some(folder => folder.id === item.ref)) throw new Error(tRaw('A folder is no longer on this device.'));
    // Every moving folder and every folder inside one, as this folder list has them.
    const subtree = (list: readonly Folder[]): Set<string> => new Set(wanted.filter(item => item.kind === 'folder').flatMap(item => [item.ref, ...descendantFolderIds(list, item.ref)]));
    const covered = subtree(folders);
    // A selected item inside a selected folder travels with that folder.
    const roots = wanted.filter(item => item.kind === 'folder'
      ? !folders.some(folder => covered.has(folder.id) && folder.id !== item.ref && descendantFolderIds(folders, folder.id).includes(item.ref))
      : !folders.some(folder => covered.has(folder.id) && folder.items.some(member => member.ref === item.ref)));
    const inside = folders.filter(folder => covered.has(folder.id));
    if (inside.some(folder => folder.link)) throw new Error(tRaw('A folder holds a shortcut to a shared project. Move the shortcut out first.'));
    if (inside.some(folder => folder.teamCopy)) throw new Error(tRaw('A folder was already shared from this device, so it cannot move again.'));
    const materials: LocalProjectItem[] = [
      ...roots.filter(item => item.kind !== 'folder'),
      ...inside.flatMap(folder => folder.items.map(member => ({ kind: member.type === 'session' ? 'session' as const : 'image' as const, ref: member.ref }))),
    ];
    const prepared = new Map<string, { name: string; session?: TeamSessionWrite; file?: Blob }>();
    const snapshots = new Map<string, string>(), folderSnapshot = JSON.stringify(inside);
    const options = writer.projectOptions();
    for (const item of materials) {
      check();
      if (item.kind === 'session') {
        const data = await h.state.load(item.ref), row = bySlot.get(item.ref);
        if (!row?.toolId || !isRecord(data) || isBatchSlot(item.ref)) throw new Error(tRaw('A saved batch or a missing session cannot move to a shared project.'));
        const inputs = teamSaveInputs(data), uploads = collectSessionAssetRefs(inputs.inputs).user.length;
        if (inputs.deviceLocal > uploads || (uploads && !options.canShareFiles)) throw new Error(tRaw('A session uses a file that stays on this device, so it cannot move to a shared project.'));
        snapshots.set(item.ref, JSON.stringify(data));
        const name = row.label || row.toolId;
        const emoji = await h.state.emojiStamp?.(item.ref), rightsDecisions = await h.state.rightsDecisions?.(item.ref);
        prepared.set(item.ref, { name, session: { toolId: row.toolId, inputs: inputs.inputs,
          ...(typeof data.__toolVersion === 'string' ? { toolVersion: data.__toolVersion } : {}),
          meta: { label: name, ...(emoji ? { emoji } : {}), ...(rightsDecisions ? { rightsDecisions } : {}) } } });
      } else {
        const id = item.ref.split(/[?#]/)[0]!;
        // A catalog picture is a reference to the brand's library, not a file this
        // person may hand to a project; only their own uploads travel.
        if (!id.startsWith('user/')) throw new Error(tRaw('A catalog image cannot move to a shared project. Remove it from the folder and try again.'));
        const blob = options.canShareFiles ? await h.assets._getBlob?.(id) : null;
        if (!blob) throw new Error(tRaw('A file cannot be shared with this workspace.'));
        const asset = await h.assets.get(id).catch(() => null);
        prepared.set(item.ref, { name: typeof asset?.meta?.name === 'string' ? asset.meta.name : id.split('/').at(-1) || tRaw('File'), file: blob });
      }
    }
    // 2. Write the shared copies, each one acknowledged, keeping the nesting.
    phase = 'write';
    job.progress(0, materials.length, tRaw('Saving shared copies…'));
    // An upload whose bytes the project already holds resolves to that file. Placing
    // it would take a teammate's file out of its folder, so it gets its own copy.
    const taken = new Set<string>();
    if ([...prepared.values()].some(entry => entry.file)) {
      try { for (const file of (await listTeamFiles(project)).files) taken.add(file.id); }
      catch (error) { throw new Error(teamFileMessage(error, 'list')); }
    }
    const share = async (blob: Blob, name: string): Promise<TeamFile> => {
      try {
        let stored = await uploadTeamFile(project, blob, name);
        if (taken.has(stored.id)) stored = await duplicateTeamFile(project, stored, name);
        taken.add(stored.id);
        return stored;
      } catch (error) { throw new Error(teamFileMessage(error, 'upload')); }
    };
    const place = async (kind: 'session' | 'file', id: string, parent: string | null): Promise<void> => {
      if (!parent) return;
      try { await moveTeamFolderItem(project, parent, kind, id); }
      catch { throw new Error(tRaw('An item was saved at the top of the shared project but could not be moved into its folder.')); }
    };
    const copy = async (item: LocalProjectItem, parent: string | null): Promise<void> => {
      check();
      if (item.kind === 'folder') {
        const folder = folders.find(entry => entry.id === item.ref)!;
        let made: string;
        try { made = (await createTeamFolder(project, folder.name.slice(0, 200), parent)).id; }
        catch { throw new Error(tRaw('A shared folder could not be created.')); }
        for (const child of folders.filter(entry => entry.parentId === folder.id)) await copy({ kind: 'folder', ref: child.id }, made);
        for (const member of folder.items) await copy({ kind: member.type === 'session' ? 'session' : 'image', ref: member.ref }, made);
        return;
      }
      const data = prepared.get(item.ref)!;
      if (data.session) {
        const result = await writer.createSession(project, data.session);
        if (result.kind !== 'saved') throw new Error(result.kind === 'file-error' ? result.message : tRaw('A session could not be saved to the shared project.'));
        ++saved; await place('session', result.id, parent);
      } else {
        const stored = await share(data.file!, data.name);
        ++saved; await place('file', stored.id, parent);
      }
      job.progress(saved, materials.length, data.name);
    };
    for (const item of roots) await copy(item, destination);
    check();
    // 3. The originals must be as they were when the copies were made. The subtree is
    // worked out again, so a folder made inside a moving folder meanwhile, which has
    // no shared copy, stops the move.
    const now = await deps.store.list(), coveredNow = subtree(now);
    if (coveredNow.size !== covered.size || [...coveredNow].some(id => !covered.has(id))
      || JSON.stringify(now.filter(folder => covered.has(folder.id))) !== folderSnapshot) throw new Error(tRaw('Local folders changed during the move.'));
    for (const [slot, before] of snapshots) if (JSON.stringify(await h.state.load(slot)) !== before) throw new Error(tRaw('A local session changed during the move.'));
    // 4. Only now do the originals leave: sessions and folders to the Trash.
    phase = 'archive';
    job.progress(saved, materials.length, tRaw('Moving local originals to Trash…'));
    for (const item of roots) {
      check();
      if (item.kind === 'folder') await deps.trash.trashFolder(item.ref);
      else if (item.kind === 'session') await deps.trash.trashSessions([item.ref], () => prepared.get(item.ref)?.name);
      else await deps.store.moveItem(item.ref, null, 'image');
    }
    job.finish();
    announce(tRaw('Moved to {project}. Local sessions and folders are in Trash, and uploads stay in Assets.', { project: target.name }));
    if (deps.mounted()) window.location.hash = teamFolderHref(project, destination);
    return true;
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : tRaw('Could not move these items. Refresh and try again.');
    const message = `${reason} ${outcome(phase, saved)}`;
    job.fail(message); announce(message, { assertive: true });
    if (deps.mounted()) await deps.refresh?.().catch(() => {});
    return false;
  } finally { running = false; job.settle(); }
}
