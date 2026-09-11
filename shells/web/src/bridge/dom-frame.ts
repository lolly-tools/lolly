// SPDX-License-Identifier: MPL-2.0
/**
 * Deterministic DOM-motion frame sampling - the shared primitive behind
 * frame-accurate rasterisation of ANY animated DOM subtree (CSS `@keyframes`,
 * CSS transitions, Web-Animations, and SMIL inside inline SVG). It is NOT
 * SVG-specific: any live DOM node whose motion is declarative can be seeked to
 * an exact time and snapshotted, so the same code drives (a) the non-camera
 * live source that feeds `onFrame` tools like `filter`, and (b) the sequence
 * compositor's frame-addressable DOM layer - the way `<video>` (currentTime)
 * and Lottie (goToAndStop) are already frame-addressable.
 *
 * Why this exists: a CSS-animated element only advances at wall-clock while it
 * is live in the DOM, and exposes no seek API of its own - so every path that
 * rasterises it once (dom-to-image, an `<img>` decode) freezes it at whatever
 * phase it held. The Web Animations API is the missing seek: `getAnimations()`
 * enumerates the running animations on a subtree and each one's `currentTime`
 * is writable. Pausing first makes the seek stick (an unpaused animation would
 * immediately resume ticking from the seeked point on the next frame).
 *
 * A NODE MUST BE CONNECTED and its SVG INLINE for this to work: `getAnimations`
 * sees nothing inside an `<img>`-embedded SVG (opaque document), and computed
 * styles don't resolve on a detached clone. Callers inline + attach off-screen
 * (see anim-svg-mount) before seeking. `export.ts` carries a private copy of
 * the WAAPI half (`scrubAnimations`) for the single-tool video path; new
 * callers import from here so there is one seek contract.
 */

/** Options for {@link scrubAnimations}. */
export interface ScrubOptions {
  /** Also seek SMIL (`<animate>`/`<animateTransform>`) clocks on inline SVG roots. Default true. */
  smil?: boolean;
}

/**
 * Freeze every declarative animation under `node` at exactly `ms` milliseconds
 * from each animation's own start. Idempotent and best-effort: a browser without
 * `getAnimations` (or an animation that rejects a seek) is skipped, never thrown.
 * Returns the number of WAAPI animations that were seeked (0 when none / unsupported).
 *
 * @param node  a CONNECTED element (inline SVG or HTML); an `<img>` is opaque and yields 0.
 * @param ms    time in milliseconds; negative values are clamped to 0.
 */
export function scrubAnimations(node: Element, ms: number, opts: ScrubOptions = {}): number {
  const t = ms > 0 ? ms : 0;
  let seeked = 0;

  // Web Animations: CSS @keyframes, transitions, and script-driven animations.
  const getAnims = (node as Element & {
    getAnimations?: (o?: { subtree?: boolean }) => Animation[];
  }).getAnimations;
  if (typeof getAnims === 'function') {
    let anims: Animation[] = [];
    try { anims = getAnims.call(node, { subtree: true }); } catch { anims = []; }
    for (const a of anims) {
      try {
        a.pause();          // make the seek stick; without this it resumes next tick
        a.currentTime = t;  // CSS animation currentTime is in ms
        seeked++;
      } catch { /* a finished/idle animation may reject a seek - skip it */ }
    }
  }

  // SMIL: inline <svg> animation clocks (setCurrentTime is in SECONDS).
  if (opts.smil !== false) {
    const svgs: SVGSVGElement[] = [];
    if (typeof (node as SVGSVGElement).setCurrentTime === 'function') svgs.push(node as SVGSVGElement);
    node.querySelectorAll?.('svg').forEach((s) => svgs.push(s as SVGSVGElement));
    for (const s of svgs) {
      try { s.pauseAnimations?.(); s.setCurrentTime?.(t / 1000); } catch { /* no SMIL clock - skip */ }
    }
  }

  return seeked;
}

/**
 * Longest loop period (ms) among the WAAPI animations under `node`, or 0 when
 * none report a finite iteration duration. Lets a caller pick a sampling window
 * (e.g. one full cycle) without the author declaring a duration. Best-effort.
 */
export function animationPeriod(node: Element): number {
  const getAnims = (node as Element & {
    getAnimations?: (o?: { subtree?: boolean }) => Animation[];
  }).getAnimations;
  if (typeof getAnims !== 'function') return 0;
  let anims: Animation[] = [];
  try { anims = getAnims.call(node, { subtree: true }); } catch { return 0; }
  let max = 0;
  for (const a of anims) {
    const timing = (a as Animation & { effect?: { getComputedTiming?: () => { duration?: number | string; iterations?: number } } }).effect;
    const ct = timing?.getComputedTiming?.();
    const dur = typeof ct?.duration === 'number' ? ct.duration : 0;
    const iters = ct?.iterations;
    // An infinite-iteration animation's period is one iteration; a finite one is dur*iters.
    const period = iters === Infinity || iters == null ? dur : dur * iters;
    if (Number.isFinite(period) && period > max) max = period;
  }
  return max;
}
