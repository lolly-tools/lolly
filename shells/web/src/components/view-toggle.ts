// SPDX-License-Identifier: MPL-2.0
/**
 * The Tools | Utilities | Catalog | Projects switch shown atop the gallery, the
 * utilities view, the projects view and the catalog view. Two coordinated forms:
 *
 * - Native links (`viewToggle()`, rendered by every listing view's topbar):
 *   pure markup - real hash links (`#` tools, `#/u` utilities, `#/p` projects,
 *   `#/c` catalog), so the router's hashchange listener handles navigation; no
 *   JS wiring. Desktop shows icon+label; on mobile the label hides and the
 *   toggle shrinks to icons (topbar.css). The Utilities tab only renders while
 *   the 'Offline Utilities' feature flag is on - the same flag that gates the
 *   `#/u` route itself (main.ts redirects to the gallery when it's off).
 *
 * - Jelly pill (`syncJellyNavToggle()`, Jelly effects flag on, web desktop only):
 *   ONE persistent <jelly-segmented> mounted at body level, ABOVE the
 *   view-fade overlay. It is deliberately NOT part of any view's markup: the
 *   cross-view fade snapshots the outgoing view by MOVING its live nodes, and a
 *   jelly control in that snapshot keeps animating - the pill slid in the dying
 *   copy while the incoming view mounted its own already-parked copy, reading
 *   as a double animation. Hoisted, there is exactly one control; its pill
 *   slides once, continuously, while the views cross-fade beneath it. While the
 *   jelly pill is shown, `:root[data-jelly-nav]` hides the per-view native
 *   toggle on desktop; mobile always keeps the native icons. Desktop icons
 *   (Andy, 2026-08-20: the tabs must be identifiable by glyph on BOTH form
 *   factors): jelly-segment labels are textContent-only and the vendored
 *   bundle is refresh-pinned, so the glyphs are injected into the OPEN shadow
 *   root from here - see injectJellyIcons below.
 *
 * Tauri deliberately keeps the native form. The Jelly segmented control paints
 * beyond its host on a transparent canvas; macOS WKWebView has intermittently
 * composited that overflow as an opaque, oversized layer and exposed the
 * component's hidden sizing clone as a second label. The native links already
 * provide the same destinations, icon+label affordance, keyboard semantics and
 * responsive layout without relying on that WebKit compositing path.
 *
 * `active` is 'tools', 'utilities', 'projects' or 'catalog'.
 */
import { flagEnabledSync } from '../feature-flags.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { jellyActive } from '../lib/jelly.ts';
import { playSfx } from '../lib/sfx.ts';
import { escape } from '../utils.ts';

export type ViewToggleKey = 'tools' | 'utilities' | 'projects' | 'catalog';

/** The feature flag that shows/hides the Utilities view (tab + `#/u` route).
 *  The id predates the view (it used to hide the gallery's utilities section)
 *  and is a persisted key - it stays 'cat-developer'. */
export const UTILITIES_FLAG_ID = 'cat-developer';

// Glyphs - hammer (Tools) and a lightning bolt (Utilities), Andy 2026-08-20:
// the hammer reads as "build things", the bolt as "quick powered actions" -
// plus folder (Projects) and layout-grid (Catalog).
const ICONS: Record<ViewToggleKey, string> = {
  tools: icon('hammer'),
  utilities: icon('zap'),
  projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  catalog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
};

// key → hash target. The jelly segments carry these as their submitted values,
// so the persistent control's change handler is just `location.hash = value`.
export const VIEW_TOGGLE_HREFS: Record<ViewToggleKey, string> = {
  tools: '#',
  utilities: '#/u',
  projects: '#/p',
  catalog: '#/c',
};

// Tab order maps the journey start-to-end: Tools (discovery) leads, Projects
// (the major work) closes; Utilities and Catalog sit between. Logical order,
// so RTL locales mirror it for free.
const KEYS: readonly ViewToggleKey[] = ['tools', 'utilities', 'catalog', 'projects'];

const LABELS: Record<ViewToggleKey, string> = {
  tools: 'Tools',
  utilities: 'Utilities',
  projects: 'Projects',
  catalog: 'Catalogue',
};

/** The tabs currently on offer - Utilities drops out with its feature flag. */
function activeKeys(): ViewToggleKey[] {
  return KEYS.filter(k => k !== 'utilities' || flagEnabledSync(UTILITIES_FLAG_ID));
}

export function viewToggle(active: ViewToggleKey): string {
  const opt = (key: ViewToggleKey, href: string, label: string) =>
    `<a href="${href}" class="view-toggle-opt${active === key ? ' is-active' : ''}"` +
    // The active tab is a no-op navigation → stays silent; the others play the "navigate"
    // swish (data-sfx is read by the app-wide sfx delegation in lib/sfx.ts).
    `${active === key ? ' aria-current="page"' : ' data-sfx="navigate"'} data-vt="${key}" aria-label="${escape(label)}">` +
    `<span class="view-toggle-ic" aria-hidden="true">${ICONS[key]}</span>` +
    `<span class="view-toggle-label">${escape(label)}</span>` +
    `</a>`;
  return `
    <nav class="view-toggle" aria-label="${escape(t('Switch between tools, utilities, projects and catalog'))}">
      ${activeKeys().map(k => opt(k, VIEW_TOGGLE_HREFS[k], t(LABELS[k]))).join('\n      ')}
    </nav>`;
}

// ── The persistent jelly pill ────────────────────────────────────────────────

let jellyNav: HTMLElement | null = null;
let jellyIconsObserver: MutationObserver | null = null;

/** The canvas-backed segmented control is a web enhancement, not shell chrome.
 *  Tauri uses its native HTML/CSS equivalent to avoid WKWebView canvas overflow
 *  and shadow-DOM clone compositing regressions. Exported to pin that platform
 *  boundary in a small DOM test without loading the Jelly animation bundle. */
export function jellyNavSupportedInCurrentShell(): boolean {
  return !isTauriShell();
}

/**
 * Put the tab glyphs INTO the jelly pill's shadow buttons. The vendored
 * jelly-segmented rebuilds its shadow markup from each segment's textContent
 * (HTML-escaped), and jelly.mjs must not be hand-edited - so the icons are
 * prepended from outside into the open shadow root instead: once into the
 * visible label span and once into the squish clone under it, so the physics
 * copy matches. Idempotent (guarded by the .vt-jelly-ic marker); the caller's
 * MutationObserver re-runs it after every internal rebuild, since sync()
 * wipes the wrap whenever the value or a segment attribute changes.
 */
function injectJellyIcons(seg: HTMLElement, keys: readonly ViewToggleKey[]): void {
  const buttons = seg.shadowRoot?.querySelectorAll<HTMLElement>('button.segment');
  if (!buttons?.length) return;
  buttons.forEach((btn, i) => {
    const key = keys[i];
    if (!key || btn.querySelector('.vt-jelly-ic')) return;
    for (const span of btn.querySelectorAll(':scope > .segment-top > span')) {
      const ic = document.createElement('span');
      ic.className = 'vt-jelly-ic';
      ic.setAttribute('aria-hidden', 'true');
      // Inline styles: page CSS cannot reach the vendored shadow tree.
      ic.style.cssText = 'display:inline-flex;align-items:center;vertical-align:-0.18em;margin-inline-end:0.4em';
      ic.innerHTML = ICONS[key]; // trusted registry glyphs only - never user text
      for (const svg of ic.querySelectorAll('svg')) { svg.setAttribute('width', '15'); svg.setAttribute('height', '15'); }
      span.prepend(ic);
    }
  });
}

function segmentsHtml(keys: ViewToggleKey[]): string {
  return keys.map(k => `<jelly-segment value="${VIEW_TOGGLE_HREFS[k]}">${escape(t(LABELS[k]))}</jelly-segment>`).join('');
}

/**
 * Reconcile the persistent jelly tab pill with the current route. Call after
 * every route mount: a listing view's key shows it (mounting once, then just
 * steering `value` so the pill SLIDES from the previous tab), `null` (tool,
 * profile, dashboard…) hides it. No-op - and cleans up - when the Jelly flag
 * is off or the bundle isn't loaded yet.
 */
export function syncJellyNavToggle(active: ViewToggleKey | null): void {
  if (!active || !jellyActive() || !jellyNavSupportedInCurrentShell()) {
    jellyNav?.setAttribute('hidden', '');
    document.documentElement.removeAttribute('data-jelly-nav');
    return;
  }
  const keys = activeKeys();
  if (!jellyNav) {
    jellyNav = document.createElement('div');
    jellyNav.className = 'jelly-nav-wrap';
    document.body.appendChild(jellyNav);
    jellyNav.addEventListener('change', (e) => {
      if (!(e.target instanceof Element) || e.target.tagName !== 'JELLY-SEGMENTED') return;
      const value = (e as CustomEvent<{ value?: string }>).detail?.value;
      if (!value || (location.hash || '#') === value) return;
      playSfx('navigate');
      // Navigate immediately - this control survives the route swap, so the
      // pill's slide plays out across it with no handoff.
      location.hash = value === '#' ? '' : value;
    });
  }
  // (Re)build the segments only when the tab set changes (the Utilities flag),
  // so ordinary route syncs never reset the physics state mid-slide.
  if (jellyNav.dataset.keys !== keys.join()) {
    jellyNav.dataset.keys = keys.join();
    // height inline (not in CSS): the component's shadow `:host{height:44px}` +
    // the wrapper's 3px padding made the pill taller than the sibling icon FABs
    // (2.9em). 2.5rem host + the 3px rim ≈ 46px, matching them. Inline so it can't
    // lose the cascade to the shadow default; the tab paddings ride in projects.css.
    jellyNav.innerHTML = `<jelly-segmented class="view-toggle-seg" style="height:2.5rem" value="${VIEW_TOGGLE_HREFS[active]}" label="${escape(t('Switch between tools, utilities, projects and catalog'))}">${segmentsHtml(keys)}</jelly-segmented>`;
  } else {
    // Steering the value attribute re-syncs the control and the pill ANIMATES
    // from wherever it is - including a route change driven by the native
    // mobile links, the back button, or a deep link.
    jellyNav.querySelector('jelly-segmented')?.setAttribute('value', VIEW_TOGGLE_HREFS[active]);
  }
  jellyNav.removeAttribute('hidden');
  document.documentElement.setAttribute('data-jelly-nav', '');
  // Glyphs next to the labels (see injectJellyIcons). Re-observe each sync:
  // a tab-set rebuild replaces the whole <jelly-segmented> node.
  const seg = jellyNav.querySelector<HTMLElement>('jelly-segmented');
  if (seg) wireJellyIcons(seg, keys);
}

/** Inject now and keep injecting across the component's internal rebuilds. The
 *  shadow root appears in the vendor's connectedCallback, which can land a
 *  frame after our innerHTML assignment - hence the short rAF retry. */
function wireJellyIcons(seg: HTMLElement, keys: readonly ViewToggleKey[], attempt = 0): void {
  if (!seg.isConnected) return;
  if (!seg.shadowRoot) {
    if (attempt < 5) requestAnimationFrame(() => wireJellyIcons(seg, keys, attempt + 1));
    return;
  }
  injectJellyIcons(seg, keys);
  jellyIconsObserver?.disconnect();
  jellyIconsObserver = new MutationObserver(() => injectJellyIcons(seg, keys));
  jellyIconsObserver.observe(seg.shadowRoot, { childList: true, subtree: true });
}
