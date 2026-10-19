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
