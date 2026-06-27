// SPDX-License-Identifier: MPL-2.0
/**
 * Theme management — light / dark / suse.
 *
 * Applied via [data-theme] on <html>. An inline script in index.html applies
 * the saved preference from localStorage before CSS loads to prevent FOUC.
 * The profile is the canonical store; localStorage is only kept in sync so
 * the FOUC script has something to read on the next cold load.
 */

export const THEMES = ['light', 'dark', 'suse'];

// Per-theme address-bar / PWA chrome colour, matching each theme's page
// background (tokens.css --background). Keeps mobile/PWA chrome in step with the
// active theme instead of pinning it to the SUSE dark-green.
const THEME_COLORS = {
  light: '#ffffff',
  dark: '#030711',  // 224 71% 4%
  suse: '#0c322c',  // 171 62% 12% (Pine)
};

/**
 * Apply a theme, persist it to localStorage (for FOUC prevention), and
 * optionally animate the colour transition.
 */
export function applyTheme(theme, animate = true) {
  const html = document.documentElement;

  if (animate) {
    html.classList.add('theme-transitioning');
    setTimeout(() => html.classList.remove('theme-transitioning'), 220);
  }

  html.dataset.theme = theme;
  localStorage.setItem('theme', theme);

  // Keep the browser/PWA chrome colour in step with the theme.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && THEME_COLORS[theme]) meta.content = THEME_COLORS[theme];
}

/** Called at module boot — applies the localStorage value before the profile loads. */
export function initTheme() {
  // No saved preference yet: seed from the OS colour scheme so a dark-OS visitor
  // doesn't get a light flash. (A full "System" theme option is out of scope —
  // this only sets the initial value.) The inline FOUC script in index.html
  // mirrors this seed so there's no flash before this module runs.
  const saved = localStorage.getItem('theme')
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved, false);
}
