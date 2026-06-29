// SPDX-License-Identifier: MPL-2.0
/**
 * Theme cycle toggle — one compact button that steps through the themes
 * (light → dark → suse → …) on click. Shows the active theme's icon + name; the
 * name is hidden by CSS when the sidebar is narrow, so it reduces to an icon to
 * save space (see .theme-toggle in app.css).
 *
 * The profile is the canonical theme store (localStorage is only the FOUC mirror,
 * kept in sync by applyTheme), so each switch is persisted there too — mirroring
 * the profile view's segmented control.
 *
 * createThemeToggle(host) → HTMLButtonElement
 */
import { THEME_LABELS, THEME_ICONS, nextTheme, currentTheme, applyTheme } from '../theme.js';

export function createThemeToggle(host) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';

  const paint = (theme) => {
    btn.dataset.theme = theme;
    btn.innerHTML = `${THEME_ICONS[theme] ?? ''}<span class="theme-toggle-name">${THEME_LABELS[theme] ?? theme}</span>`;
    const label = `Theme: ${THEME_LABELS[theme] ?? theme} — switch theme`;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  paint(currentTheme());

  btn.addEventListener('click', async () => {
    const theme = nextTheme(currentTheme());
    applyTheme(theme);
    paint(theme);
    // Persist to the profile (canonical store); best-effort — a failed write
    // still leaves the theme applied + mirrored to localStorage by applyTheme.
    try {
      const profile = await host.profile.get();
      await host.profile.set({ ...profile, theme });
    } catch { /* preference save is best-effort */ }
  });

  return btn;
}
