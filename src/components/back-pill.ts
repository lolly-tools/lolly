// SPDX-License-Identifier: MPL-2.0
/**
 * The back pill - the "← Tools" control that used to be hand-written in every
 * view that has one (Dashboard, Verify, Profile, /pro, /start, the component
 * library, full-screen and sidebar tools, multi-edit).
 *
 * Two things were wrong with the hand-written copies, and this module fixes
 * both in one place:
 *
 * 1. They were LIES. Each was a hardcoded `<a href="#/">Tools</a>` - it always
 *    said "Tools" and always teleported to the gallery, no matter where you had
 *    actually come from. Opening the Dashboard from a Projects folder and
 *    pressing back dumped you in the gallery. Now the pill reads the view you
 *    last left (lib/back-nav.ts, already fed by the router) and both NAMES and
 *    RETURNS to it - "← Campaign assets", "← QR Code" - falling back to
 *    "← Home" → the gallery only when there is no previous view, i.e. you
 *    opened the URL directly. It also behaves like a back button: when a real
 *    history entry sits behind us it calls history.back() rather than pushing
 *    another entry, so back-back-back doesn't build a zig-zag stack.
 *
 * 2. They were MISALIGNED. The pill sat at its own top offset with its own
 *    padding while the top-right chrome cluster (.gallery-topright - the
 *    filter/history/language FABs and the profile pill) sat at another, so the
 *    two ends of the top row never lined up. The pill now shares the cluster's
 *    box metrics and offsets (see .tools-home / .tools-home.home-full in
 *    styles/parts/components.css + tool.css) and draws a stroked Lucide arrow
 *    instead of a text "←", so it reads as one of the same set.
 *
 * Call-sites render `backPillHtml()` and then wire `mountBackPill()`. Views
 * with unsaved work (the tool view, /pro) pass an `intercept` that takes over
 * the click and calls the supplied `go()` once the user has decided - that way
 * the confirm dialog and the pill never both navigate. `mountBackPill()` also
 * puts the always-Home FAB beside a tool-chrome pill that names anything other
 * than Home (addHomeEscape) - naming where you came from is the right pattern
 * until two tools name each other and the front door leaves the chrome.
 */

import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { canGoBack, getPrevView } from '../lib/back-nav.ts';
import { navigateTo } from '../nav.ts';
import { homeFabEl, homeFabHtml } from './home-fab.ts';

/** The front door. Root-absolute: a bare '#/' resolves against the current path,
 *  and a tool's canonical URL is the PATH form /t/<id> (see home() below). */
const HOME_HREF = '/#/';

export interface BackTarget {
  /** Where the pill points. Always a real href so middle-click/copy-link work. */
  href: string;
  /** The pill's text, already localised - render escaped. */
  label: string;
  /** True when clicking should pop the history entry instead of pushing a new one. */
  useHistory: boolean;
  /**
   * True when the pill is the front-door escape rather than a real "back": either
   * there is no previous view (a direct/deep-link entry), OR the resolved back
   * target IS the current view (a self-loop - pressing back would land where you
   * already are). The pill wears a HOME icon in this case instead of the back
   * arrow, so it reads as "leave to Home" rather than a back that goes nowhere.
   */
  isHome: boolean;
}

export interface BackPillOpts {
  /**
   * A target this view must return to regardless of history - the tool view's
   * launch folder (the `lolly:returnTo` marker). When the previous view IS that
   * target the pill still wears its name and still goes back through history;
   * otherwise it becomes a plain forward link, since history.back() would land
   * somewhere else entirely.
   */
  href?: string;
  /** Force the label (rare - only when the caller knows better than the router). */
  label?: string;
  /** Extra classes on the pill: 'home-full' (fixed top-left, the default),
   *  'sidebar-back' (in the tool sidebar's back row), 'start-back' (in flow). */
  class?: string;
  /** Drop the visible label and keep only the arrow, moving the destination into
   *  the aria-label - for the compact square in a dense header row (multi-edit),
   *  where a full pill would crowd the title. The destination is still resolved
   *  the same way, so screen readers get "Back to Campaign assets", not "Back". */
  iconOnly?: boolean;
}

/** Compare two in-app URLs ignoring a leading slash - `/#/p/x` vs `#/p/x`. */
const sameTarget = (a: string, b: string): boolean =>
  a.replace(/^\//, '') === b.replace(/^\//, '');

/**
 * Where back should go and what it should be called. Exported because views
 * need the same answer for their non-pill exits too (the tool view's
 * "Save & leave", /start's done button) - those must not drift from the pill.
 */
export function resolveBackTarget(opts: BackPillOpts = {}): BackTarget {
  const prev = getPrevView();
  // The view we are on right now, so a back target that resolves to THIS view can
  // be caught and turned into a Home escape instead of a button that loops.
  const hereRel = (() => {
    try {
      const u = new URL(window.location.href);
      return u.pathname + u.search + u.hash;
    } catch { return window.location.hash; }
  })();
  // The front-door escape - no real "back" exists, so leave to Home. `isHome`
  // makes the pill wear a house icon rather than a back arrow.
  //
  // The href MUST be root-absolute. A bare '#/' resolves against whatever path
  // we're on, and a tool's canonical URL is the PATH form /t/<id> - so '#/'
  // became /t/<id>#/, which parseRoute (main.ts) reads as … the same tool: hash
  // '/' is skipped, the /t/<id> path branch wins. That left anyone who opened a
  // tool link directly with no way out of the editor at all.
  const home = (): BackTarget => ({ href: HOME_HREF, label: opts.label ?? t('Home'), useHistory: false, isHome: true });

  if (opts.href) {
    // A forced target that IS the current view would loop → Home instead.
    if (sameTarget(opts.href, hereRel)) return home();
    const match = !!prev && sameTarget(prev.href, opts.href);
    return {
      href: opts.href,
      label: opts.label ?? (match ? prev!.label : t('Back')),
      useHistory: match && canGoBack(),
      isHome: false,
    };
  }
  // A known previous view always NAMES the pill and is always where it goes - 
  // including after a reload, which is why back-nav persists it to
  // sessionStorage. Only the mechanism varies: this document pushed an entry
  // (canGoBack) → pop it, so repeated backs unwind rather than pile up;
  // otherwise (reloaded straight onto this view) there's no entry of ours to
  // pop, so go forward to the same place. EXCEPT when that previous view is the
  // one we are already on (entering a view directly can record it as its own
  // previous) - a back to yourself is not a back, so escape to Home.
  if (prev && !sameTarget(prev.href, hereRel)) {
    return { href: prev.href, label: opts.label ?? prev.label, useHistory: canGoBack(), isHome: false };
  }
  // No previous view (or it loops to here) - a direct visit / fresh session (a
  // shared /t/<id> link, a reloaded editor). The only honest answer is Home.
  return home();
}

/** The pill's markup. `data-back-pill` carries the mode so mountBackPill()
 *  doesn't have to re-resolve (and possibly disagree with) the render. */
export function backPillHtml(opts: BackPillOpts = {}): string {
  const target = resolveBackTarget(opts);
  const cls = opts.class ?? 'home-full';
  const mode = target.useHistory ? 'history' : 'link';
  // A house glyph when the pill is the front-door escape (no real back / a back
  // that would loop to this same view); the back arrow otherwise.
  const glyph = target.isHome ? 'home' : 'arrowLeft';
  const arrow = `<span class="back-pill-icon" aria-hidden="true">${icon(glyph, { size: 18 })}</span>`;
  if (opts.iconOnly) {
    const aria = target.isHome ? target.label : tRaw('Back to {view}', { view: target.label });
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - resolveBackTarget() returns only an origin-relative in-app route (back-nav toRelative(), the '/#/p…' returnTo marker, or the '/#/' literal)
    return `<a href="${escape(target.href)}" class="${cls}" data-back-pill="${mode}" aria-label="${escape(aria)}">${arrow}</a>`;
  }
  // A pill that is ALREADY the way out: the front-door escape (isHome), or a back
  // target that happens to BE Home - arriving from the gallery names the pill with
  // the same t('Home') label (lib/back-nav.ts labelFor). mountBackPill() reads this
  // rather than re-resolving, so the render can't disagree with the mount.
  const atHome = target.isHome || target.label === t('Home') ? ' data-back-home' : '';
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - same resolveBackTarget() origin-relative route as above
  return `<a href="${escape(target.href)}" class="tools-home${cls ? ` ${cls}` : ''}" data-back-pill="${mode}"${atHome}>${arrow}<span class="back-pill-label">${escape(target.label)}</span></a>`;
}

/** The top-LEFT chrome island: the back pill with the always-Home FAB immediately
 *  to its right, both in the shared glass family (components.css `.tools-home` +
 *  topbar.css `.home-fab`) so they read as one level row - the mirror of the
 *  top-right `.gallery-topright` cluster. `.chrome-topleft` (overrides.css) pins
 *  the row and neutralises the pill's own fixed positioning. No extra wiring: a
 *  view's existing mountBackPill()+mountHomeFab() both scan the whole root, so the
 *  pill and the FAB here are wired by the calls the view already makes. */
export function backHomeHtml(opts: BackPillOpts = {}): string {
  return `<div class="chrome-topleft">${backPillHtml(opts)}${homeFabHtml()}</div>`;
}

export interface MountBackPillOpts {
  /**
   * Give the view first refusal on the click - for unsaved-work dialogs. Return
   * true to say "I've taken it" (the pill does nothing further); call the
   * supplied `go()` when the user has confirmed. Return false/undefined to let
   * the pill navigate normally.
   */
  intercept?: (go: () => void) => boolean | undefined;
}

/** Perform the back step for an already-rendered pill. */
function leave(el: HTMLElement): void {
  if (el.dataset.backPill === 'history' && window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateTo(el.getAttribute('href') || HOME_HREF);
}

/**
 * Put the always-Home FAB beside a back pill that names somewhere other than
 * Home. Tool → tool is the case that needs it: both tools' pills name the OTHER
 * tool, and the tool view paints no global nav, so after one hop nothing in the
 * chrome points at the front door. The FAB never consults history, so a chain of
 * any length keeps one exit.
 *
 * One Home per view: skipped when the pill already IS the way home
 * (data-back-home) and when the view renders its own FAB (backHomeHtml, #/start,
 * the Colour Lab). Only the two TOOL-CHROME pill variants take one - the fixed
 * corner pill and the sidebar back row; the in-flow pills ('start-back',
 * 'me-back', the #/components specimen) sit in headers that own their own layout.
 *
 * At mount rather than in backPillHtml() because "does this view already have a
 * Home?" is a question about the rendered DOM, not about the pill.
 */
function addHomeEscape(root: HTMLElement, pill: HTMLElement, opts: MountBackPillOpts): void {
  if (pill.hasAttribute('data-back-home') || root.querySelector('[data-home-fab]')) return;
  const corner = pill.classList.contains('home-full');
  if (!corner && !pill.classList.contains('sidebar-back')) return;
  const fab = homeFabEl({ intercept: opts.intercept });
  if (!corner) { pill.after(fab); return; }
  // The corner pill pins ITSELF (position: fixed, tool.css .tools-home.home-full),
  // so a sibling would land in flow. Hand the pinning to the .chrome-topleft island
  // instead - the same row backHomeHtml() renders, and the one place that resets the
  // pill's own fixed positioning (overrides.css).
  const cluster = document.createElement('div');
  cluster.className = 'chrome-topleft';
  pill.replaceWith(cluster);
  cluster.append(pill, fab);
}

/** Wire every back pill inside `root`. Idempotent per element - safe to call
 *  after a re-render that replaced the markup. */
export function mountBackPill(root: HTMLElement, opts: MountBackPillOpts = {}): void {
  root.querySelectorAll<HTMLElement>('[data-back-pill]').forEach(el => {
    el.addEventListener('click', e => {
      // Let the browser handle modified clicks (new tab / new window) - that's
      // what keeping a real href is for.
      const me = e as MouseEvent;
      if (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey || me.button > 0) return;
      e.preventDefault();
      // The go() handed to an intercept navigates by HREF, never history.back(). An
      // intercept always shows an unsaved-changes dialog first, and mountModal pushes a
      // SAME-URL history entry for system-Back to consume. A history.back() from inside
      // that flow pops the DIALOG's entry - same URL, so no route change - and the tool
      // never leaves ("Leave without saving does nothing", seen only when the pill was in
      // history mode, i.e. you navigated INTO the tool). navigateTo moves the URL, which is
      // exactly the signal mountModal.consume() watches to leave its own entry alone.
      if (opts.intercept) {
        const goByHref = (): void => navigateTo(el.getAttribute('href') || HOME_HREF);
        if (opts.intercept(goByHref)) return;
      }
      // No intercept, or it declined (no unsaved work): the plain, history-aware back step.
      leave(el);
    });
    addHomeEscape(root, el, opts);
  });
}
