// SPDX-License-Identifier: MPL-2.0
/**
 * Saved versions in shared History: the larger preview of one version with its
 * actions, a restore with a 30-second Undo restore, a manager's delete and the Save
 * version form. These controls only hide what the capability says this person cannot
 * do. The host still decides, and each refusal arrives as the host's own status copy.
 */
import type { CollabHistoryCapability, CollabHistoryEntry, CollabHistoryRestoreResult } from '../lib/collab-history.ts';
import { confirmDialog } from './confirm-dialog.ts';
import { mountModal } from './modal.ts';
import { showUndoToast } from '../lib/undo-toast.ts';
import { currentLang, t, tRaw } from '../i18n.ts';

/** How long Undo restore stays offered. */
export const UNDO_RESTORE_MS = 30_000;
const LABEL_MAX = 120;
const IMAGE = /^data:image\/(?:png|jpeg|webp|svg\+xml)[;,]/;

/** What a version action reports back to the panel. */
export interface VersionActions {
  /** Show a status line (a refusal, already in the person's language). */
  status(message: string): void;
  /** History changed: refresh it, then show `message` when there is one. */
  changed(message?: string): void;
}

export function versionTime(at: string): string {
  return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** The reason line for one entry. A durable host's own checkpoints are its automatic versions. */
export function versionReason(reason: string, durable: boolean): string {
  if (reason === 'save' || reason === 'named') return t('Saved version');
  if (reason === 'recovery') return t('Recovered work');
  if (reason === 'restore') return t('Restored version');
  return durable ? t('Automatic version') : t('Automatic checkpoint');
}

/** The dialog title: a named version's name, otherwise when it was made. */
export function versionTitle(entry: CollabHistoryEntry): string {
  return entry.reason === 'named' ? entry.label : tRaw('Version from {time}', { time: versionTime(entry.at) });
}

/** "Edited by Ana and Ben", or "Edited by Ana, Ben and 3 more"; null when nobody is recorded. */
export function contributorsText(entry: CollabHistoryEntry): string | null {
  const names = (entry.contributors ?? []).map(person => person.label?.trim()
    || (person.id === 'guest' || person.id.startsWith('guest:') ? t('Guest') : t('Unknown editor')));
  if (!names.length) return null;
  if (names.length <= 3) return tRaw('Edited by {names}', { names: listOf(names, 'conjunction') });
  return tRaw('Edited by {names} and {count} more', { names: listOf(names.slice(0, 2), 'unit'), count: names.length - 2 });
}

function listOf(names: string[], type: 'conjunction' | 'unit'): string {
  try { return new Intl.ListFormat(currentLang(), { style: type === 'unit' ? 'short' : 'long', type }).format(names); }
  catch { return names.join(', '); }
}

function failure(error: unknown): string {
  return error instanceof Error && error.message ? error.message : tRaw('Could not complete this action. Please try again.');
}

/** The inline Save version form. Hidden until the capability says this person may write. */
export function mountVersionSave(collab: CollabHistoryCapability, actions: VersionActions): { el: HTMLFormElement; update(): void } {
  const form = document.createElement('form'); form.className = 'revision-history-save'; form.hidden = true;
  const name = document.createElement('input'); name.type = 'text'; name.className = 'field-input'; name.maxLength = LABEL_MAX; name.autocomplete = 'off';
  name.placeholder = tRaw('Version name (optional)'); name.setAttribute('aria-label', tRaw('Version name (optional)'));
  const save = document.createElement('button'); save.type = 'submit'; save.className = 'btn'; save.textContent = t('Save version');
  form.append(name, save);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (save.disabled || !collab.saveVersion) return;
    save.disabled = true;
    // The host needs a name; an unnamed version is named after when it was saved.
    const label = name.value.trim() || tRaw('Version from {time}', { time: versionTime(new Date().toISOString()) });
    void collab.saveVersion(label).then(() => { name.value = ''; actions.changed(tRaw('Version saved.')); },
      error => { actions.status(failure(error)); }).finally(() => { save.disabled = false; });
  });
  return { el: form, update() { form.hidden = !(collab.saveVersion && collab.canRestore); } };
}

/**
 * Restore one version for everyone, after a confirmation. On success the person gets
 * Undo restore for 30 seconds, which restores the state this restore replaced.
 * Resolves true when the restore was applied.
 */
export async function restoreVersion(collab: CollabHistoryCapability, versionId: string, actions: VersionActions): Promise<boolean> {
  if (!collab.restore || !collab.canRestore) return false;
  const confirmed = await confirmDialog({
    title: tRaw('Restore this version?'),
    message: tRaw('Everyone in this document will see the restored version. The current version stays in History, so you can go back.'),
    confirmLabel: tRaw('Restore'), danger: false,
  });
  if (!confirmed) return false;
  let result: Awaited<ReturnType<NonNullable<CollabHistoryCapability['restore']>>>;
  try { result = await collab.restore(versionId); } catch (error) { actions.status(failure(error)); return false; }
  const outcome: CollabHistoryRestoreResult = typeof result === 'object' && result !== null ? result : {};
  const message = outcome.vetoed?.length ? tRaw('Restored. Locked settings stay as they are.')
    : outcome.skipped?.length ? tRaw('Restored. Some document settings stay as they are while others are editing.')
      : tRaw('Version restored.');
  const undoId = outcome.undoId;
  if (!undoId) { actions.changed(message); return true; }
  // The toast carries the outcome, so the panel only refreshes (one announcement, not two).
  actions.changed();
  showUndoToast({
    message, actionLabel: tRaw('Undo restore'), duration: UNDO_RESTORE_MS,
    undo: async () => {
      try { await collab.restore!(undoId); actions.changed(tRaw('Restore undone.')); }
      catch (error) { actions.status(failure(error)); }
    },
  });
  return true;
}

/** Delete one version for everyone, after a confirmation (managers only). */
export async function deleteVersion(collab: CollabHistoryCapability, versionId: string, actions: VersionActions): Promise<boolean> {
  if (!collab.remove) return false;
  const confirmed = await confirmDialog({
    title: tRaw('Delete this version?'),
    message: tRaw('This removes the version from History for everyone.'),
    confirmLabel: tRaw('Delete version'),
  });
  if (!confirmed || !collab.remove) return false;
  try { await collab.remove(versionId); } catch (error) { actions.status(failure(error)); return false; }
  actions.changed(tRaw('Version deleted.'));
  return true;
}

/**
 * The preview dialog for one version: a larger render, when and by whom, and the
 * actions this person may take. Names and labels are text, never markup.
 */
export function openVersionPreview(opts: {
  collab: CollabHistoryCapability;
  entry: CollabHistoryEntry;
  actions: VersionActions;
  /** Open the version as a new local copy (the panel's own copy path). */
  openCopy(): Promise<void>;
}): () => void {
  const { collab, entry, actions } = opts;
  const title = versionTitle(entry);
  let closed = false;
  const modal = mountModal<void>('', {
    className: 'modal history-version-preview', ariaLabel: title,
    initialFocus: el => el.querySelector<HTMLElement>('[data-version-close]'),
    onClose: () => { closed = true; },
  });
  const heading = document.createElement('h2'); heading.className = 'modal-title'; heading.textContent = title;
  const figure = document.createElement('figure'); figure.className = 'history-version-figure';
  const image = document.createElement('img'); image.alt = ''; image.hidden = true;
  const note = document.createElement('p'); note.className = 'modal-msg'; note.hidden = true;
  note.textContent = t('Preview unavailable for this version.');
  figure.append(image, note);
  const facts = document.createElement('p'); facts.className = 'history-version-facts';
  const when = document.createElement('time'); when.dateTime = entry.at; when.textContent = versionTime(entry.at);
  const reason = document.createElement('span'); reason.textContent = versionReason(entry.reason, collab.durability === 'durable');
  const who = document.createElement('span'); who.className = 'revision-history-editor';
  who.textContent = contributorsText(entry) ?? (entry.actor.label?.trim() ? tRaw('Edited by {name}', { name: entry.actor.label.trim() }) : '');
  who.hidden = !who.textContent;
  facts.append(when, reason, who);
  const bar = document.createElement('div'); bar.className = 'modal-actions history-version-actions';
  const button = (label: string, run: (self: HTMLButtonElement) => Promise<void> | void): HTMLButtonElement => {
    const node = document.createElement('button'); node.type = 'button'; node.className = 'btn'; node.textContent = label;
    node.addEventListener('click', () => {
      if (node.disabled) return;
      node.disabled = true;
      void Promise.resolve(run(node)).finally(() => { if (node.isConnected) node.disabled = false; });
    });
    return node;
  };
  if (collab.remove) bar.append(button(t('Delete version'), async () => {
    if (await deleteVersion(collab, entry.id, actions)) modal.close();
  }));
  if (collab.canSaveCopy) bar.append(button(t('Open as a copy'), async () => { modal.close(); await opts.openCopy(); }));
  if (collab.restore && collab.canRestore) bar.append(button(t('Restore this version'), async () => {
    if (await restoreVersion(collab, entry.id, actions)) modal.close();
  }));
  const close = button(t('Close preview'), () => { modal.close(); }); close.dataset.versionClose = '';
  bar.append(close);
  modal.el.append(heading, figure, facts, bar);
  close.focus();
  const unavailable = (): void => { if (!closed) { image.hidden = true; note.hidden = false; } };
  if (!collab.preview) unavailable();
  else void collab.preview(entry.id).then(src => {
    if (closed) return;
    if (src && IMAGE.test(src)) { image.src = src; image.hidden = false; } else unavailable();
  }, unavailable);
  return () => modal.close();
}
