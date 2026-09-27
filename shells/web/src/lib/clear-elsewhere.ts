// SPDX-License-Identifier: MPL-2.0
/**
 * The web shell's side of lib/clear-signal.ts ("Clear all my data" across tabs,
 * plan 277 review B6):
 *
 *   - `guardHostWrites(host)` wraps every host method that writes the person's
 *     data, so a tab that must stop for a clear refuses the write before it
 *     starts, and a write that did start is counted so the clear waits for that
 *     write to finish.
 *     IndexedDB is also sealed underneath (bridge/db.ts), but the Tauri apps keep
 *     saved sessions as files, which only this wrapper stops.
 *   - a notice in the tab another tab's clear stopped, installed when this module
 *     loads (bridge/index.ts imports it at boot), saying why nothing saves and
 *     that the tab reloads.
 *
 * The method list mirrors lib/sync-changes.ts `trackHostChanges`: the same writes
 * that mark sync as having changes waiting are the ones a clear must stop.
 */
import { t } from '../i18n.ts';
import { mountModal } from '../components/modal.ts';
import { clearSignal, type ClearSignal } from './clear-signal.ts';

/** A write refused because the data was cleared in another tab (or this tab is clearing). */
export class ClearedElsewhereError extends Error {
  constructor() {
    super(t('Your data was cleared in another tab. Reload this tab to keep working.'));
    this.name = 'ClearedElsewhereError';
  }
}

/** Every host method that writes the person's data, by part. */
export const GUARDED_HOST_WRITES: Readonly<Record<string, readonly string[]>> = {
  state: ['save', 'restore', 'delete'],
  profile: ['set'],
  assets: [
    '_uploadUserAsset', '_duplicateUserAsset', '_restoreUserAssetVersion', '_removeUserAssetVersion',
    '_importUserAsset', '_deleteUserAsset', '_renameUserAsset', '_updateUserAssetMeta',
    '_restampUserAsset', '_replaceUserAssetBytes', '_setUserAssetTrashed',
  ],
  designSystems: ['put', 'remove', 'setActive'],
};

/**
 * Wrap the writing methods of `host`. Call once, after lib/sync-changes.ts's
 * `trackHostChanges`, so this is the outer layer: a refused write never reports a
 * local change, and so never schedules a sync push.
 */
export function guardHostWrites(host: object, signal: ClearSignal = clearSignal): void {
  const parts = host as Record<string, Record<string, unknown> | undefined>;
  for (const [part, names] of Object.entries(GUARDED_HOST_WRITES)) {
    const target = parts[part];
    if (!target) continue;
    for (const name of names) {
      const original = target[name];
      if (typeof original !== 'function') continue;
      const fn = original as (...args: unknown[]) => unknown;
      target[name] = function guarded(this: unknown, ...args: unknown[]): Promise<unknown> {
        if (signal.writesBlocked()) return Promise.reject(new ClearedElsewhereError());
        try {
          return signal.trackWrite(Promise.resolve(fn.apply(this, args)));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    }
  }
}

/** Show the notice: a modal the person cannot dismiss with Escape or a backdrop
 *  click, because the tab is about to reload and anything typed behind it would not
 *  be kept. Capture listeners on the dialog run before the modal's own dismissal
 *  handlers and stop them. */
function showClearedElsewhereNotice(): void {
  if (typeof document === 'undefined') return;
  const show = (): void => {
    if (document.querySelector('dialog.clear-elsewhere')) return;
    const modal = mountModal<void>(`
      <h2 class="modal-title" id="clear-elsewhere-title">${t('Your data was cleared in another tab')}</h2>
      <p class="modal-msg" id="clear-elsewhere-msg">${t('This tab has stopped saving, so nothing here is written back. It reloads as soon as the clear finishes.')}</p>`, {
      className: 'modal clear-elsewhere',
    });
    const dlg = modal.el;
    dlg.setAttribute('aria-labelledby', 'clear-elsewhere-title');
    dlg.setAttribute('aria-describedby', 'clear-elsewhere-msg');
    const stay = (e: Event): void => {
      if (e.target !== dlg) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    dlg.addEventListener('cancel', stay, { capture: true });   // Escape
    dlg.addEventListener('click', stay, { capture: true });    // the backdrop
  };
  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show, { once: true });
}

clearSignal.onStale(showClearedElsewhereNotice);
