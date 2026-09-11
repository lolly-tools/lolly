// SPDX-License-Identifier: MPL-2.0
// footer-nav.ts - the bottom nav bar's MARKUP: [Pro?] [Dashboard]  <search>  [Verify]
// [What?]. Since plans/99 M1 the live bar is a shell-level singleton rendered and
// wired ONCE by components/search-bar.ts (views claim its field instead of building
// their own footer); the only other consumer is the component library's in-flow
// specimen. This module stays markup-only so that split holds.
import { escape } from '../utils.ts';
import { t, docsAppHref } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { jellyActive } from '../lib/jelly.ts';
import { privacyNoticeAcknowledged } from '../views/privacy-notice.ts';

/** The nav-bar glyphs (Lucide house style), shared so all three footers match.
 *  Path data lives in lib/icons.ts - .shield is 'shieldCheck' there, deduped
 *  against profile.ts's identical VERIFY_SHIELD (component-audit rec 5). */
export const NAV_ICONS = {
  search: icon('search'),
  shield: icon('shieldCheck'),
  zap: icon('zap'),
  table: icon('table'),
  help: icon('help'),
  dashboard: icon('dashboard'),
  open: icon('upload'),
} as const;

/** The standard `.gallery-search` field + its ✕ clear button (Tools gallery + Catalogue
 *  use it verbatim, component-audit rec 11 - previously the gallery minted its own
 *  `.gallery-search-clear` with inline JS styles while the catalog borrowed projects'
 *  `.projects-search-clear`). `type="text"` (not "search") so the browser's own native
 *  cancel button doesn't double up with ours. The ✕ starts `hidden` unless `value` is
 *  already non-empty (a restored query) - each view toggles the `hidden` attribute as
 *  the field's content changes. */
export function gallerySearchBox(opts: { placeholder: string; ariaLabel: string; value?: string; className?: string; clearLabel?: string; kbdHint?: { label: string; title: string } }): string {
  const cls = opts.className ?? 'gallery-search';
  const value = opts.value ?? '';
  // The spotlight chord hint (plans/99 section 2f): a decorative <kbd> chip right-aligned
  // inside the box. aria-hidden - it duplicates nothing (the chord is a shortcut,
  // not the only path) and screen-reader users get the combobox semantics instead.
  // Starts hidden when the field already has text (the ✕ takes that corner);
  // search-bar's syncClear toggles it as the content changes, and gallery.css
  // hides it on coarse pointers and under 640px.
  const kbd = opts.kbdHint
    ? `<kbd class="gallery-search-kbd" aria-hidden="true" title="${escape(opts.kbdHint.title)}"${value ? ' hidden' : ''}>${escape(opts.kbdHint.label)}</kbd>`
    : '';
  // Jelly effects mode swaps the native field for a <jelly-input>. Every caller
  // keeps working untouched: they query by the same class, `.value` is a live
  // getter/setter on the host, and the inner field's `input`/keydown events are
  // composed so host-bound listeners fire as before. The icon + ✕ still overlay
  // the field (they need z-index above the jelly canvas - footer-nav.css).
  const field = jellyActive()
    // The inline padding-inline var is required: it insets the shadow
    // field's text clear of the overlaid magnifier/✕. It must be INLINE - the
    // lib/jelly.ts bridge sheet is unlayered and sets a chrome-wide
    // --jelly-input-padding-inline, and unlayered rules beat any @layer views
    // stylesheet rule regardless of specificity; only an inline style outranks it.
    // height inline for the same cascade reason as padding-inline: the component's
    // shadow `:host{height:56px}` reads too tall / over-padded next to the footer's
    // jelly-button links. 2.75rem (44px) trims the vertical padding to match them.
    ? `<jelly-input class="${cls}" style="--jelly-input-padding-inline:2.1rem;height:2.75rem" type="text" placeholder="${escape(opts.placeholder)}" autocomplete="off" label="${escape(opts.ariaLabel)}"${value ? ` value="${escape(value)}"` : ''}></jelly-input>`
    : `<input class="${cls}" type="text" placeholder="${escape(opts.placeholder)}" autocomplete="off" spellcheck="false" aria-label="${escape(opts.ariaLabel)}"${value ? ` value="${escape(value)}"` : ''}>`;
  return `<div class="gallery-search-wrap${jellyActive() ? ' gallery-search-wrap--jelly' : ''}">
    <div class="gallery-search-box">
      <span class="gallery-search-icon" aria-hidden="true">${NAV_ICONS.search}</span>
      ${field}
      <button type="button" class="gallery-search-clear" data-search-clear aria-label="${escape(opts.clearLabel ?? t('Clear search'))}"${value ? '' : ' hidden'}>✕</button>
      ${kbd}
    </div>
  </div>`;
}

export interface FooterNavOpts {
  /** The middle search field - gallerySearchBox(...). */
  searchHtml: string;
}

// Jelly nav items are <jelly-button>s (the component is a real <button>, not a
// link), so they navigate on click here. Composed shadow clicks retarget to the
// host; a modifier click opens a new tab so the "open in new tab" affordance of
// the <a>s they replace is preserved. Installed once, on the first jelly render.
let navHandlerInstalled = false;
function ensureNavHandler(): void {
  if (navHandlerInstalled || typeof document === 'undefined') return;
  navHandlerInstalled = true;
  document.addEventListener('click', (e: MouseEvent) => {
    const host = e.target instanceof Element ? e.target.closest<HTMLElement>('jelly-button[data-href]') : null;
    const href = host?.getAttribute('data-href');
    if (!href) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(href, '_blank', 'noopener');
    else location.assign(href);
  });
}

/** One footer nav item - the plain `.btn` link, or its soft-body <jelly-button>
 *  stand-in (data-href → the click handler above) when the jelly flag is on. */
function navItem(o: { href: string; nativeClass: string; variant?: string; style?: string; sfx?: string; aria: string; inner: string }): string {
  const sfxAttr = o.sfx ? ` data-sfx="${o.sfx}"` : '';
  if (jellyActive()) {
    // Only the layout class `gallery-nav-jelly` rides on the host - NOT `.btn` /
    // `.gallery-nav-link` (their `.gallery-footer > .btn` display/flex rules would
    // fight the jelly host box). `size="sm"` gives compact padding; the visible
    // .gallery-nav-label span keeps its class so the mobile label-hide still works.
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - footerNav()'s four literal routes ('#/batch', '#/d', '#/verify', docsAppHref('index') → '#/docs/index')
    return `<jelly-button class="gallery-nav-jelly" size="sm"${o.variant ? ` variant="${o.variant}"` : ''}${o.style ?? ''} data-href="${escape(o.href)}"${sfxAttr} aria-label="${escape(o.aria)}">${o.inner}</jelly-button>`;
  }
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - same four literal footerNav() routes as the jelly branch above
  return `<a href="${escape(o.href)}" class="${o.nativeClass}"${sfxAttr} aria-label="${escape(o.aria)}">${o.inner}</a>`;
}

/** The shared bottom bar: [Open] [Dashboard]  <search>  [Verify] [What?].
 *  Batch moved OUT of here (Andy, 2026-08-26) - it now lives in the Projects top bar
 *  only (views/projects.ts topRightSlot), since a batch is a Projects-scoped action. */
export function footerNav({ searchHtml }: FooterNavOpts): string {
  if (jellyActive()) ensureNavHandler();
  const label = (txt: string) => `<span class="gallery-nav-label">${txt}</span>`;
  // "Open" is an ACTION, not a route - it opens the OS file picker to import a
  // .lolly / design / image (drop-router's openDropFilePicker). So it's a button,
  // not a link, wired document-level in main.ts on the [data-open-file] hook.
  const openAria = t('Open a file - import a .lolly, design or image');
  const openInner = `${NAV_ICONS.open}${label(t('Open'))}`;
  const open = jellyActive()
    ? `<jelly-button class="gallery-nav-jelly" size="sm" variant="platinum" data-open-file data-sfx="click" aria-label="${escape(openAria)}">${openInner}</jelly-button>`
    : `<button type="button" class="gallery-nav-link btn" data-open-file data-sfx="click" aria-label="${escape(openAria)}">${openInner}</button>`;
  const dashboard = navItem({
    href: '#/d', nativeClass: 'gallery-nav-link btn', variant: 'platinum', sfx: 'dashboard',
    aria: t('Dashboard - this device, the brand system & the full feature set'), inner: `${NAV_ICONS.dashboard}${label(t('Dashboard'))}`,
  });
  // Verify keeps its solid SUSE Pine Green pill (explicit green in every theme,
  // matching the native rule) via an inline --jelly-fill / --jelly-label.
  const verify = navItem({
    href: '#/verify', nativeClass: 'gallery-nav-link gallery-nav-link--verify btn', sfx: 'verify',
    style: ' style="--jelly-fill:hsl(151 57% 42%);--jelly-label:#fff"',
    aria: t('Verify Content Credentials - check any file on-device'), inner: `${NAV_ICONS.shield}${label(t('Verify'))}`,
  });
  // In-app route, not the static /info page (Andy, 2026-08-16): the reader who
  // taps "What?" keeps the app experience - the music keeps playing and the a11y
  // prefs stay applied - because #/docs rehosts the same built pages inside the
  // shell. The static /info URLs remain the share/SEO surface (docsHref).
  const whatIs = navItem({
    href: docsAppHref('index'), nativeClass: 'gallery-info-link btn', variant: 'platinum',
    aria: t('What is Lolly? - about & help'), inner: `${NAV_ICONS.help}${label(t('What?'))}`,
  });
  // First run only (plans/163 F11): on a phone the four buttons collapse to bare
  // glyphs, which a newcomer has to guess at. While the privacy notice is still
  // unacknowledged - the app's existing "this person has just arrived" flag, also
  // set by settling the welcome dialog - the bar carries data-first-run and
  // gallery.css shows each button's name underneath in small muted type. Once the
  // flag is set the attribute is gone and the markup is byte-identical to before.
  const firstRun = privacyNoticeAcknowledged() ? '' : ' data-first-run';
  return `
    <footer class="gallery-footer${jellyActive() ? ' gallery-footer--jelly' : ''}"${firstRun}>
      ${open}
      ${dashboard}
      ${searchHtml}
      ${verify}
      ${whatIs}
    </footer>`;
}
