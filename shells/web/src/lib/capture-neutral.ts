// SPDX-License-Identifier: MPL-2.0
/**
 * Neutral capture state - the pin an automated screenshot run sets so a baseline
 * shows the app's plain chrome, never a device's own preferences.
 *
 * A published screenshot is documentation: it has to show what a reader will see,
 * and it has to be byte-stable run to run. Two things fight that. Fresh browser
 * contexts handle most of it (no localStorage ⇒ no theme, no a11y prefs), but a
 * DEFAULT is not the same as absent:
 *
 *   - Jelly effects (`jelly-effects`) default ON for an unlocked brand - which is
 *     exactly the neutral `lolly-start` profile the docs pipeline captures under.
 *     So the soft-body controls were in every baseline by default, not by choice.
 *   - The a11y prefs (reduce motion / high contrast / large text) are canonical on
 *     the PROFILE, so a seeded or restored profile can turn them on before paint.
 *
 * Seeding `localStorage` alone cannot fix the first: `hydrateFeatureFlags()`
 * REWRITES the whole flag mirror from the profile at boot, so anything written
 * before then is discarded. Hence this pin: one key, read once after hydration,
 * forcing the effect flags off and the a11y attributes clear. It only ever turns
 * things OFF - there is no state it can switch on - so it is safe for the pin to
 * be un-gated, and it is set by exactly one caller (scripts/build-docs-shots.ts's
 * CAPTURE_INIT init-script, asserted against this module by
 * tests/docs-shots-capture-state.test.ts).
 *
 * The OS-level half of the same problem (`prefers-color-scheme`,
 * `prefers-reduced-motion`, `forced-colors`) is not storage at all and is pinned
 * by the capture context itself - see CAPTURE_CONTEXT in build-docs-shots.ts.
 */

import { applyA11yPrefs } from './a11y-prefs.ts';
import { JELLY_FLAG, NEUROSPICY_FLAG, WOBBLY_FLAG, WOBBLY_MESH_FLAG, setFlagMirror } from '../feature-flags.ts';

/** localStorage key an automated capture sets (to `'1'`) before the app boots. */
export const CAPTURE_NEUTRAL_KEY = 'lolly-capture-neutral';

/** The effect flags a capture forces OFF, whatever their brand-aware default. */
export const NEUTRALISED_FLAGS: readonly string[] = [JELLY_FLAG.id, NEUROSPICY_FLAG.id, WOBBLY_FLAG.id, WOBBLY_MESH_FLAG.id];

/** Is this browser context pinned to neutral capture state? */
export function captureNeutralPinned(): boolean {
  try { return localStorage.getItem(CAPTURE_NEUTRAL_KEY) === '1'; }
  catch { return false; }
}

/**
 * Force the neutral state when pinned; a no-op otherwise. Returns whether it
 * applied, so boot can log it (a pinned run is worth seeing in the console - it
 * is the difference between "the docs shot is plain" and "the docs shot is stale").
 *
 * MUST run after `hydrateFeatureFlags()` (which rewrites the mirror) and before
 * anything reads the flags - `flagEnabledSync('neurospicy')`'s dock import and
 * `jellyEnabled()`'s bundle load both happen a few lines later in main.ts.
 */
export function applyCaptureNeutral(): boolean {
  if (!captureNeutralPinned()) return false;
  // The MIRROR only, deliberately. flagEnabledSync consults an in-memory override
  // first, and lib/neuro-demo.ts uses it so a `?neuro` demo link can turn the mode
  // on for exactly one page load; that precedence is intentional and pinned by a
  // test, so this must not fight it. No docs recipe uses the demo route, and the
  // case where one did is caught where it actually matters - NEUTRAL_PROBE in
  // build-docs-shots.ts looks for the mounted dock in the rendered page, which is
  // an outcome check no flag-layer ordering can slip past.
  for (const id of NEUTRALISED_FLAGS) setFlagMirror(id, false);
  applyA11yPrefs({});
  return true;
}

/** Attribute a settled view carries, as a `waitSelector=` recipe would name it. */
export const CAPTURE_SETTLED_ATTR = 'data-shots-settled';

/**
 * Stamp `data-shots-settled` on `root` once every image under it has finished loading,
 * so a capture recipe can block on the frame being FINAL rather than guess with `waitMs`.
 * A no-op unless the capture pin is set, so nothing here runs for a real visitor.
 *
 * Why this is needed on top of stilling the timers: freezing motion makes the LAYOUT
 * deterministic, but not the CONTENT. A tile whose preview had decoded in one run and
 * not in the next produced a ±25% swing in the serialised SVG - the walker embeds the
 * image it can see. Raster baselines absorbed that in their `tolerance=` pixel budget;
 * a vector baseline compares exactly, so "nearly loaded" is a different file.
 *
 * Lazy images are forced eager first, and that is the essential detail: an offscreen
 * `loading="lazy"` tile never loads at all, so waiting on `complete` would hang forever
 * and `waitSelector` would time out. Forcing them makes the wait terminate AND makes the
 * set of decoded images the same every run. Errors resolve like loads - a broken preview
 * must not stall a capture, and it is equally broken in every run.
 */
export function settleForCapture(root: ParentNode & { setAttribute(n: string, v: string): void }): void {
  if (!captureNeutralPinned()) return;
  void (async () => {
    // Repeat until the image set STOPS GROWING. One pass is not enough: the gallery
    // hydrates its example strips from an IntersectionObserver (armCarousels), so
    // waiting on the images present at mount settles while more are still arriving.
    // Settle on the whole DOM, not just images, and require the count to hold STILL
    // across two consecutive rounds. One quiet round is not enough: the gallery
    // hydrates its example strips from an IntersectionObserver (armCarousels), which
    // can fire a batch after a round that looked finished - leaving one capture in
    // roughly 4 with a whole extra strip and a +26% baseline.
    let stable = 0;
    let prev = -1;
    for (let round = 0; round < 40 && stable < 2; round++) {
      const imgs = Array.from(root.querySelectorAll('img'));
      for (const im of imgs) im.loading = 'eager';
      await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise<void>((res) => {
        im.addEventListener('load', () => res(), { once: true });
        im.addEventListener('error', () => res(), { once: true });
      }))));
      // decode() turns "bytes arrived" into "pixels ready"; a rejection (a broken
      // image) is as final as a success, so it settles rather than throws.
      await Promise.all(imgs.map((im) => im.decode?.().catch(() => undefined)));
      // Let any observer fire against the now-settled layout, then re-count.
      await new Promise<void>((res) => setTimeout(res, 150));
      const now = root.querySelectorAll('*').length;
      stable = now === prev ? stable + 1 : 0;
      prev = now;
    }
    root.setAttribute(CAPTURE_SETTLED_ATTR, 'true');
  })();
}
