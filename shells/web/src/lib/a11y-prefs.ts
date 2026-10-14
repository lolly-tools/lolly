// SPDX-License-Identifier: MPL-2.0
/**
 * Accessibility preferences - reduce motion / high contrast / large text.
 *
 * Same shape as the theme preference (theme.ts / lib/set-theme.ts): the profile
 * is the canonical store, localStorage is only the FOUC mirror the index.html
 * inline script reads before CSS paints, and the live switch is a data
 * attribute on <html> that all the gated CSS keys off:
 *
 *   data-a11y-motion="reduce" · data-a11y-contrast="high" · data-a11y-text="large"
 *   · data-a11y-previews="hidden"
 *
 * Strictly additive (the jelly-effects model): every attribute defaults to
 * ABSENT, no selector matches, and the regular experience is untouched. The
 * gated CSS lives beside the OS-preference blocks it extends - reduced motion
 * in parts/base.css, high contrast in tokens.css, large text in parts/a11y.css
 * - and, like those blocks, never reaches inside the tool render canvas: a
 * user's creative output must not change because the app chrome calmed down.
 *
 * Reduce motion also reaches Jelly UI (the jelly-effects controls), which reads
 * its own attribute, data-jelly-motion, rather than data-a11y-motion. See
 * syncJellyMotion below.
 *
 * hidePreviews ("Hide colourful previews") swaps the tool galleries to calm
 * icon + text cards (parts/gallery.css) and desaturates + lowers the contrast
 * of the Projects/session thumbnails (parts/folders.css) - the one place
 * imagery is kept, since a thumbnail you can't recognise is a thumbnail you
 * can't use. It was the gallery filter popover's device-local "Hide
 * previews" toggle before 2026-07-30; it lives here now because its audience is
 * the same one the other three serve.
 */

export interface A11yPrefs {
  reduceMotion?: boolean;
  highContrast?: boolean;
  largeText?: boolean;
  hidePreviews?: boolean;
}

/** localStorage FOUC mirror key - read by the inline script in index.html. */
export const A11Y_STORE_KEY = 'lolly-a11y';

/** Pref key → the <html> dataset property + value it switches. */
const ATTRS: Array<[keyof A11yPrefs, 'a11yMotion' | 'a11yContrast' | 'a11yText' | 'a11yPreviews', string]> = [
  ['reduceMotion', 'a11yMotion', 'reduce'],
  ['highContrast', 'a11yContrast', 'high'],
  ['largeText', 'a11yText', 'large'],
  ['hidePreviews', 'a11yPreviews', 'hidden'],
];

/** The prefs in force right now, read back from the applied attributes. */
export function currentA11yPrefs(): A11yPrefs {
  const d = document.documentElement.dataset;
  return {
    reduceMotion: d.a11yMotion === 'reduce',
    highContrast: d.a11yContrast === 'high',
    largeText: d.a11yText === 'large',
    hidePreviews: d.a11yPreviews === 'hidden',
  };
}

/**
 * Jelly UI's reduced-motion switch on <html>. vendor/jelly/jelly.mjs reads the
 * attribute on every motion check, and its shadow styles match
 * [data-jelly-motion="reduce"]. With the attribute absent, Jelly follows the OS.
 */
export const JELLY_MOTION_ATTR = 'data-jelly-motion';

/** The window event that asks every built Jelly control for a fresh frame. */
export const JELLY_MOTION_EVENT = 'jelly-motion-change';

/**
 * Pass the reduce-motion pref on to Jelly UI. The pref sets "reduce", and
 * turning the pref off removes the attribute instead of writing
 * "no-preference", so Jelly goes on following the OS setting, as it does for
 * anyone who never turned the pref on.
 *
 * A control's physics reads the attribute only when the control next runs a
 * frame, so a change also sends JELLY_MOTION_EVENT, the event Jelly's own
 * setPerformanceMode sends, and every built control repaints under the new
 * setting without a reload. Nothing is sent when the value did not change.
 * The event comes from the document's own window and Event constructor: in a
 * browser those are `window` and `Event`, while a jsdom test host keeps Node's
 * global Event, which jsdom refuses.
 */
function syncJellyMotion(reduce: boolean): void {
  const root = document.documentElement;
  const before = root.getAttribute(JELLY_MOTION_ATTR);
  if (reduce) root.setAttribute(JELLY_MOTION_ATTR, 'reduce');
  else root.removeAttribute(JELLY_MOTION_ATTR);
  const view = document.defaultView;
  if (view && root.getAttribute(JELLY_MOTION_ATTR) !== before) view.dispatchEvent(new view.Event(JELLY_MOTION_EVENT));
}

/** Apply prefs to <html> and keep the FOUC mirror in step. */
export function applyA11yPrefs(prefs: A11yPrefs | undefined): void {
  const d = document.documentElement.dataset;
  for (const [key, attr, value] of ATTRS) {
    if (prefs?.[key]) d[attr] = value;
    else delete d[attr];
  }
  syncJellyMotion(Boolean(prefs?.reduceMotion));
  try {
    const on = ATTRS.filter(([key]) => prefs?.[key]).map(([key]) => key);
    if (on.length) localStorage.setItem(A11Y_STORE_KEY, JSON.stringify(Object.fromEntries(on.map(k => [k, true]))));
    else localStorage.removeItem(A11Y_STORE_KEY);
  } catch { /* storage blocked - the attributes still applied */ }
}

/**
 * Boot reconciliation - the profile is canonical (the FOUC script already
 * applied the localStorage mirror; this corrects any drift, e.g. a restored
 * backup or a cleared cache). Mirrors main.ts's theme/sfx hydration calls.
 */
export function hydrateA11yPrefs(profileValue: A11yPrefs | undefined): void {
  // An untouched profile leaves whatever the FOUC mirror applied (never regress
  // a device-local choice mid-migration); an explicit object is authoritative.
  if (profileValue === undefined) return;
  applyA11yPrefs(profileValue);
}

/** The host slice this module persists through - same weak shape as set-theme.ts. */
export interface A11yPrefsHost {
  profile: {
    get(): Promise<object>;
    set?(profile: object): Promise<unknown>;
  };
}

/** Flip one pref: apply immediately, then best-effort persist to the profile. */
export async function setA11yPref(host: A11yPrefsHost, key: keyof A11yPrefs, on: boolean): Promise<void> {
  const next = { ...currentA11yPrefs(), [key]: on };
  applyA11yPrefs(next);
  try {
    const profile = await host.profile.get();
    await host.profile.set?.({ ...profile, a11y: next });
  } catch { /* preference save is best-effort - the attribute is already live */ }
}

/**
 * Does the user want less motion - from the OS preference OR the app pref?
 * The shared read for every JS-driven animation site (view transitions,
 * particles, carousels, the export shutter, …); the CSS side is handled by the
 * gated blocks. Safe in jsdom/tests (no matchMedia ⇒ no motion preference).
 *
 * Read it at USE time, never latched into a module constant: several call sites
 * used to do that and so answered with whatever was true at import - before boot
 * hydration had applied the profile, and permanently stale afterwards.
 *
 * matchMedia() is deliberately re-invoked per call rather than caching the
 * MediaQueryList. A MQL is live, so caching one looks free - but it narrows this
 * function's contract to implementations that return a live object, and the test
 * doubles across the web-shell suites hand back a fresh snapshot per call
 * (view-fade.test.ts is one), so a cache silently latches the first answer for
 * the process. Three rAF loops call this per frame; a media-query parse there
 * costs single-digit microseconds against work that is already doing FFT and
 * canvas painting, which is not worth a narrower contract.
 */
export function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.a11yMotion === 'reduce') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
