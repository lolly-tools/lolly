// SPDX-License-Identifier: MPL-2.0
/**
 * Theme cycle toggle - one compact, icon-only button that steps through the
 * themes (light → dark → brand → …) on click, showing the active theme's glyph.
 * It lives in the canvas zoom HUD (.stage-nav) so every tool with a live canvas
 * - including the chromeless editor/Design - carries a theme switcher,
 * and the sidebar header stays uncluttered.
 *
 * Icon-only with a tooltip (title + aria-label carry the theme name), styled as
 * a .stage-nav-btn so it matches the zoom controls it sits with (see
 * .stage-nav-theme in editor.css).
 *
 * The profile is the canonical theme store (localStorage is only the FOUC mirror,
 * kept in sync by applyTheme), so each switch is persisted there too - mirroring
 * the profile view's segmented control.
 *
 * createThemeToggle(host, opts?) → HTMLButtonElement
 *
 * `opts.className` exists because the `.stage-nav-*` presentation lives in
 * editor.css, which only the editor routes load. A view that wants the same
 * icon-only cycle without pulling the whole editor chrome in (Colour Lab, whose
 * users switch theme to see a colour in each screen context) passes its own class
 * and styles it locally - the cycling, the sting and the profile write are the
 * parts worth sharing, not the skin.
 */
import { THEMES, THEME_LABELS, THEME_ICONS, nextTheme, currentTheme } from '../theme.ts';
import { setTheme, type SetThemeHost as ThemeToggleHost } from '../lib/set-theme.ts';
import { t, tRaw } from '../i18n.ts';
import { segHtml } from '../lib/seg.ts';

export function createThemeToggle(
  host: ThemeToggleHost,
  opts: { className?: string } = {},
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  // Rides the zoom HUD's button idiom; stage-nav-theme handles its ordering /
  // separator within the capsule. No data-nav attr, so the HUD's zoom click
  // delegation ignores it and only this button's own handler fires.
  btn.className = opts.className ?? 'stage-nav-btn stage-nav-theme';

  // Widened views: the stored theme is an arbitrary string until validated.
  const icons: Record<string, string> = THEME_ICONS;
  const labels: Record<string, string> = THEME_LABELS;
  const paint = (theme: string) => {
    btn.dataset.theme = theme;
    btn.innerHTML = icons[theme] ?? '';
    const label = tRaw('Theme: {name} - switch theme', { name: t(labels[theme] ?? theme) });
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  paint(currentTheme());

  btn.addEventListener('click', async () => {
    const theme = nextTheme(currentTheme());
    paint(theme);
    await setTheme(host, theme);
  });

  return btn;
}

/**
 * Append the theme-cycle FAB (skinned `.theme-fab`, topbar.css) to a view's
 * fixed top-right cluster - the shared way the nav-less views (#/start,
 * Dashboard, Verify, Convert, Spreadsheet, PDF, Script) expose light/dark/brand
 * beside the home + language FABs, wherever there's real estate for it. A no-op
 * when the cluster isn't present, so a view that skips the row (or a loading
 * branch that has no cluster yet) simply doesn't get one.
 */
export function mountThemeFab(cluster: Element | null, host: ThemeToggleHost): void {
  if (cluster) cluster.appendChild(createThemeToggle(host, { className: 'theme-fab' }));
}

/**
 * The theme picker as a segmented control (Light / Dark / Brand) for a view-settings
 * popover - matching the `.view-seg` controls those popovers already carry (the gallery's
 * "Featured view", the catalog's "Favourites"). Returned as an HTML string so it drops
 * straight into the popover markup; wire the clicks with wireThemeSegment() once it's in
 * the DOM. `headClass` styles the section label to match the host popover: `filter-pop-head`
 * for the gallery/catalog popovers, `folder-menu-head` for the Projects view-opts menu.
 */
export function themeSegmentHtml(headClass = 'filter-pop-head'): string {
  const cur = currentTheme();
  // The shared segmented-control primitive (lib/seg.ts). `attr` stamps this control's
  // own `data-theme-seg` value-hook - which wireThemeSegment() keys off - alongside the
  // canonical `data-val`, so no markup fork is needed for it.
  return `<p class="${headClass}">${t('Theme')}</p>
      ${segHtml('theme', THEMES.map(th => ({ id: th, label: t(THEME_LABELS[th]) })), cur, t('Theme'), { attr: 'data-theme-seg' })}`;
}

/**
 * Wire a themeSegmentHtml() block within `root`: each button applies + persists its theme
 * (profile is canonical; applyTheme mirrors to localStorage + updates the PWA chrome colour)
 * and flips the pressed state in place. stopPropagation keeps the host popover from treating
 * the click as a select/dismiss. Call once after the popover is in the DOM.
 */
export function wireThemeSegment(root: ParentNode, host: ThemeToggleHost): void {
  const btns = [...root.querySelectorAll<HTMLButtonElement>('[data-theme-seg]')];
  btns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const theme = btn.dataset.themeSeg!;
      btns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      await setTheme(host, theme);
    });
  });
}
