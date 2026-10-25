// SPDX-License-Identifier: MPL-2.0
/**
 * The fold motion for a section that opens from a button rather than a <details>:
 * the export panel's cards (Password, Protection, Send to, Pro settings) and the
 * Design inspector's sections. parts/disclosure.css gives every <details> section
 * its motion through ::details-content. This module runs the same one, a block-size
 * change with a fade, timed from the same --fold-* custom properties, so a section
 * folds the same way wherever it sits.
 *
 * `apply(open)` sets the resting state the caller already uses, an inline display
 * or the hidden attribute, so nothing else about the caller changes. Opening applies
 * the open state first and grows the body from nothing; closing shrinks the body and
 * applies the closed state when the motion ends. A second press part way through
 * starts from the size the body has reached. Reduce motion, from the system or the
 * app's own setting, applies the end state at once, as does a host without the Web
 * Animations API (a test DOM).
 */
import { prefersReducedMotion } from './a11y-prefs.ts';

const running = new WeakMap<HTMLElement, readonly Animation[]>();

/** A CSS time held in a custom property, in milliseconds. */
function ms(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const raw = style.getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value;
}

/** The row gap a flex or grid parent opens above the body, which folds away with the body. */
function gapAbove(body: HTMLElement): number {
  const parent = body.parentElement;
  if (!parent || !body.previousElementSibling) return 0;
  const style = getComputedStyle(parent);
  if (!/flex|grid/.test(style.display)) return 0;
  const gap = Number.parseFloat(style.rowGap);
  return Number.isFinite(gap) ? gap : 0;
}

/** Open or close a section's body with the shared fold motion. */
export function foldBody(body: HTMLElement, open: boolean, apply: (open: boolean) => void): void {
  const previous = running.get(body);
  const reached = previous ? body.getBoundingClientRect().height : null;
  if (previous) {
    running.delete(body);
    for (const animation of previous) animation.cancel();
  }
  if (prefersReducedMotion() || typeof body.animate !== 'function') {
    apply(open);
    return;
  }
  if (open) apply(true);
  const style = getComputedStyle(body);
  const size = ms(style, '--fold-size-duration', 180);
  const fade = ms(style, '--fold-fade-duration', 160);
  const easing = style.getPropertyValue('--fold-easing').trim() || 'ease-out';
  const margin = Number.parseFloat(style.marginTop) || 0;
  const shown = {
    height: `${body.getBoundingClientRect().height}px`,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    marginTop: `${margin}px`,
  };
  const shut = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: `${margin - gapAbove(body)}px` };
  const from = reached === null ? (open ? shut : shown) : { ...shown, height: `${reached}px` };
  const frames = [from, open ? shown : shut].map(frame => ({ ...frame, boxSizing: 'border-box', overflow: 'clip' }));
  const animations = [
    body.animate(frames, { duration: size, easing, fill: open ? 'none' : 'forwards' }),
    body.animate(open ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing, fill: open ? 'none' : 'forwards' }),
  ] as const;
  running.set(body, animations);
  animations[0].addEventListener('finish', () => {
    if (running.get(body) !== animations) return; // a later press took over
    running.delete(body);
    if (!open) apply(false);
    for (const animation of animations) animation.cancel();
  });
}

/** How long after a section opens a change in its height still eases, in milliseconds. */
const SETTLE_WINDOW = 1500;
interface Settling { since: number; height: number; animation?: Animation; changes: MutationObserver }
const settling = new WeakMap<HTMLElement, Settling>();
let settleInstalled = false;

/**
 * A section that fills in after it opens (a Settings card mounts its body on first
 * open; the Assets inspector reads some sections late) changes height while or after
 * the fold motion runs, and a plain reflow jumps. For a short while after a
 * collapsible section card opens, a change in its body's height plays as the same
 * block-size motion, from the height it had to the height it has now. Content
 * changes are caught by a MutationObserver, which runs before the next frame is
 * drawn, so the first frame of new content is already the start of the motion.
 * Other size changes (an image arriving) are caught a frame later by a
 * ResizeObserver. Later changes (a field growing as someone types) are left alone.
 * Reduce motion skips it, as does a host without the observers or the Web
 * Animations API. Idempotent; call once at boot.
 */
export function installFoldSettle(): void {
  if (settleInstalled || typeof document === 'undefined' || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
  settleInstalled = true;

  const ease = (body: HTMLElement, state: Settling, measured?: number): void => {
    // A running ease starts the next one from where it has got to.
    const reached = state.animation ? body.getBoundingClientRect().height : null;
    state.animation?.cancel();
    state.animation = undefined;
    const to = measured ?? body.getBoundingClientRect().height;
    const from = reached ?? state.height;
    state.height = to;
    if (Math.abs(to - from) < 1 || from === 0 || prefersReducedMotion() || typeof body.animate !== 'function') return;
    const style = getComputedStyle(body);
    const animation = body.animate(
      [{ height: `${from}px`, overflow: 'clip' }, { height: `${to}px`, overflow: 'clip' }],
      { duration: ms(style, '--fold-size-duration', 180), easing: style.getPropertyValue('--fold-easing').trim() || 'ease-out' },
    );
    state.animation = animation;
    animation.addEventListener('finish', () => { if (state.animation === animation) state.animation = undefined; });
  };
  const live = (body: HTMLElement): Settling | null => {
    const state = settling.get(body);
    if (!state) return null;
    if (performance.now() - state.since <= SETTLE_WINDOW) return state;
    stop(body);
    return null;
  };

  const resized = new ResizeObserver(entries => {
    for (const entry of entries) {
      const body = entry.target as HTMLElement;
      const state = live(body);
      if (!state || state.animation) continue; // this module's own motion is resizing the body
      const height = entry.borderBoxSize?.[0]?.blockSize ?? body.getBoundingClientRect().height;
      // While the fold itself is opening, its transition runs to the body's live height.
      if (performance.now() - state.since < ms(getComputedStyle(body), '--fold-size-duration', 180)) { state.height = height; continue; }
      ease(body, state, height);
    }
  });
  const stop = (body: HTMLElement): void => {
    const state = settling.get(body);
    state?.animation?.cancel();
    state?.changes.disconnect();
    settling.delete(body);
    resized.unobserve(body);
  };

  document.addEventListener('toggle', event => {
    const section = event.target;
    if (!(section instanceof HTMLDetailsElement) || !section.matches('details.section-card, details.input-section')) return;
    const body = section.querySelector<HTMLElement>(':scope > .section-card-body, :scope > .input-section-body');
    if (!body) return;
    stop(body);
    if (!section.open) return;
    const changes = new MutationObserver(() => { const state = live(body); if (state) ease(body, state); });
    settling.set(body, { since: performance.now(), height: body.getBoundingClientRect().height, changes });
    resized.observe(body);
    changes.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'open'] });
  }, true);
}
