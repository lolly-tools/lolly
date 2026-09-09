// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: save to a project, the save button and quick-save.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { announce } from '../../a11y.js';
import { t } from '../../i18n.ts';
import { markSyncDirty } from '../../lib/sync-service.ts';
import { navigateTo } from '../../nav.js';
import { snapshotSession } from '../tool-session-snapshot.ts';
import { THUMB_CAPTURE_TIMEOUT_MS, captureThumbnail } from '../tool-action-helpers.ts';
import { jellyActive } from '../../lib/jelly.ts';
import { readBleed, readMarks } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

// The user now holds their artifact (a download, a clipboard copy, a library
// save). tool.ts listens for this to stand down the unsaved-changes leave
// guard: a session whose latest edits made it out is resolved, not unsaved.
export const exportCompleted = (ta: ActionsCtx): void => {
  const { el } = ta;
  el?.dispatchEvent(new CustomEvent('lolly:export-complete', { bubbles: true }));
};
// The Save action - one builder for both render sites (the default actions row
// and the save-only bar for input-less tools). Jelly mode swaps in a neutral
// <jelly-button>; the `save-btn` class stays for the icon-collapse @container
// rules, which are class-keyed, and carries no box paint of its own.
export const saveBtnHtml = (ta: ActionsCtx) =>
  { const { SAVE_SVG } = ta; return jellyActive()
    ? `<jelly-button variant="platinum" data-action="save" data-sfx="save" class="save-btn" title="Save to your library">${SAVE_SVG}<span data-save-label>Save</span></jelly-button>`
    : `<button data-action="save" data-sfx="save" class="save-btn" title="Save to your library">${SAVE_SVG}<span data-save-label>Save</span></button>`; };
// The exact payload a save persists - live input values plus the `__` markers
// (tool identity + export settings). Shared by performSave and the "Make
// variants" action so a variant is byte-for-byte a normal saved session.
export const sessionSnapshot = (ta: ActionsCtx) => { const { el, experience, manifest, runtime } = ta; return snapshotSession(el, manifest, runtime, experience, readBleed, readMarks); };
// Shared, awaitable save routine - used by the Save button AND the
// unsaved-changes dialog's "Save & leave". Returns true on success. Always
// re-enables the button and surfaces failures: a save error used to leave the
// button stuck on "Saving…" silently, which made "Save & leave" appear to do
// nothing (and then click a now-disabled button - a no-op). The thumbnail is
// best-effort (captureThumbnail swallows its own errors), so it never blocks a save.
export async function performSave(ta: ActionsCtx, 
  saveBtnEl?: HTMLElement | null,
  opts?: { folderId?: string | null }
): Promise<boolean> {
  const { canvasEl, el, exportUnscaled, host, manifest, runtime } = ta;
  // Either the native <button> or its jelly-mode <jelly-button> stand-in -
  // disabling goes through the ATTRIBUTE, which both honour (jelly-button
  // observes it and syncs its shadow button).
  const btn = (saveBtnEl ??
    el?.querySelector('[data-action="save"]')) as HTMLButtonElement | null;
  if (!btn || btn.dataset.saving) return false;
  const label = btn.querySelector<HTMLElement>('[data-save-label]') ?? btn;
  const idle = label.textContent;
  btn.dataset.saving = '1';
  btn.toggleAttribute('disabled', true);
  label.textContent = 'Saving…';
  try {
    // Reuse the session's slot after the first save (or when resuming an existing
    // session) so a re-save updates it in place; only mint a new slot the first time.
    const slot = ta.activeSlot || `${manifest.id}:${Date.now()}`;
    const data = sessionSnapshot(ta);
    // Durable FIRST. The thumbnail is best-effort decoration, but it used to be
    // AWAITED ahead of the write - so in a throttled tab (hidden or occluded:
    // rAF frozen, waitForQuiescence stalled) the put trailed the click by up to
    // THUMB_CAPTURE_TIMEOUT_MS, and a tab closed or navigated in that window
    // lost the save silently after its success UI had already played (audit 167
    // F-A3's root cause). Now the record is written in milliseconds; the
    // thumbnail patches it below, whenever it arrives.
    if (ta.automaticHistory) await ta.automaticHistory.save(slot, data);
    else await host.state.save(slot, data, null);
    markSyncDirty(); // device sync (plans/138): a saved session is a change to push (no-op if sync is off)
    // Background thumbnail patch. captureThumbnail swallows its own errors, and
    // the race caps a render that never quiesces. The generation check keeps a
    // slow capture from clobbering a NEWER re-save's data with this older data.
    const gen = ++ta.saveGen;
    if (!ta.automaticHistory) void Promise.race([
      captureThumbnail(manifest, canvasEl, runtime, exportUnscaled, data.__export_format),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), THUMB_CAPTURE_TIMEOUT_MS)),
    ])
      .then((thumb) =>
        thumb && gen === ta.saveGen ? host.state.save(slot, data, thumb) : undefined
      )
      .catch(() => {
        /* the thumbnail is an extra - the session is already saved */
      });
    // Remember the slot so the next save updates THIS session rather than creating a
    // duplicate (see activeSlot above). Set before filing so a fresh first-save is
    // both filed into its folder AND pinned as the active slot for later edits.
    ta.activeSlot = slot;
    // File the session into a folder. The Save dialog passes an EXPLICIT `opts.folderId`
    // (a chosen project, or null = leave at library root - "No project"); when it is
    // absent (the plain button / programmatic saves) fall back to the folder the Projects
    // "+ New tool" flow claimed at mount (fileIntoFolder). `moveItem(slot, null)` is a
    // no-op, so an explicit "root" choice simply doesn't file. One-shot, best-effort.
    const target = opts && 'folderId' in opts ? (opts.folderId ?? null) : ta.fileIntoFolder;
    if (target) {
      try {
        const { createFolderStore } = await import('../../folders.js');
        await createFolderStore(
          host as unknown as Parameters<typeof createFolderStore>[0]
        ).moveItem(slot, target, 'session');
      } catch (_e) {
        /* filing is best-effort */
      }
    }
    ta.fileIntoFolder = null;
    label.textContent = 'Saved';
    announce('Saved');
    exportCompleted(ta);
    return true; // leave the button as-is; the caller navigates away
  } catch (e) {
    console.error('Save failed:', e);
    label.textContent = idle;
    btn.toggleAttribute('disabled', false);
    delete btn.dataset.saving;
    announce('Save failed');
    return false;
  }
}
// S2 (plans/140): Save no longer exits the tool. performSave leaves its button
// disabled reading "Saved" for the old navigate-away flow, so hold that as the
// confirmation, restore the button, and offer the library as a toast action
// instead of a forced navigation.
export function settleSaveButton(_ta: ActionsCtx, btn: HTMLButtonElement): void {
  const label = btn.querySelector<HTMLElement>('[data-save-label]') ?? btn;
  setTimeout(() => {
    label.textContent = 'Save';
    btn.toggleAttribute('disabled', false);
    delete btn.dataset.saving;
  }, 1500);
  void import('../../lib/undo-toast.ts').then(({ showUndoToast }) =>
    showUndoToast({
      message: t('Saved'),
      actionLabel: t('Open Projects'),
      undo: () => navigateTo('#/p'),
      duration: 6000,
    })
  );
}
// plans/142 W2 (Andy's call): the quick Save follows the Save dialog's lead -
// an UNFILED session files into the last project a dialog save picked, so a
// sitting's outputs stop scattering to the library root. A session already
// filed somewhere keeps its folder (an explicit folderId on re-save MOVES it,
// which no quick save may ever do), and a deliberate "No project" pick in the
// dialog clears the memory, so that choice is followed too. Best-effort: any
// failure saves exactly as before.
export async function quickSaveFolder(ta: ActionsCtx): Promise<string | null> {
  const { host } = ta;
  try {
    const { lastPickedFolder } = await import('../../lib/save-dialog.ts');
    const remembered = lastPickedFolder();
    if (!remembered) return null;
    if (ta.activeSlot) {
      const { createFolderStore } = await import('../../folders.js');
      const store = createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]);
      if (store.folderOfRef(await store.list(), ta.activeSlot)) return null;
    }
    return remembered;
  } catch {
    return null;
  }
}
export function savingOps(ta: ActionsCtx) {
  return {
    exportCompleted: bindOp(ta, exportCompleted),
    saveBtnHtml: bindOp(ta, saveBtnHtml),
    sessionSnapshot: bindOp(ta, sessionSnapshot),
    performSave: bindOp(ta, performSave),
    settleSaveButton: bindOp(ta, settleSaveButton),
    quickSaveFolder: bindOp(ta, quickSaveFolder),
  };
}
