// SPDX-License-Identifier: MPL-2.0
/**
 * Compact, translated relative time ("3d ago"), pure and DOM-free.
 *
 * Moved down from views/picker-formats.ts (which re-exports it, so the asset picker
 * and its tests are unchanged) so that modules below views/, such as the team
 * project lists in org/, can use the same wording without importing from a view.
 */

/** Translator shape - matches i18n's `t` exactly, so the app's own function is
 *  assignable without a cast; tests pass a plain formatter with the same shape. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Compact relative time for a saved session ("3d ago").
 *
 * `now` is injected rather than read from Date.now() so the boundaries are
 * testable. An unparseable or missing timestamp yields '' - a session row with no
 * date should show nothing, not "NaN ago". A FUTURE timestamp (clock skew, a file
 * copied from another machine) clamps to 0 and reads "just now" rather than
 * counting backwards.
 */
export function relTime(iso: string | undefined, now: number, t: Translate): string {
  const ts = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ts)) return '';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return t('just now');
  const m = s / 60; if (m < 60) return t('{n}m ago', { n: Math.floor(m) });
  const h = m / 60; if (h < 24) return t('{n}h ago', { n: Math.floor(h) });
  const d = h / 24; if (d < 7) return t('{n}d ago', { n: Math.floor(d) });
  const w = d / 7; if (w < 5) return t('{n}w ago', { n: Math.floor(w) });
  const mo = d / 30; if (mo < 12) return t('{n}mo ago', { n: Math.floor(mo) });
  return t('{n}y ago', { n: Math.floor(d / 365) });
}
