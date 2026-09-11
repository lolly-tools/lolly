// SPDX-License-Identifier: MPL-2.0
/**
 * The trust lamp strip - the glanceable illumination header for the verify
 * view and the catalog passport. Four lamps, one visual grammar:
 *
 *   fact  (green)  - something VERIFIED on this device
 *   warn  (red)    - danger; never lives inside a fold
 *   hint  (amber)  - signals, graded, never proof
 *   unlit (grey)   - not checkable here. UNLIT IS NOT A VERDICT - the legend
 *                    says so once, and an unlit lamp must never be styled as
 *                    a failure.
 *
 * Colour is never the only carrier: every lamp shows its state WORD beside
 * its label, and `stripAriaSummary` gives screen readers the whole strip in
 * one sentence. Lamps are buttons carrying `data-lamp-target`; each view owns
 * the delegated click that scrolls its section into view (an href fragment
 * would fight the SPA's hash router).
 *
 * Pure string builders - every interpolated value is escape()d; the strip
 * renders through the views' existing reviewed sinks.
 */
import { escape } from '../utils.ts';
import { t } from '../i18n.ts';

export type LampState = 'fact' | 'warn' | 'hint' | 'unlit';

export interface TrustLamp {
  /** Stable id; doubles as the default scroll target (`data-lamp-target`). */
  id: string;
  /** The lamp's name, e.g. "Provenance". Localised by the caller. */
  label: string;
  state: LampState;
  /** The state in words, e.g. "verified" / "2 warnings" / "not checkable". */
  word: string;
  /** Tooltip detail. */
  detail?: string;
}

/** The strip. `flat` drops the sticky pinning (the catalog passport is short
 *  enough that pinning is noise); the legend renders once when any lamp is
 *  unlit, so "grey" can never be misread as "failed". */
export function lampStripHtml(lamps: readonly TrustLamp[], opts: { flat?: boolean } = {}): string {
  if (!lamps.length) return '';
  const cells = lamps.map((l) => `<button type="button" class="lamp" data-state="${escape(l.state)}" data-lamp-target="${escape(l.id)}"${l.detail ? ` title="${escape(l.detail)}"` : ''}>`
    + '<span class="lamp-dot" aria-hidden="true"></span>'
    + `<span class="lamp-label">${escape(l.label)}</span>`
    + `<span class="lamp-word">${escape(l.word)}</span>`
    + '</button>').join('');
  const legend = lamps.some((l) => l.state === 'unlit')
    ? `<p class="lampstrip-legend">${escape(t('An unlit lamp means that check has nothing to read here - it is not a verdict.'))}</p>`
    : '';
  return `<div class="lampstrip${opts.flat ? ' lampstrip--flat' : ''}" role="group" aria-label="${escape(t('Trust summary'))}">`
    + `<span class="visually-hidden">${escape(stripAriaSummary(lamps))}</span>${cells}${legend}</div>`;
}

/** The one-read screen-reader overview: counts first, then each lamp. */
export function stripAriaSummary(lamps: readonly TrustLamp[]): string {
  const warns = lamps.filter((l) => l.state === 'warn').length;
  const facts = lamps.filter((l) => l.state === 'fact').length;
  const head = warns > 0
    ? t('{n} warnings.', { n: warns })
    : facts > 0 ? t('No warnings.') : t('Nothing verified either way.');
  return `${head} ${lamps.map((l) => `${l.label}: ${l.word}`).join('. ')}.`;
}

/** Wire the strip's lamp clicks inside `root`: scroll the named section into
 *  view. Delegated once per container; safe to call after each re-render. */
export function wireLampScroll(root: HTMLElement): void {
  if (root.dataset.lampWired) return;
  root.dataset.lampWired = '1';
  root.addEventListener('click', (e) => {
    const lamp = (e.target as HTMLElement).closest<HTMLElement>('[data-lamp-target]');
    if (!lamp) return;
    const target = root.querySelector(`[data-lamp-section="${CSS.escape(lamp.dataset.lampTarget ?? '')}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
