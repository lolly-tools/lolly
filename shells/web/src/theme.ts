// SPDX-License-Identifier: MPL-2.0
/**
 * Theme management - light / dark / brand.
 *
 * Applied via [data-theme] on <html>. An inline script in index.html applies
 * the saved preference from localStorage before CSS loads to prevent FOUC.
 * The profile is the canonical store; localStorage is only kept in sync so
 * the FOUC script has something to read on the next cold load.
 *
 * 'brand' (2026-07-09) replaces the retired 'suse' theme: the mid-toned
 * colored chrome, constructed at runtime from the active brand's palette
 * (brand-vars.ts brandThemeCss) with the SUSE construction as its static
 * default in tokens.css. Stored 'suse' values migrate on apply.
 */

import { syncJellyMode } from './lib/jelly.ts';

export type Theme = 'light' | 'dark' | 'brand';

export const THEMES: readonly Theme[] = ['light', 'dark', 'brand'];

export const THEME_LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', brand: 'Brand' };

// One compact glyph per theme (Lucide house style, 16px, currentColor). Distinct
// enough to read at a glance when the toggle reduces to icon-only: sun / crescent
// moon / a painter's palette for the brand theme.
export const THEME_ICONS: Record<Theme, string> = {
  light: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  dark:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  brand: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 22z"/><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/></svg>`,
};

/** The next theme in the cycle (wraps light → dark → brand → light). */
export function nextTheme(theme: string): Theme {
  const i = THEMES.indexOf(theme as Theme);
  return THEMES[(i + 1) % THEMES.length] ?? THEMES[0]!;
}

/** The active theme - from the applied [data-theme], falling back to storage. */
export function currentTheme(): string {
  return document.documentElement.dataset.theme || localStorage.getItem('theme') || 'light';
}

// Per-theme address-bar / PWA chrome colour, matching each theme's page
// background (tokens.css --background). Keeps mobile/PWA chrome in step with the
// active theme instead of pinning it to the SUSE dark-green.
const THEME_COLORS: Record<string, string> = {
  light: '#ffffff',
  dark: '#030711',   // 224 71% 4%
  brand: '#0c322c',  // the static (SUSE-palette) construction's background
};

// Handle for the transition-class cleanup timer. Module-scoped so rapid theme
// switches clear the pending timeout instead of letting an earlier one fire early
// and cut the current transition short.
let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Apply a theme, persist it to localStorage (for FOUC prevention), and
 * optionally animate the colour transition.
 */
export function applyTheme(theme: string, animate = true): void {
  const html = document.documentElement;
  // Migrate the retired theme name wherever it's still stored (old profiles,
  // old localStorage) - the CSS block and the cycle only know 'brand' now.
  if (theme === 'suse') theme = 'brand';

  if (animate) {
    html.classList.add('theme-transitioning');
    clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(() => html.classList.remove('theme-transitioning'), 220);
  }

  html.dataset.theme = theme;
  localStorage.setItem('theme', theme);

  // Keep the browser/PWA chrome colour in step with the theme. Prefer the LIVE
  // --background triple (the brand theme is constructed at runtime, so the
  // static map can't know its surface); the map covers pre-CSS edge cases.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    const triple = getComputedStyle(html).getPropertyValue('--background').trim();
    const fallback = THEME_COLORS[theme];
    if (triple) meta.content = `hsl(${triple})`;
    else if (fallback) meta.content = fallback;
  }

  // Keep the browser-tab favicon in step with the app theme (dark/brand wear the
  // reverse mark). Setting the href in JS follows the in-app toggle live - the
  // <link media> pair this replaced only tracked the OS scheme and needed a reload.
  const favicon = document.getElementById('favicon-svg') as HTMLLinkElement | null;
  if (favicon) favicon.href = theme === 'light' ? '/icon.svg' : '/icon-reverse.svg';

  // Keep the Jelly effects controls (lib/jelly.ts) in step: pin their light/dark
  // token defaults to the app theme rather than the OS scheme, and wake settled
  // canvases - an idle jelly control only repaints on this event, so a theme swap
  // would otherwise leave it painted in the old palette. Both are inert no-ops
  // while the jelly bundle isn't loaded (attribute + unheard event).
  syncJellyMode(theme);
  window.dispatchEvent(new CustomEvent('jelly-theme-change'));
}

// The values `?theme=` will honour. A Set, not an object lookup: an object answers
// true for 'constructor' and every other inherited key (see lib/design-system/
// start-route.ts). Anything else is silently ignored.
const THEME_VALUES = new Set<string>(THEMES);

/** Every address that names a TOOL: the hash form, the canonical /t/<id> path form,
 *  and Design's /design vanity path (parseRoute in main.ts returns all three as tool
 *  routes). Matched against the hash path when there is one, else the pathname. */
const TOOL_ADDRESS = /^\/?(tool\/|t\/|design$)/;

/**
 * A `?theme=` override carried on the URL, or null.
 *
 * Session-only by contract: the caller stamps [data-theme] for THIS page load and
 * NEVER persists it, so a pasted link or a screenshot run can pin the look without
 * flipping the reader's own stored preference. Read from the hash query AND
 * location.search, because the app's views arrive both ways - the same dual read
 * main.ts's peekUrlLang does for `lang`.
 *
 * NOT honoured on a tool address. Unlike `lang`, `theme` is not engine-reserved, and
 * it is a real declared INPUT id in a dozen shipping tools (quotes, snippet,
 * street-map, deck-builder, …). On a tool link `?theme=dark` already means "draw the
 * artwork dark", and it has meant that in every share link ever generated; making it
 * ALSO repaint the app chrome would silently change what those links do. So this is an
 * app-view param only, and the collision never arises.
 */
export function urlThemeOverride(): Theme | null {
  const [hashPath, hashQuery = ''] = window.location.hash.slice(1).split('?');
  if (TOOL_ADDRESS.test(hashPath || window.location.pathname)) return null;
  const v = new URLSearchParams(hashQuery).get('theme')
    ?? new URLSearchParams(window.location.search).get('theme');
  return v && THEME_VALUES.has(v) ? (v as Theme) : null;
}

/** Called at module boot - applies the localStorage value before the profile loads. */
export function initTheme(): void {
  // No saved preference yet: seed from the OS colour scheme so a dark-OS visitor
  // doesn't get a light flash. (A full "System" theme option is out of scope - 
  // this only sets the initial value.) The inline FOUC script in index.html
  // mirrors this seed so there's no flash before this module runs.
  const saved = localStorage.getItem('theme')
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved, false);
}
