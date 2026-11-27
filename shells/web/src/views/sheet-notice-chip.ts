// SPDX-License-Identifier: MPL-2.0
/**
 * The phone input sheet's notice chip. On a phone the sheet shows a few inputs at
 * a time, so a warning under an input further down, in a folded section or in a
 * sheet at its small stop is out of sight. This chip stands on the sheet's free
 * edge while that is so: the section mark's dot and the count. A tap opens the
 * way to the first such input, scrolls the sheet there and focuses its control.
 *
 * Only warnings and errors raise the chip; a note that only informs does not.
 * The chip is the shared `.chip` with the sidebar's own dot, placed by CSS inside
 * the phone breakpoint, so a wider layout never shows one. It is not announced:
 * the notice already was (views/input-notices.ts).
 */
import { t } from '../i18n.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { INPUT_NOTICES_EVENT, noticeControl } from './input-notices.ts';
import type { MobileSheetHandle } from '../lib/mobile-sheet.ts';

const LOUD = '.input-notice--hook:is([data-tone="warning"], [data-tone="error"])';
/** The sheet's settle (--sheet-settle, 0.34s) and a frame. A section's unfold is shorter. */
const SETTLE_MS = 360;

export interface SheetNoticeChipOptions {
  layout: HTMLElement;
  sidebar: HTMLElement;
  sheet: Pick<MobileSheetHandle, 'state' | 'setState'>;
  /** Whether the phone sheet is the layout in force. Defaults to the breakpoint the CSS uses. */
  isPhone?: () => boolean;
}

export interface SheetNoticeChip {
  el: HTMLButtonElement;
  /** Count again now. The chip does this by itself on a scroll, a fold, a resize and a change of notices. */
  update: () => void;
}

export function mountSheetNoticeChip(o: SheetNoticeChipOptions): SheetNoticeChip {
  const { layout, sidebar, sheet } = o;
  const isPhone = o.isPhone ?? (() => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches);
  const body = sidebar.querySelector<HTMLElement>('.sidebar-body') ?? sidebar;

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'chip sheet-notice-chip';
  el.hidden = true;
  const dot = document.createElement('span');
  dot.className = 'input-section-mark';
  dot.setAttribute('aria-hidden', 'true');
  const words = document.createElement('span');
  el.append(dot, words);
  layout.append(el);

  /** The loud notices nobody can see right now, in panel order. */
  function hidden(): HTMLElement[] {
    const b = body.getBoundingClientRect();
    const s = sidebar.getBoundingClientRect();
    const top = Math.max(b.top, s.top);
    const bottom = Math.min(b.bottom, s.bottom);
    return [...sidebar.querySelectorAll<HTMLElement>(LOUD)].filter((note) => {
      const r = note.getBoundingClientRect();
      const drawn = r.height > 0 && r.width > 0;
      return !(drawn && r.top >= top - 1 && r.bottom <= bottom + 1);
    });
  }

  function update(): void {
    const out = isPhone() ? hidden() : [];
    if (!out.length) { if (!el.hidden) el.hidden = true; return; }
    const tone = out.some((n) => n.dataset.tone === 'error') ? 'error' : 'warning';
    const text = out.length === 1 ? t('1 notice') : t('{n} notices', { n: out.length });
    if (dot.dataset.tone !== tone) dot.dataset.tone = tone;
    if (words.textContent !== text) words.textContent = text;
    if (el.hidden) el.hidden = false;
  }

  let queued = 0;
  const soon = (): void => {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; update(); });
  };

  function reveal(): void {
    const note = hidden()[0];
    const row = note?.closest<HTMLElement>('.input-row');
    if (!note || !row) return;
    const section = row.closest<HTMLDetailsElement>('details.input-section');
    // A section that is still unfolding has no layout to scroll to and cannot take focus.
    const unfold = !!section && !section.open;
    if (section && unfold) section.open = true;
    const raise = sheet.state() === 'peek';
    if (raise) sheet.setState('half');
    const arrive = (): void => {
      // Scroll the sheet's own list and nothing else, so the page and the canvas stay put.
      const b = body.getBoundingClientRect();
      const from = row.getBoundingClientRect().top;
      const to = note.getBoundingClientRect().bottom;
      const middle = (from + to) / 2 - (b.top + b.height / 2);
      body.scrollTo({ top: body.scrollTop + middle, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      noticeControl(row)?.focus({ preventScroll: true });
      soon();
    };
    if (raise || unfold) setTimeout(arrive, SETTLE_MS); else arrive();
  }

  el.addEventListener('click', reveal);
  body.addEventListener('scroll', soon, { passive: true });
  sidebar.addEventListener('toggle', soon, true);
  sidebar.addEventListener(INPUT_NOTICES_EVENT, soon);
  // The sheet's height moves on a drag and on a settle, and the list's with a fold.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(soon);
    ro.observe(sidebar);
    ro.observe(body);
  }
  update();
  return { el, update };
}
