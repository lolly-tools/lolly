// SPDX-License-Identifier: MPL-2.0
/**
 * The pathways strip on a narrow screen (plan 277 step 3c), for both readers: the
 * in-app reader calls it on the strip it adopts (views/docs.ts), and docs/build.ts
 * bundles this module into the /info script, so the two run the same code.
 *
 * Below 40em the strip keeps one line and scrolls (styles/parts/docs-chrome.css). This
 * marks which edges have tabs beyond them, as `data-strip-edges="start end"`, so the
 * stylesheet fades exactly those edges and a label cut at the edge never reads as a
 * whole word, and on arrival it scrolls the current section's tab into the middle.
 * When every tab is in view, the attribute is empty and no edge fades.
 *
 * Right-to-left needs no branch: scrollLeft runs from 0 at the inline start to a
 * negative value, so its absolute value is the distance from the start either way,
 * and a positive screen-space delta moves the view the same way in both directions.
 * No document- or window-level listener; the returned function removes both hooks.
 */
export function enhancePathwaysStrip(strip: HTMLElement): () => void {
  const update = (): void => {
    const overflow = strip.scrollWidth - strip.clientWidth;
    if (overflow <= 1) {
      strip.setAttribute('data-strip-edges', '');
      return;
    }
    const fromStart = Math.abs(strip.scrollLeft);
    const edges = [fromStart > 1 ? 'start' : '', fromStart < overflow - 1 ? 'end' : ''].filter(Boolean).join(' ');
    if (strip.getAttribute('data-strip-edges') !== edges) strip.setAttribute('data-strip-edges', edges);
  };
  const current = strip.querySelector<HTMLElement>('.docs-pathway.active');
  if (current && strip.scrollWidth > strip.clientWidth) {
    const s = strip.getBoundingClientRect();
    const c = current.getBoundingClientRect();
    strip.scrollLeft += (c.left + c.width / 2) - (s.left + s.width / 2);
  }
  update();
  strip.addEventListener('scroll', update, { passive: true });
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
  resize?.observe(strip);
  return () => {
    strip.removeEventListener('scroll', update);
    resize?.disconnect();
  };
}
