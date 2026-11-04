// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly's spin, for the register: the only place Lolly's own mark moves on its own.
 * It shows while Lolly does something the person asked for (applying a look,
 * reading a PDF, importing a design file) and is gone when the work is done. Never
 * decoration on a blank state, never inside a tool canvas or an export stage.
 *
 * The mark is LOLLY_MARK_SVG (lib/lolly-mark.ts), the same artwork the view-loading
 * card turns, with gradient ids of its own per instance. Its three rings turn at
 * Andy's cadence for the lollipop spin (3 s, 6 s and 9 s, the timing of his
 * CodePen and of the lolly/demo/lolly-spin asset) and the swirl's hue drifts 25
 * degrees either way, so it breathes through nearby colours. The
 * swirl reads --lolly-swirl, which styles/parts/lolly-spin.css sets to Lolly's tone
 * at the brand's hue (--lolly-mark), so the spin takes the brand it serves. CSS
 * animation only, no canvas.
 *
 * Reduce motion (the system setting or the app's own) shows the mark still beside
 * the label. The label is a polite live region, so assistive technology hears what
 * Lolly is doing; the mark is hidden from assistive technology.
 */
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';

export interface LollySpinOptions {
  /** What Lolly is doing, already translated (for example t('Reading the PDF…')). */
  label?: string;
  /** Wait this long before showing, so a quick job never flashes the spin. */
  delayMs?: number;
}

let spins = 0;
const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** The mark with gradient ids no other copy in the document uses. */
function markSvg(): string {
  const scope = `lolly-spin-${++spins}`;
  return LOLLY_MARK_SVG.replaceAll('lolly-primary-', `${scope}-primary-`)
    .replaceAll('lolly-reverse-', `${scope}-reverse-`);
}

/** The spin already in this container, if any (not one nested deeper). */
function own(container: Element): HTMLElement | null {
  for (const child of container.children)
    if (child instanceof HTMLElement && child.classList.contains('lolly-spin')) return child;
  return null;
}

/**
 * Show the spin at the end of container, or update the label of the one already
 * there. Returns the spin's element.
 */
export function showLollySpin(container: Element, opts: LollySpinOptions = {}): HTMLElement {
  const label = opts.label ?? '';
  const existing = own(container);
  if (existing) {
    const text = existing.querySelector('.lolly-spin__label');
    if (text) text.textContent = label;
    return existing;
  }
  const spin = container.ownerDocument.createElement('span');
  spin.className = 'lolly-spin';
  if (prefersReducedMotion()) spin.classList.add('is-still');
  spin.setAttribute('role', 'status');
  spin.setAttribute('aria-live', 'polite');
  const mark = container.ownerDocument.createElement('span');
  mark.className = 'lolly-spin__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = markSvg();
  const text = container.ownerDocument.createElement('span');
  text.className = 'lolly-spin__label';
  spin.append(mark, text);
  const delay = opts.delayMs ?? 0;
  if (delay > 0) {
    spin.hidden = true;
    timers.set(spin, setTimeout(() => {
      timers.delete(spin);
      spin.hidden = false;
    }, delay));
  }
  container.append(spin);
  // Set after the region is in the document, so it is announced as a change.
  text.textContent = label;
  return spin;
}

/** Remove the spin from container, or every spin in the document when no container is given. */
export function hideLollySpin(container?: Element | null): void {
  const spins = container
    ? [own(container)].filter((el): el is HTMLElement => el !== null)
    : [...document.querySelectorAll<HTMLElement>('.lolly-spin')];
  for (const spin of spins) {
    clearTimeout(timers.get(spin));
    timers.delete(spin);
    spin.remove();
  }
}
