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
    const then = foldEnded.get(body);
    foldEnded.delete(body);
    if (open) then?.(Number.parseFloat(shown.height));
  });
}
/** Work that waits for an opening fold to end, with the height the fold ended at. */
const foldEnded = new WeakMap<HTMLElement, (endHeight: number) => void>();

/** The one folding body of a `<details>` section, or null when the section has none. */
function sectionBody(section: HTMLDetailsElement): HTMLElement | null {
  if (!section.matches('details.section-card, details.input-section')) return null;
  return section.querySelector<HTMLElement>(':scope > .section-card-body, :scope > .input-section-body');
}

/**
 * Fold a `<details>` section from a press on its summary. Returns true when the press
 * was taken, and the section then opens or closes with the shared motion.
 *
 * A press on a control inside the summary (a help tip, a link) is that control's own
 * and is left alone, as the browser does. So is a press something else already
 * handled, and a section with no body wrapper.
 */
export function foldDetailsOnPress(event: Event): boolean {
  if (event.defaultPrevented) return false;
  const target = event.target;
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const summary = (target as Element).closest('summary');
  const section = summary?.parentElement;
  if (!summary || !section || section.tagName !== 'DETAILS') return false;
  const details = section as HTMLDetailsElement;
  // Only the section's own summary opens it: the first summary child.
  if (details.querySelector(':scope > summary') !== summary) return false;
  const control = (target as Element).closest('a[href], button, input, select, textarea, label, [contenteditable]:not([contenteditable="false"])');
  if (control && summary.contains(control)) return false;
  const body = sectionBody(details);
  if (!body) return false;
  event.preventDefault();
  // A second press part way through reverses from where the body has got to. While a
  // close is running the section still reads open, so the press count decides.
  const opening = !(folding.get(details) ?? details.open);
  folding.set(details, opening);
  // A closing body has nothing left to settle, and the watch on its size would
  // report every frame of the fold.
  if (!opening) stopSettle?.(body);
  foldBody(body, opening, (open) => {
    details.open = open;
    if (folding.get(details) === open) folding.delete(details);
  });
  return true;
}
const folding = new WeakMap<HTMLDetailsElement, boolean>();
/** Ends the late-content watch on one body; set by installFoldSettle. */
let stopSettle: ((body: HTMLElement) => void) | null = null;

let detailsFoldInstalled = false;
/**
 * parts/disclosure.css folds a `<details>` section through ::details-content, and the
 * height moves only where the browser has `interpolate-size`. WebKit and Gecko do not,
 * so on every iPhone and iPad, in Safari, in Firefox and in the desktop app a section
 * snapped open and shut. In those browsers this runs the same fold on the section's
 * body, timed from the same --fold-* values. A browser with `interpolate-size` keeps
 * the stylesheet's own motion and this installs nothing. Idempotent; call once at boot.
 */
export function installDetailsFold(): void {
  if (detailsFoldInstalled || typeof document === 'undefined') return;
  detailsFoldInstalled = true;
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || CSS.supports('interpolate-size', 'allow-keywords')) return;
  document.addEventListener('click', (event) => { foldDetailsOnPress(event); });
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
    // The fold itself is moving this body (foldBody, in a browser without
    // interpolate-size): a second motion on the same height would fight the fold.
    if (running.has(body)) return;
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
    foldEnded.delete(body);
    const state = settling.get(body);
    state?.animation?.cancel();
    state?.changes.disconnect();
    settling.delete(body);
    resized.unobserve(body);
  };

  stopSettle = stop;

  document.addEventListener('toggle', event => {
    const section = event.target;
    if (!(section instanceof HTMLDetailsElement) || !section.matches('details.section-card, details.input-section')) return;
    const body = section.querySelector<HTMLElement>(':scope > .section-card-body, :scope > .input-section-body');
    if (!body) return;
    stop(body);
    if (!section.open) return;
    const begin = (foldEnd?: number): void => {
      const changes = new MutationObserver(() => { const state = live(body); if (state) ease(body, state); });
      const state: Settling = { since: performance.now(), height: foldEnd ?? body.getBoundingClientRect().height, changes };
      settling.set(body, state);
      resized.observe(body);
      changes.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'open'] });
      // Content that arrived while the fold ran: ease from where the fold ended.
      if (foldEnd !== undefined) ease(body, state);
    };
    // Where the fold moves the body itself (foldDetailsOnPress), the watch starts when
    // the fold has ended. A size watch on a body that changes every frame made WebKit
    // report a resize loop.
    if (running.has(body)) foldEnded.set(body, begin);
    else begin();
  }, true);
}
