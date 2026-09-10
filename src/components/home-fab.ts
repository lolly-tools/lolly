// SPDX-License-Identifier: MPL-2.0
/**
 * The always-home FAB - a history-INDEPENDENT escape to the front door (Tools).
 *
 * The nav-less "focused" views (#/start, Dashboard, Profile, Verify) paint no
 * global nav of their own; their only other exit is the back pill. The pill
 * answers "where did I come from" and rides history; this answers "just get me
 * out" and never consults the back stack - so a view reached mid-session, after
 * a few hops, is never a one-way trip regardless of what sits behind it. (The
 * pill still traps nobody on its own now that within-view navigations replace
 * rather than push - see components/back-pill.ts - but a guaranteed, history-free
 * Home is the belt to that braces, and the same affordance on every nav-less
 * view reads as one consistent way out.)
 *
 * Sits in the fixed top-right cluster (.gallery-topright / .plat-header) beside
 * the language FAB and wears the same glass (buttons.css) + glow (overrides.css);
 * the box is `.home-fab` (topbar.css). homeFabHtml() renders the trigger,
 * mountHomeFab(root) wires it - mirrors langFabHtml()/attachLangMenu() so the
 * cluster stays "one of the set". homeFabEl() is the same control as a ready-wired
 * ELEMENT, for views that build their DOM with createElement rather than an
 * innerHTML template (the collab ceremony routes) and so have no free sink to
 * ride.
 */
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import { navigateTo } from '../nav.ts';

export interface MountHomeFabOpts {
  /** Take over the click while unsaved work is resolved; call go() to leave. */
  intercept?: (go: () => void) => boolean | undefined;
}

/** The one home step: front door, history-free, unless the click is modified
 *  (new tab / new window), which is what keeping a real href is for. */
function goHomeOnClick(e: MouseEvent, opts: MountHomeFabOpts): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
  e.preventDefault();
  const go = (): void => navigateTo('/#/');
  if (opts.intercept?.(go)) return;
  go();
}

/** The trigger markup - drop directly into a .gallery-topright / .plat-header
 *  cluster, conventionally BEFORE the language FAB. A real href so middle-click
 *  and copy-link work; the click is intercepted for SPA navigation.
 *
 *  `className` overrides the default `.home-fab` glass skin for views that carry
 *  their own top-right button idiom (Ask's `.ask-top-btn`, the Colour Lab's
 *  `.lab-chrome-btn`), so the escape sits in the cluster as one of that view's
 *  set. mountHomeFab() keys off `[data-home-fab]`, so wiring is class-agnostic. */
export function homeFabHtml(opts: { className?: string } = {}): string {
  const cls = opts.className ?? 'home-fab';
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - the href is the literal in-app front-door route '/#/', never user input
  return `<a href="/#/" class="${escape(cls)}" data-home-fab aria-label="${escape(t('Home'))}" title="${escape(t('Home'))}">${icon('home')}</a>`;
}

/** Wire every home FAB inside `root`. Call once per mount (like mountBackPill /
 *  attachLangMenu); a re-render that replaces the markup gets re-wired on its
 *  own mount. */
export function mountHomeFab(root: HTMLElement, opts: MountHomeFabOpts = {}): void {
  root.querySelectorAll<HTMLElement>('[data-home-fab]').forEach(el => {
    el.addEventListener('click', e => goHomeOnClick(e as MouseEvent, opts));
  });
}

/** The home FAB as a ready-wired anchor ELEMENT - for DOM-built views (the collab
 *  ceremony routes) that have no innerHTML template to drop homeFabHtml() into.
 *  Same skin, same behaviour; the ONE icon-injection sink here is a constant
 *  lib/icons glyph, never user input (mirrors createThemeToggle/createSoundToggle,
 *  and is why this file carries a raw-HTML-sink allowlist entry of 1). */
export function homeFabEl(opts: { className?: string } & MountHomeFabOpts = {}): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = opts.className ?? 'home-fab';
  a.setAttribute('href', '/#/');
  a.setAttribute('data-home-fab', '');
  const label = t('Home');
  a.setAttribute('aria-label', label);
  a.title = label;
  a.innerHTML = icon('home');
  a.addEventListener('click', e => goHomeOnClick(e as MouseEvent, opts));
  return a;
}
