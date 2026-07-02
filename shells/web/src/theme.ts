// SPDX-License-Identifier: MPL-2.0
/**
 * Theme management — light / dark / suse.
 *
 * Applied via [data-theme] on <html>. An inline script in index.html applies
 * the saved preference from localStorage before CSS loads to prevent FOUC.
 * The profile is the canonical store; localStorage is only kept in sync so
 * the FOUC script has something to read on the next cold load.
 */

export type Theme = 'light' | 'dark' | 'suse';

export const THEMES: readonly Theme[] = ['light', 'dark', 'suse'];

// Display names for the cycle toggle (brand cased — 'SUSE', not 'Suse').
export const THEME_LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', suse: 'SUSE' };

// One compact glyph per theme (Lucide house style, 16px, currentColor). Distinct
// enough to read at a glance when the toggle reduces to icon-only: sun / crescent
// moon / a droplet for the SUSE brand theme.
export const THEME_ICONS: Record<Theme, string> = {
  light: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  dark:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  suse:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
};

/** The next theme in the cycle (wraps light → dark → suse → light). */
export function nextTheme(theme: string): Theme {
  const i = THEMES.findIndex(t => t === theme);
  return THEMES[(i + 1) % THEMES.length] ?? 'light';
}

/** The active theme — from the applied [data-theme], falling back to storage. */
export function currentTheme(): string {
  return document.documentElement.dataset.theme || localStorage.getItem('theme') || 'light';
}

// Per-theme address-bar / PWA chrome colour, matching each theme's page
// background (tokens.css --background). Keeps mobile/PWA chrome in step with the
// active theme instead of pinning it to the SUSE dark-green.
const THEME_COLORS: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#030711',  // 224 71% 4%
  suse: '#0c322c',  // 171 62% 12% (Pine)
};

/**
 * Apply a theme, persist it to localStorage (for FOUC prevention), and
 * optionally animate the colour transition.
 */
export function applyTheme(theme: string, animate = true): void {
  const html = document.documentElement;

  if (animate) {
    html.classList.add('theme-transitioning');
    setTimeout(() => html.classList.remove('theme-transitioning'), 220);
  }

  html.dataset.theme = theme;
  localStorage.setItem('theme', theme);

  // Keep the browser/PWA chrome colour in step with the theme.
  const meta = document.querySelector('meta[name="theme-color"]');
  const colors: Record<string, string> = THEME_COLORS;
  const color = colors[theme];
  if (meta instanceof HTMLMetaElement && color) meta.content = color;
}

/** Called at module boot — applies the localStorage value before the profile loads. */
export function initTheme(): void {
  // No saved preference yet: seed from the OS colour scheme so a dark-OS visitor
  // doesn't get a light flash. (A full "System" theme option is out of scope —
  // this only sets the initial value.) The inline FOUC script in index.html
  // mirrors this seed so there's no flash before this module runs.
  const saved = localStorage.getItem('theme')
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved, false);
}
