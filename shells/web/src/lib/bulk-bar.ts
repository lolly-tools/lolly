// SPDX-License-Identifier: MPL-2.0
/**
 * Shared bulk-action bar - the floating bottom-centre pill that appears over a
 * multi-selection (count + actions + ✕ clear), extracted from the two structurally
 * identical copies projects.ts and catalog.ts grew.
 *
 * This module owns the MARKUP and the SYNC (show/hide, count, per-action
 * hidden/disabled/label refresh, the `.has-selection` room-reservation class, and
 * a busy state for long-running bulk work). Each view keeps:
 *  - its `[data-bulk]` click delegation (the bar is inside the view's own root,
 *    whose delegated click handler already exists) and its action implementations;
 *  - its CSS skin + bottom offset. Class names are generated off `prefix`
 *    (`{prefix}`, `{prefix}-count`, `{prefix}-actions`, `{prefix}-clear`), so the
 *    existing `.projects-bulkbar` / `.cat-bulkbar` sheets apply unchanged - the
 *    two bars deliberately differ (card vs popover surface, footer clearance), and
 *    that stays a per-view decision.
 *
 * Dynamic actions: `label`/`title`/`hidden`/`disabled` may be functions, re-read on
 * every `sync()` - that's how a smart toggle ("Favourite" ↔ "Unfavourite") or a
 * context-dependent action ("Edit together" only for 2–8 sessions) stays honest
 * without a re-render.
 */

import { t } from '../i18n.ts';
import { escape } from '../utils.ts';

export interface BulkBarAction {
  /** The `data-bulk` value the view's delegated click handler dispatches on. */
  id: string;
  /** Inline SVG (lib/icons.ts) - optional. */
  icon?: string;
  label: string | (() => string);
  title?: string | (() => string);
  /** Extra classes on the button (variants like `projects-bulk-danger`). */
  extraClass?: string;
  hidden?: () => boolean;
  disabled?: () => boolean;
}

export interface BulkBarConfig {
  /** Class prefix - 'projects-bulkbar' | 'cat-bulkbar' | 'gallery-bulkbar'. */
  prefix: string;
  /** The view root that gets `.has-selection` while the bar shows (reserves bottom
   *  room so the fixed bar never buries the last tile row). */
  rootSelector: string;
  count: () => number;
  actions: BulkBarAction[];
}

const readText = (v: string | (() => string) | undefined): string => (typeof v === 'function' ? v() : v ?? '');

/** The bar's markup - render once per view render, hidden; sync() reveals it. */
export function bulkBarHtml(cfg: BulkBarConfig): string {
  const buttons = cfg.actions.map(a => {
    const title = readText(a.title);
    return `<button type="button" class="btn${a.extraClass ? ` ${a.extraClass}` : ''}" data-bulk="${escape(a.id)}"${a.hidden?.() ? ' hidden' : ''}${a.disabled?.() ? ' disabled' : ''}${title ? ` title="${escape(title)}"` : ''}>${a.icon ?? ''}<span>${escape(readText(a.label))}</span></button>`;
  }).join('');
  return `
    <div class="${cfg.prefix}" role="region" aria-label="${escape(t('Selection actions'))}" hidden>
      <span class="${cfg.prefix}-count" aria-live="polite"></span>
      <div class="${cfg.prefix}-actions">${buttons}</div>
      <button type="button" class="${cfg.prefix}-clear" data-bulk="clear" aria-label="${escape(t('Clear selection'))}">✕</button>
    </div>`;
}

/** Reflect the current selection into the (already-rendered) bar: show/hide, count,
 *  and each action's dynamic label/title/hidden/disabled. Call after every selection
 *  change and once per render. A busy bar (setBulkBarBusy) is left alone so progress
 *  text isn't clobbered mid-run. */
export function syncBulkBar(host: HTMLElement, cfg: BulkBarConfig): void {
  const bar = host.querySelector<HTMLElement>(`.${cfg.prefix}`);
  if (!bar) return;
  const n = cfg.count();
  host.querySelector(cfg.rootSelector)?.classList.toggle('has-selection', n > 0);
  if (bar.classList.contains('is-busy')) return;
  bar.hidden = n === 0;
  const count = bar.querySelector(`.${cfg.prefix}-count`);
  if (count) count.textContent = t('{n} selected', { n });
  for (const a of cfg.actions) {
    const btn = bar.querySelector<HTMLButtonElement>(`[data-bulk="${a.id}"]`);
    if (!btn) continue;
    btn.hidden = a.hidden?.() ?? false;
    btn.disabled = a.disabled?.() ?? false;
    const label = btn.querySelector('span');
    if (label) label.textContent = readText(a.label);
    const title = readText(a.title);
    if (title) btn.title = title;
  }
}

/** Put the bar into (or out of) a busy state for a long-running bulk action: the
 *  count line becomes the progress label ("Pinning 3 of 7…"), every control
 *  disables, and sync() leaves the bar alone until the run ends. Pass null to
 *  restore - the caller should sync() right after.
 *
 *  NO PRODUCTION CALLERS as of the 2026-08 mobile pass: every long bulk run (the
 *  gallery's offline pin, the catalog's duplicate + zip) now rides a background job
 *  and reports in the global job toast (lib/job-toast.ts), which is cancellable and
 *  survives navigation. That is the pattern to reach for. If a genuinely view-scoped
 *  busy state ever needs this again, EXEMPT the `{prefix}-clear` button from the
 *  disable loop below: locking ✕ Clear for the length of the run left the user with
 *  no way out of a selection, which is exactly why the pin flow moved off it. */
export function setBulkBarBusy(host: HTMLElement, cfg: BulkBarConfig, label: string | null): void {
  const bar = host.querySelector<HTMLElement>(`.${cfg.prefix}`);
  if (!bar) return;
  if (label !== null) {
    bar.classList.add('is-busy');
    const count = bar.querySelector(`.${cfg.prefix}-count`);
    if (count) count.textContent = label;
    for (const b of bar.querySelectorAll<HTMLButtonElement>('button')) b.disabled = true;
  } else {
    bar.classList.remove('is-busy');
    for (const b of bar.querySelectorAll<HTMLButtonElement>('button')) b.disabled = false;
  }
}

/**
 * Escape clears the selection - the keyboard exit every selection surface was
 * missing (Escape previously only cancelled a live marquee). Bound on document so
 * it works wherever focus sits, with two yields:
 *  - any open overlay owns Escape first: native dialogs; body-mounted popover
 *    menus, which exist in the DOM only while open (.folder-menu covers every
 *    context/view-options menu including the hand-rolled projects one that
 *    carries no role; role="menu"/"listbox" covers lang/profile menus); and the
 *    in-place filter popovers, which toggle [hidden] instead - hence the
 *    :not([hidden]) check (both the gallery's and the catalog's carry
 *    .filter-popover);
 *  - a focused text field keeps its own Escape (clearing a search box must not
 *    also drop the selection).
 * Returns the unbind - register it in the view's `_cleanup`.
 */
export function wireEscapeClearsSelection(opts: { active: () => boolean; clear: () => void }): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !opts.active()) return;
    if (document.querySelector('dialog[open], .folder-menu, [role="menu"], [role="listbox"], .filter-popover:not([hidden])')) return;
    const a = document.activeElement;
    if (a instanceof HTMLElement && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
    opts.clear();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
