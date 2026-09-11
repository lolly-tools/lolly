// SPDX-License-Identifier: MPL-2.0
/**
 * Neutralising a `transform` that a RUNNING ANIMATION owns - the walkers' re-entry
 * guard (plans/104 section 9, P3.1 failure 2).
 *
 * Both walkers in `export.ts` (SVG here, PDF further down the same file) handle a
 * rotated / skewed / non-uniformly-scaled element the same way: set
 * `el.style.transform = 'none'`, walk the now axis-aligned subtree, and wrap what
 * comes out in ONE SVG `rotate()`/`matrix()` group (or one jsPDF CTM). That
 * neutralise step is a plain inline declaration, and there is exactly one thing in
 * CSS that outranks every declaration in every origin: an ANIMATION or TRANSITION
 * currently running on that property (CSS Cascade 5 section 6.1 - animations sit above the
 * author `!important` level and transitions above them again). A STRONGER inline
 * style therefore cannot win, `!important` included - measured, which is why nothing
 * here reaches for one.
 *
 * The failure that caused was not a wrong pixel, it was an explosion. With the
 * transform still live, the recursive call recomputed the SAME non-identity matrix,
 * took the SAME branch and emitted another wrapper `<g>`, once per attempt: the
 * app's own gallery (`transition: transform` on the tiles) walked to 34 455 groups
 * in identical chains 2 136 deep, which the lift enumerator then refused at its tag
 * cap. Under an INFINITE transform animation the recursion has no natural end at
 * all. Docs shots escaped it only because the capture harness injects `FREEZE_CSS`,
 * whose `transition-duration: 0s !important` leaves nothing running to outrank the
 * write - which is also why nobody found this from a screenshot.
 *
 * So, in order:
 *
 *  1. **Stop the element's own transform animations for the shot.** A capture is a
 *     STILL: the frame being exported is one instant, and an element mid-transition
 *     has no other "correct" pose to preserve, so stopping the motion is not a
 *     fidelity loss - it is what a still means. `pause()` cannot do the job (a
 *     paused animation still contributes its current value to the cascade, so it
 *     would still outrank the inline neutralise), so they are CANCELLED, and then
 *     replayed from the time they were stopped at once the element's walk finishes.
 *     A live page is left animating; a capture harness that already froze CSS sees
 *     no change at all.
 *  1b. **…and suppress the transition the neutralise would otherwise START.** This
 *     one is not obvious and it is the half that actually bit: writing
 *     `transform: none` onto an element whose stylesheet says
 *     `transition: transform …` is itself a style change, so the browser starts a
 *     BRAND-NEW transition from the old pose toward `none` - which outranks the very
 *     declaration that triggered it, leaving the computed transform where it was.
 *     Measured in Chromium 151: cancel the running transition and the computed
 *     transform snaps to its target correctly; assign `transform: none` and a fresh
 *     `CSSTransition` appears in `getAnimations()` with the computed value unmoved.
 *     So the element carries an inline `transition-property: none` for the duration
 *     of its walk. That means an element merely DECLARING a transform transition - 
 *     idle, never hovered, never touched - was enough to trigger the re-entry, which
 *     is why a gallery of static tiles could explode. `!important` is used for this
 *     one property, and it is not the move section 9 rules out: importance settles a
 *     contest between DECLARATIONS, which this is. Out-declaring a running ANIMATION
 *     is what is futile, and that is not attempted here.
 *  2. **If the transform survives that, do not wrap and do not recurse.** An author
 *     `!important` rule, an animation the API would not let us touch, a UA-driven
 *     transform: `neutraliseTransform` returns `null` and the caller falls through
 *     to its AABB path, whose `getBoundingClientRect` already carries the transform.
 *     One group for one element, bounded - the same graceful degrade a 3-D transform
 *     has always taken.
 *  3. **An element already inside its own neutralise-walk never starts a second
 *     one.** The `walking` WeakSet is the backstop that makes the recursion bounded
 *     by construction rather than by the cascade behaving: even a transform that
 *     reappears mid-walk can cost one extra group, never a chain.
 *
 * Nothing here runs for an element with no transform, and for a document with no
 * transform animation at all step 1 finds nothing to cancel and step 2 always
 * passes - so the emitted bytes are unchanged. That is the floor this must hold.
 *
 * Measured, one rotated card in a 400×240 page, Chromium 151 (the fixtures in
 * `export-transform-animation.test.ts`):
 *
 * | fixture                            | before                                   | after            |
 * |------------------------------------|------------------------------------------|------------------|
 * | 60 s transition, running           | never finished (killed at 30 s)          | 6 `<g>`, 10 ms   |
 * | `transition: transform 0.2s`, idle | unparseable: "Excessive node nesting"    | 6 `<g>`, 3 ms    |
 * | infinite `@keyframes` spin         | never finished (killed at 30 s)          | 6 `<g>`, 6 ms    |
 *
 * (`<g>` depth 5 in all three after cases - the same tree the un-animated page walks
 * to. The middle row is the gallery's shape: nothing was animating.)
 */
import { parseCssMatrix, isAxisAlignedMat } from '@lolly/engine';
import { pureRotationDeg } from './export-pdf-vector.ts';

/**
 * Per-walk state: which elements are mid-neutralise, and whether the one warning
 * has been spent. One guard per walker call, so two concurrent exports of the same
 * DOM cannot see each other's entries.
 */
export type NeutraliseGuard = { walking: WeakSet<Element>; warned: boolean };

export const newNeutraliseGuard = (): NeutraliseGuard =>
  ({ walking: new WeakSet<Element>(), warned: false });

/**
 * Does this computed `transform` still send the element down a wrap-and-recurse
 * branch? Mirrors the two walker conditions exactly - a pure rotation, or a matrix
 * that is not axis-aligned, or one that scales. A pure TRANSLATE (and anything
 * `parseCssMatrix` refuses, i.e. 3-D/perspective) is handled by the AABB path, so it
 * is not "wrapping" for this purpose.
 */
export function wrapsInWalker(transform: string | null | undefined): boolean {
  if (!transform || transform === 'none') return false;
  if (pureRotationDeg(transform)) return true;
  const m = parseCssMatrix(transform);
  if (!m) return false;
  return !isAxisAlignedMat(m) || Math.abs(m.a - 1) > 1e-4 || Math.abs(m.d - 1) > 1e-4;
}

/**
 * Property names whose animation defeats an inline `transform: none`. Deliberately
 * NARROW: the walkers read `getComputedStyle(el).transform` and nothing else, so an
 * animation on `translate`/`rotate`/`scale` (the independent transform properties,
 * which do not fold into computed `transform`) or on a custom property feeding
 * `transform: rotate(var(--a))` (where the inline declaration wins normally) cannot
 * cause the re-entry, and stopping it would be motion taken from the page for free.
 *
 * `getKeyframes()` reports camelCase property keys; `CSSTransition.transitionProperty`
 * reports the hyphenated CSS name. Both spellings are listed for that reason.
 */
const TRANSFORM_PROPS = new Set(['transform', 'webkitTransform', '-webkit-transform']);

/** Does this animation write the `transform` property? */
export function animatesTransform(anim: {
  transitionProperty?: unknown;
  effect?: { getKeyframes?: () => Array<Record<string, unknown>>; pseudoElement?: unknown } | null;
}): boolean {
  const eff = anim.effect;
  // An animation targeting ::before/::after does not touch the element's own
  // transform, so it is left running - the pseudo paint path owns it.
  if (eff && typeof eff.pseudoElement === 'string' && eff.pseudoElement) return false;
  const tp = anim.transitionProperty;
  if (typeof tp === 'string') return TRANSFORM_PROPS.has(tp);
  if (!eff || typeof eff.getKeyframes !== 'function') return false;
  try {
    for (const frame of eff.getKeyframes()) {
      for (const key of Object.keys(frame)) if (TRANSFORM_PROPS.has(key)) return true;
    }
  } catch { /* an effect that will not describe itself is left running */ }
  return false;
}

/** One cancelled animation and everything needed to put it back. */
type StoppedAnim = { anim: Animation; time: number | null; paused: boolean };

function stopTransformAnimations(el: Element): StoppedAnim[] {
  const out: StoppedAnim[] = [];
  let anims: Animation[];
  try { anims = el.getAnimations?.({ subtree: false }) ?? []; } catch { return out; }
  for (const anim of anims) {
    // 'idle' contributes nothing to the cascade, so it cannot be what is outranking
    // the inline neutralise. Leave it entirely alone.
    const state = anim.playState;
    if (state === 'idle') continue;
    if (!animatesTransform(anim as unknown as Parameters<typeof animatesTransform>[0])) continue;
    let time: number | null = null;
    try { time = typeof anim.currentTime === 'number' ? anim.currentTime : null; } catch { /* keep null */ }
    try { anim.cancel(); } catch { continue; }      // could not stop it → not ours to restore
    out.push({ anim, time, paused: state === 'paused' });
  }
  return out;
}

function replayAnimations(stopped: StoppedAnim[]): void {
  for (const s of stopped) {
    // Restoring the page's motion must never be able to fail an export, and every
    // step here is independently best-effort: `cancel()` left the animation idle,
    // `play()` re-attaches it, and seeking puts it back where the shot found it.
    // (A finished animation lands back on 'finished' from the seek alone - calling
    // `finish()` would throw on an infinite one.)
    try {
      s.anim.play();
      if (s.time !== null) s.anim.currentTime = s.time;
      if (s.paused) s.anim.pause();
    } catch { /* the still is already correct; the live page keeps whatever it has */ }
  }
}

/**
 * Neutralise `el`'s transform for the walk of its subtree.
 *
 * Returns the restore function - call it in a `finally` - or **null** when the
 * transform could not be neutralised, in which case NOTHING was changed and the
 * caller must fall through to its AABB path instead of wrapping and recursing.
 *
 * @param log  Optional one-line reporter for the un-neutralisable case. Called at
 *             most once per guard (i.e. once per walk): the no-silent-degrade rule
 *             wants the fact said out loud, and a page full of animated tiles must
 *             not turn that into thousands of lines.
 */
export function neutraliseTransform(
  el: Element, guard: NeutraliseGuard, log?: (msg: string) => void,
): (() => void) | null {
  if (guard.walking.has(el)) return null;                       // (3) already mid-walk
  const style = (el as unknown as { style?: CSSStyleDeclaration }).style;
  // No inline style object, no neutralise - and the AABB path is a complete answer,
  // so this is a fall-through rather than an error.
  if (!style) return null;
  const prev = style.transform;
  const prevPriority = style.getPropertyPriority?.('transform') ?? '';
  const prevTrans = style.transitionProperty;
  const prevTransPriority = style.getPropertyPriority?.('transition-property') ?? '';
  const stopped = stopTransformAnimations(el);                  // (1)
  // (1b) Both writes land in one style change, so the transition that the transform
  // write would have started never gets to exist: CSS Transitions section Starting reads
  // `transition-property` from the AFTER-change style, and by then it is `none`.
  style.setProperty('transition-property', 'none', 'important');
  style.transform = 'none';
  guard.walking.add(el);
  const restore = (): void => {
    guard.walking.delete(el);
    if (prev) style.setProperty('transform', prev, prevPriority);
    else style.removeProperty('transform');
    // Put the transform back FIRST and let it settle while transitions are still
    // off, or restoring `transition-property` and the pose in one change starts the
    // exact transition this suppressed - the walk would leave a 60-second tween
    // running on a page that had none.
    try { void window.getComputedStyle(el).transform; } catch { /* no view: nothing to flush */ }
    if (prevTrans) style.setProperty('transition-property', prevTrans, prevTransPriority);
    else style.removeProperty('transition-property');
    replayAnimations(stopped);
  };
  // (2) Did it take? One computed read, on an element whose style the caller's
  // getBoundingClientRect is about to force clean anyway.
  if (!wrapsInWalker(window.getComputedStyle(el).transform)) return restore;
  restore();
  if (log && !guard.warned) {
    guard.warned = true;
    log(`transform: a running animation or !important rule on <${el.tagName?.toLowerCase?.() ?? '?'}>`
      + ' could not be neutralised for the capture - that element is exported from its'
      + ' transformed bounding box instead of being walked untransformed');
  }
  return null;
}
