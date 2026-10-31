// SPDX-License-Identifier: MPL-2.0
/**
 * The nested-SVG paint bake of the DOM -> SVG walker, moved out of
 * export-svg-walker.ts (plans/328) so the walker's one long function can stay inside its
 * budget while the bake learns about keyed appearance.
 *
 * A nested <svg>'s presentation is mostly CASCADE-driven on screen - class rules, var()s,
 * inherited text style - and the verbatim clone keeps only attributes plus its inner
 * <style>. Standalone, classes match stylesheets that are not there and var()s are
 * undefined, so this bakes each SVG descendant's COMPUTED presentation onto the clone as
 * INLINE style. Values equal to the SVG initial value are skipped (paint that arrives
 * through attributes stays on the attributes), EXCEPT where the clone's own inline style
 * reads a keyed appearance property (`var(--lolly-kf-*)`, plans/328): standalone that var
 * would resolve to its authored fallback, so the computed value is written whatever it
 * is - a keyed fill of pure black is the case that needs the rule. The deep clone is a
 * same-order copy, so the two element lists pair 1:1; a topology mismatch skips the bake.
 */
const SVGNS = 'http://www.w3.org/2000/svg';
const PAINT = [
  ['fill', 'rgb(0, 0, 0)'], ['fill-opacity', '1'], ['fill-rule', 'nonzero'],
  ['stroke', 'none'], ['stroke-opacity', '1'], ['stroke-width', '1px'],
  ['stroke-linecap', 'butt'], ['stroke-linejoin', 'miter'],
  ['stroke-dasharray', 'none'], ['stroke-dashoffset', '0px'],
  ['stroke-miterlimit', '4'], ['opacity', '1'],
  ['paint-order', 'normal'], ['vector-effect', 'none'],
] as const;
const TEXT = [
  ['font-family', ''], ['font-size', ''], ['font-weight', '400'],
  ['font-style', 'normal'], ['letter-spacing', 'normal'],
  ['text-anchor', 'start'], ['dominant-baseline', 'auto'],
] as const;
const STOP = [['stop-color', 'rgb(0, 0, 0)'], ['stop-opacity', '1']] as const;
const TEXT_TAGS = new Set(['text', 'tspan', 'textPath']);

export function bakeNestedSvgPaint(el: Element, clone: Element): void {
  const srcEls = el.querySelectorAll('*');
  const cloneEls = clone.querySelectorAll('*');
  if (srcEls.length !== cloneEls.length) return;
  for (let i = 0; i < srcEls.length; i++) {
    const s = srcEls[i]!;
    const c = cloneEls[i]!;
    if (s.namespaceURI !== SVGNS || !(c instanceof SVGElement)) continue;
    const cs = getComputedStyle(s);
    const bake = (props: readonly (readonly [string, string])[]): void => {
      for (const [p, initial] of props) {
        const v = cs.getPropertyValue(p);
        if (v && (v !== initial || c.style.getPropertyValue(p).includes('var(--lolly-kf-'))) c.style.setProperty(p, v);
      }
    };
    if (s.localName === 'stop') { bake(STOP); continue; }
    bake(PAINT);
    if (TEXT_TAGS.has(s.localName)) bake(TEXT);
  }
}
