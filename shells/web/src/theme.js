/**
 * Theme management — light / dark / suse.
 *
 * Applied via [data-theme] on <html>. An inline script in index.html applies
 * the saved preference from localStorage before CSS loads to prevent FOUC.
 * The profile is the canonical store; localStorage is only kept in sync so
 * the FOUC script has something to read on the next cold load.
 */

export const THEMES = ['light', 'dark', 'suse'];

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
}

/** Called at module boot — applies the localStorage value before the profile loads. */
export function initTheme() {
  const saved = localStorage.getItem('theme') ?? 'light';
  applyTheme(saved, false);
}
