// SPDX-License-Identifier: MPL-2.0
/**
 * The Trash browser (plans/133 WP-4, shared by plan 277 P3): one dialog over the
 * one Trash model (lib/trash.ts), opened from Projects, Assets and Settings →
 * Storage alike, so a deleted session, folder or upload is found in the same
 * place whichever door it left by.
 *
 * Restore and Delete forever act in place: the row goes, the list stays open and
 * focus moves to the next row, so several items can be handled in one visit.
 * Empty Trash asks first through the shared confirm dialog. An empty Trash says
 * so. Escape closes and returns focus, as every overlay does (components/modal.ts).
 *
 * Also exports the Undo toast every web delete door shows after a move to the
 * Trash, so the wording is one set of strings.
 */
// Aliased on import: a bare `escape` shadows the deprecated global of that name.
import { escape as escapeHtml } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { announce } from '../a11y.ts';
import { mountModal } from './modal.ts';
import { confirmDialog } from './confirm-dialog.ts';
import { showUndoToast } from '../lib/undo-toast.ts';
import type { TrashEntry } from '../folders.ts';
import { TrashPurgeError, createTrash, sameTrashEntry, trashEntryName, trashHostOf, type Trash, type TrashRestoreResult } from '../lib/trash.ts';

export interface OpenTrashDialogOpts {
  trash: Trash;
  /** Runs after every restore or deletion, so the view underneath can redraw. */
  onChange?(): void | Promise<void>;
  /** Where focus goes when the dialog closes. A view that redraws in onChange
   *  replaces the control that opened the Trash, so the browser's own focus
   *  return has nothing to land on; this returns the redrawn control. */
  returnFocus?(): HTMLElement | null | undefined;
}

function rowIcon(e: TrashEntry): string {
  if (e.kind === 'folder') return icon('folder');
  if (e.kind === 'session') return icon('document');
  if (e.kind === 'font') return icon('font');
  if (e.assetType === 'audio') return icon('music');
  if (e.assetType === 'video') return icon('filmStrip');
  return icon('image');
}

function kindLabel(e: TrashEntry): string {
  return e.kind === 'folder' ? t('Folder') : e.kind === 'session' ? t('Saved session') : e.kind === 'font' ? t('Font') : t('Uploaded file');
}

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Open the Trash. Resolves once the dialog has opened (reads the entries first). */
export async function openTrashDialog({ trash, onChange, returnFocus }: OpenTrashDialogOpts): Promise<void> {
  // Age out anything past 30 days before listing, so the dialog never shows an
  // item it is about to remove; the view underneath redraws when the sweep removed any.
  if (await trash.sweep().catch(() => 0)) await onChange?.();
  let entries = await trash.list().catch((): TrashEntry[] => []);
  let busy = false;

  /** The list, or the empty state, for the entries as they stand. */
  function listHtml(): string {
    if (!entries.length) return `<p class="trash-empty">${t('The Trash is empty.')}</p>`;
    return `<ul class="trash-list">${entries.map((e, i) => {
      const name = trashEntryName(e);
      return `<li class="trash-row" data-trash-row="${i}">
        <span class="trash-row-icon" aria-hidden="true">${rowIcon(e)}</span>
        <span class="trash-row-meta"><span class="trash-row-name">${escapeHtml(name)}</span><span class="trash-row-sub">${escapeHtml(kindLabel(e))} · ${escapeHtml(shortDate(e.deletedAt))}</span></span>
        <span class="trash-row-acts">
          <button type="button" class="btn btn--sm" data-trash-restore="${i}" aria-label="${escapeHtml(tRaw('Restore {name}', { name }))}">${t('Restore')}</button>
          <button type="button" class="btn btn--sm trash-purge" data-trash-purge="${i}" aria-label="${escapeHtml(tRaw('Delete {name} forever', { name }))}">${t('Delete forever')}</button>
        </span>
      </li>`;
    }).join('')}</ul>`;
  }

  const modal = mountModal<void>(`
    <div class="trash-dialog-body">
      <h2 id="trash-dialog-title">${t('Trash')}</h2>
      <p class="trash-note">${t('Items here are removed for good after 30 days.')}</p>
      <div class="trash-content" data-trash-content>${listHtml()}</div>
      <p class="trash-status" data-trash-status role="status" aria-live="polite" hidden></p>
      <div class="trash-actions">
        <button type="button" class="btn cat-act-danger" data-trash-empty${entries.length ? '' : ' hidden'}>${t('Empty Trash')}</button>
        <button type="button" class="btn" data-trash-close>${t('Close')}</button>
      </div>
    </div>`, {
    className: 'trash-dialog',
    // The first row's Restore, the safe action; Close when the Trash is empty.
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-trash-restore]') ?? el.querySelector<HTMLElement>('[data-trash-close]'),
    onClose: () => { stopFollowing(); const target = returnFocus?.(); if (target?.isConnected) target.focus(); },
  });
  modal.el.setAttribute('aria-labelledby', 'trash-dialog-title');
  const content = modal.el.querySelector<HTMLElement>('[data-trash-content]')!;
  const status = modal.el.querySelector<HTMLElement>('[data-trash-status]')!;
  const emptyBtn = modal.el.querySelector<HTMLButtonElement>('[data-trash-empty]')!;

  const say = (message: string): void => {
    status.textContent = message;
    status.hidden = !message;
  };

  function paint(): void {
    emptyBtn.hidden = entries.length === 0;
    content.innerHTML = listHtml();
  }

  /** Re-read, repaint, and put focus on the row that took the acted-on row's place. */
  async function refresh(index: number, kind: 'restore' | 'purge'): Promise<void> {
    entries = await trash.list().catch(() => entries);
    paint();
    const next = Math.min(index, entries.length - 1);
    const target = next >= 0
      ? content.querySelector<HTMLElement>(`[data-trash-${kind}="${next}"]`)
      : modal.el.querySelector<HTMLElement>('[data-trash-close]');
    target?.focus();
    await onChange?.();
  }

  // Follow the Trash while open (review B3): an Undo toast in this tab, or a
  // restore or delete in another tab, repaints the rows, so a row never stands
  // for an item that has left the Trash. The purge and restore check again
  // anyway; this keeps what the person sees true.
  const repaintFromStore = async (): Promise<void> => {
    if (busy || !modal.el.isConnected) return;
    const hadFocus = modal.el.contains(document.activeElement) && content.contains(document.activeElement);
    entries = await trash.list().catch(() => entries);
    paint();
    if (hadFocus) (content.querySelector<HTMLElement>('[data-trash-restore]') ?? modal.el.querySelector<HTMLElement>('[data-trash-close]'))?.focus();
  };
  const onTrashChanged = (): void => { void repaintFromStore(); };
  window.addEventListener('lolly:trash-changed', onTrashChanged);
  let channel: BroadcastChannel | null = null;
  try { channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lolly-trash') : null; } catch { channel = null; }
  if (channel) channel.onmessage = onTrashChanged;
  function stopFollowing(): void {
    window.removeEventListener('lolly:trash-changed', onTrashChanged);
    try { channel?.close(); } catch { /* already closed */ }
    channel = null;
  }

  modal.el.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-trash-close]')) { modal.close(); return; }
    if (busy) return;
    const restoreBtn = el.closest<HTMLElement>('[data-trash-restore]');
    const purgeBtn = el.closest<HTMLElement>('[data-trash-purge]');
    if (restoreBtn || purgeBtn) {
      const index = Number((restoreBtn ?? purgeBtn)!.dataset[restoreBtn ? 'trashRestore' : 'trashPurge']);
      const shown = entries[index];
      if (!shown) return;
      busy = true;
      say('');
      const name = trashEntryName(shown);
      try {
        // Re-read before acting: the row may be older than the Trash.
        entries = await trash.list().catch(() => entries);
        const entry = entries.find(x => sameTrashEntry(x, shown));
        if (!entry) {
          say(tRaw('"{name}" is no longer in the Trash.', { name }));
        } else if (restoreBtn) {
          const result: TrashRestoreResult = await trash.restore(entry);
          if (result.status === 'gone') say(tRaw('"{name}" is no longer in the Trash.', { name }));
          else if (result.status === 'partial') {
            say(result.missing === 1
              ? tRaw('Restored "{name}". 1 item in it could not be brought back.', { name })
              : tRaw('Restored "{name}". {n} items in it could not be brought back.', { name, n: result.missing }));
          } else announce(tRaw('Restored "{name}".', { name }));
        } else {
          const outcome = await trash.purge(entry);
          if (outcome === 'gone') say(tRaw('"{name}" is no longer in the Trash.', { name }));
          else announce(tRaw('Deleted "{name}" for good.', { name }));
        }
      } catch (error) {
        say(error instanceof TrashPurgeError
          ? tRaw('"{name}" is used by a saved creation or its history, so it stays in the Trash.', { name })
          : t('That did not work. Try again.'));
      } finally { busy = false; }
      await refresh(index, restoreBtn ? 'restore' : 'purge');
      return;
    }
    if (el.closest('[data-trash-empty]')) {
      const n = entries.length;
      if (!n) return;
      const ok = await confirmDialog({
        title: t('Empty the Trash?'),
        message: n === 1
          ? t('This permanently deletes 1 item. This cannot be undone.')
          : tRaw('This permanently deletes {n} items. This cannot be undone.', { n }),
        confirmLabel: t('Empty Trash'),
      });
      if (!ok) { emptyBtn.focus(); return; }
      busy = true;
      say('');
      // empty() re-reads the Trash and checks every item again before it goes.
      const { kept } = await trash.empty().catch(() => ({ purged: 0, kept: n }));
      busy = false;
      if (kept) say(kept === 1
        ? t('1 item stays in the Trash because a saved creation or its history still uses that file.')
        : tRaw('{n} items stay because a saved creation or its history uses them.', { n: kept }));
      else announce(t('Trash emptied'));
      await refresh(0, 'restore');
    }
  });
}

/**
 * The toast every web delete door shows after a move to the Trash: what went,
 * and an Undo that puts everything back. `after` runs once the restore finished,
 * with how many items came back (none when they had already left the Trash from
 * another tab), so the view can redraw.
 */
export function showTrashUndoToast(trash: Trash, entries: readonly TrashEntry[], after?: (restored: number) => void | Promise<void>): void {
  if (!entries.length) return;
  const first = entries[0]!;
  const allKind = (k: TrashEntry['kind']): boolean => entries.every(e => e.kind === k);
  const message = entries.length === 1
    ? tRaw('Moved "{name}" to Trash.', { name: trashEntryName(first) })
    : allKind('session')
      ? tRaw('Moved {n} sessions to Trash.', { n: entries.length })
      : allKind('asset')
        ? tRaw('Moved {n} uploads to Trash.', { n: entries.length })
        : tRaw('Moved {n} items to Trash.', { n: entries.length });
  announce(message);
  showUndoToast({
    message,
    undo: async () => {
      let back = 0;
      for (const entry of entries) {
        const result = await trash.restore(entry).catch(() => null);
        if (result && result.status !== 'gone') back++;
      }
      announce(!back
        ? (entries.length === 1 ? tRaw('"{name}" is no longer in the Trash.', { name: trashEntryName(first) }) : t('These items are no longer in the Trash.'))
        : entries.length === 1 ? tRaw('Restored "{name}".', { name: trashEntryName(first) }) : tRaw('Restored {n} items.', { n: back }));
      await after?.(back);
    },
  });
}

/**
 * A web delete door in one call, for the doors that load the Trash on the delete
 * gesture: the Trash over the view's host (checked by trashHostOf), the move that
 * `move` makes in it, and the Undo toast once something moved. Resolves what
 * moved, empty when nothing could be, so the door can tell the person.
 */
export async function moveToTrash<E extends TrashEntry>(
  host: object,
  move: (trash: Trash) => Promise<E[]>,
  after?: (restored: number) => void | Promise<void>,
): Promise<E[]> {
  const trash = createTrash(trashHostOf(host));
  const moved = await move(trash);
  showTrashUndoToast(trash, moved, after);
  return moved;
}
