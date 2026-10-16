// SPDX-License-Identifier: MPL-2.0
/**
 * The browser and PWA chrome colour (`<meta name="theme-color">`), kept on the
 * page colour in force.
 *
 * Three things move the page: a theme change (theme.ts), a design system's
 * chrome painted at runtime (brand-vars.ts) and High contrast, which sets a
 * pack's light and dark room aside for Lolly's own (lib/a11y-prefs.ts). Each
 * calls syncThemeColorMeta once its change is in place.
 *
 * A leaf module with no imports: brand-vars.ts reaches bundles that only want
 * its colour helpers (the Rondo editor frame reads the palette through it), and
 * importing theme.ts there would carry its icons, Jelly and feature flags along.
 */

/** Per-theme page colour (tokens.css --background), for the moments before CSS
 *  applies. */
const THEME_COLORS: Readonly<Record<string, string>> = {
  light: '#ffffff',
  dark: '#030711',   // 224 71% 4%
  brand: '#0c322c',  // the static (SUSE-palette) construction's background
};

/**
 * Set `<meta name="theme-color">` to the page colour now in force. Prefers the
 * LIVE --background triple, because the brand theme and a design pack's own
 * chrome are painted at runtime and High contrast can take a pack's page away,
 * none of which the static map can know; the map covers the moments before CSS.
 * Harmless without a document that can be queried (a test host's stand-in may
 * carry only documentElement), a meta element or getComputedStyle.
 */
export function syncThemeColorMeta(): void {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const html = document.documentElement;
  const triple = typeof getComputedStyle === 'function' ? getComputedStyle(html).getPropertyValue('--background').trim() : '';
  const fallback = THEME_COLORS[html.dataset.theme || 'light'];
  if (triple) meta.content = `hsl(${triple})`;
  else if (fallback) meta.content = fallback;
}
