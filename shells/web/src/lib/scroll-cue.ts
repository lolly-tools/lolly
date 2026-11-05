// SPDX-License-Identifier: MPL-2.0
/**
 * A scrolling strip that says it scrolls.
 *
 * A rail of tools capped to the space it has (Design's tool rail in two panes) can
 * hold more buttons than it shows. Cut off silently, the last ones are simply gone.
 * `watchScrollCue` marks the ends that hold more and puts a cue at each: a fade into
 * the rail's own surface with a chevron pointing the way, drawn by the host's
 * stylesheet from two attributes on the host element:
 *
 *   data-cue-axis="y" | "x"     which way the strip scrolls
 *   data-more="start end"       the ends with more beyond them (absent when it fits)
 *
 * The cues are decoration (aria-hidden, no pointer events): touch, the wheel and Tab
 * all scroll the strip, and a focused button scrolls itself into view. Nothing is
 * re-created; the cues follow scrolling, resizing and buttons coming and going.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A chevron pointing down, built as DOM so no markup string is parsed. */
function chevron(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'm6 9 6 6 6-6');
  svg.append(path);
  return svg;
}

/** Which ends of `el` hold more along `axis`. Logical: `start` is the top or the inline start. */
export function scrollEnds(el: HTMLElement, axis: 'x' | 'y'): { start: boolean; end: boolean } {
  if (axis === 'y') {
    const max = el.scrollHeight - el.clientHeight;
    return { start: max > 1 && el.scrollTop > 1, end: max > 1 && el.scrollTop < max - 1 };
  }
  const max = el.scrollWidth - el.clientWidth;
  // In a right-to-left strip scrollLeft runs from 0 down to -max.
  const pos = Math.abs(el.scrollLeft);
  return { start: max > 1 && pos > 1, end: max > 1 && pos < max - 1 };
}

/**
 * Follow `scroller` and put the cues in `host` (a positioned ancestor that does not
 * scroll). Returns the stop, which takes the cues and the attributes away again.
 */
export function watchScrollCue(scroller: HTMLElement, host: HTMLElement): () => void {
  const doc = host.ownerDocument;
  const cues = (['start', 'end'] as const).map((end) => {
    const cue = doc.createElement('span');
    cue.className = `scroll-cue scroll-cue--${end}`;
    cue.setAttribute('aria-hidden', 'true');
    cue.append(chevron(doc));
    host.append(cue);
    return cue;
  });
  let frame = 0;
  const update = (): void => {
    frame = 0;
    const view = doc.defaultView;
    const column = !!view && view.getComputedStyle(scroller).flexDirection.startsWith('column');
    const axis: 'x' | 'y' = column ? 'y' : 'x';
    const { start, end } = scrollEnds(scroller, axis);
    host.dataset.cueAxis = axis;
    const more = [start ? 'start' : '', end ? 'end' : ''].filter(Boolean).join(' ');
    if (more) host.dataset.more = more;
    else delete host.dataset.more;
  };
  const schedule = (): void => {
    const raf = doc.defaultView?.requestAnimationFrame;
    if (frame || !raf) { if (!raf) update(); return; }
    frame = raf(update);
  };
  scroller.addEventListener('scroll', schedule, { passive: true });
  const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  sizes?.observe(scroller);
  sizes?.observe(host);
  const kids = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null;
  kids?.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  update();
  return () => {
    if (frame) doc.defaultView?.cancelAnimationFrame(frame);
    scroller.removeEventListener('scroll', schedule);
    sizes?.disconnect();
    kids?.disconnect();
    for (const cue of cues) cue.remove();
    delete host.dataset.more;
    delete host.dataset.cueAxis;
  };
}
