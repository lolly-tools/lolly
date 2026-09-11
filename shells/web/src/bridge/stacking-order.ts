// SPDX-License-Identifier: MPL-2.0
/**
 * CSS stacking-context classification for the HTML→SVG walker.
 *
 * ## Why this exists
 *
 * `renderSvgFromHtml` (export.ts) paints strictly in DOM order: an element's
 * background/borders, then its block children, then its inline text, then its
 * generated content. CSS does not paint in DOM order. It paints in
 * **stacking-context order** - CSS 2.1 Appendix E, section E.2 - where every stacking
 * context lays down seven layers:
 *
 *   1. the context element's own background and borders
 *   2. negative-z-index child stacking contexts (most negative first)
 *   3. in-flow, non-inline-level, non-positioned descendants
 *   4. non-positioned floats
 *   5. in-flow inline-level descendants (incl. inline blocks/tables)
 *   6. positioned descendants with `z-index: auto` or `z-index: 0`
 *   7. positive-z-index child stacking contexts (least positive first)
 *
 * DOM order agrees with that only when nothing is positioned or z-indexed. On
 * Lolly's own gallery page 99 elements carry a non-auto `z-index`, 22 of them
 * negative - so the walker paints tooltips under cards and scrims over content.
 *
 * ## Why this is a whole module, and a table
 *
 * The dangerous failure is not "we mis-order something". It is "we hoist a node
 * OUT of a stacking context it should never have left" - content that is correct
 * today becoming wrong. That can only happen if this file misses a
 * context-creating property. So detection is ONE auditable table with a spec
 * citation per clause and a test row per clause (stacking-order.test.ts), rather
 * than conditionals scattered through a 6000-line walker.
 *
 * Empirically, `z-index` alone is not close to sufficient: on the gallery fixture
 * z-index accounts for 71 of 206 stacking contexts (34%); `filter` 36, `transform`
 * 32, `isolation` 28, `opacity` 26, `content-visibility` 18. A z-index-only
 * implementation would hoist content out of isolated and filtered subtrees, which
 * is strictly worse than the DOM-order status quo.
 *
 * DOM-free by construction (it takes a plain record of computed values, not a
 * CSSStyleDeclaration) so it unit-tests under plain node:test everywhere.
 */

/** The Appendix E section E.2 layers a walker can DEFER a child into.
 *
 *  Layers 1 (the context element's own background/border) and 5 (in-flow inline
 *  content) are never deferred: the walker emits both in place, at the point it
 *  reaches them. 3 and 4 are listed because a unit must be classified as
 *  "stays where DOM order put it" explicitly - a silent default is how an
 *  ordering bug hides. */
export type PaintLayer = 2 | 3 | 4 | 6 | 7;

/**
 * The subset of computed style stacking order depends on. Every field is the
 * *computed* value as `getComputedStyle` reports it (so `zIndex` is the literal
 * string `'auto'`, not a number, and `transform` is `'none'` or a matrix).
 *
 * All fields optional so a caller can hand over a partial record in a test and
 * so a browser that doesn't implement a property (older `containerType`) reads
 * as absent rather than throwing.
 */
export interface StackingStyle {
  position?: string;
  zIndex?: string;
  float?: string;
  display?: string;
  opacity?: string;
  transform?: string;
  translate?: string;
  rotate?: string;
  scale?: string;
  perspective?: string;
  transformStyle?: string;
  filter?: string;
  backdropFilter?: string;
  mixBlendMode?: string;
  isolation?: string;
  clipPath?: string;
  maskImage?: string;
  webkitMaskImage?: string;
  contain?: string;
  containerType?: string;
  contentVisibility?: string;
  willChange?: string;
  viewTransitionName?: string;
  order?: string;
}

export interface StackingRole {
  /** Does this element establish a stacking context for its descendants? */
  createsContext: boolean;
  /** Which clause fired - surfaced in logs and asserted per-row by the tests.
   *  `''` when no clause fired. */
  reason: string;
  /** Which Appendix E section E.2 layer this element's paint unit belongs to inside its
   *  PARENT's stacking context. */
  layer: PaintLayer;
  /** Used z-index. 0 when `auto` - Appendix E sorts layer 6 (auto/0) together. */
  z: number;
  /** `order` (flex/grid), for order-modified document order. 0 when absent. */
  order: number;
}

/** `none` and the empty string both mean "not set" for the property-valued
 *  creators (`transform`, `filter`, `clip-path`, …). `getComputedStyle` returns
 *  `''` for a property the browser doesn't implement. */
function set(v: string | undefined, initial = 'none'): boolean {
  if (v == null) return false;
  const s = v.trim().toLowerCase();
  return s !== '' && s !== initial;
}

/** Properties whose non-initial value makes a stacking context, so
 *  `will-change: <that>` makes one pre-emptively (CSS Will Change section 3 - "if any
 *  non-initial value of a property would create a stacking context on the
 *  element, specifying that property in will-change must create one"). */
const WILL_CHANGE_CREATORS = new Set([
  'opacity', 'transform', 'translate', 'rotate', 'scale', 'perspective',
  'filter', 'backdrop-filter', 'mix-blend-mode', 'isolation',
  'clip-path', 'mask', 'mask-image', 'mask-border',
  'contain', 'content-visibility', 'view-transition-name', 'offset-path', 'offset',
]);

/** `contain` keywords that include paint or layout containment. `style` alone
 *  does NOT create a stacking context (CSS Contain 2 section 2) - a trap worth a test
 *  row, because a naive `contain !== 'none'` check gets it wrong. */
const CONTAIN_CREATORS = ['layout', 'paint', 'content', 'strict'];

/**
 * Classify one element.
 *
 * @param s             its computed style subset
 * @param parentDisplay the PARENT's computed `display` - consulted only to decide
 *                      whether this element is a flex/grid ITEM, and only when
 *                      `zIndex !== 'auto'` (so callers can skip the extra
 *                      `getComputedStyle` in the overwhelmingly common case).
 * @param isTopLayer    `el.matches(':modal, :popover-open')` - top-layer boxes
 *                      paint above everything, independent of tree position.
 */
export function stackingRole(
  s: StackingStyle,
  parentDisplay = '',
  isTopLayer = false,
): StackingRole {
  const position = (s.position || 'static').trim().toLowerCase();
  const zRaw = (s.zIndex ?? 'auto').trim().toLowerCase();
  // TRAP: z-index computes to the STRING 'auto'. parseInt('auto') is NaN, and NaN
  // silently collapsing to 0 would turn every un-z-indexed element into an
  // explicit layer-6 member - i.e. hoist the whole page. Keep the two apart.
  const zAuto = zRaw === 'auto' || zRaw === '';
  const zNum = zAuto ? 0 : (Number.parseInt(zRaw, 10) || 0);
  const order = Number.parseInt((s.order ?? '0').trim(), 10) || 0;

  const pd = parentDisplay.trim().toLowerCase();
  const isFlexOrGridItem = !zAuto && /(^|\s)(inline-)?(flex|grid)$/.test(pd);
  const positioned = position !== 'static';

  let reason = '';
  const claim = (r: string) => { if (!reason) reason = r; return true; };

  const createsContext =
    // Top layer (HTML `:modal` dialog, open popover). Painted above every other
    // context in the document, so it must at minimum be a context of its own.
    (isTopLayer && claim('top-layer')) ||
    // CSS Position L3 section 9.9.1. `fixed` and `sticky` create one UNCONDITIONALLY - 
    // an Appendix-E-literal reading misses this because CSS 2.1 predates sticky
    // and treated fixed as merely positioned.
    ((position === 'fixed' || position === 'sticky') && claim(`position:${position}`)) ||
    // CSS 2.1 section 9.9.1 / Position L3: relative|absolute with a used z-index.
    ((position === 'relative' || position === 'absolute') && !zAuto && claim('position+z-index')) ||
    // CSS Flexbox section 5.4 / CSS Grid section 6: a flex/grid ITEM with a non-auto z-index
    // creates a context even at `position: static`.
    (isFlexOrGridItem && claim('flex/grid item + z-index')) ||
    // CSS Color 3 section 3.2: opacity less than 1.
    (Number.parseFloat(s.opacity ?? '1') < 1 && claim('opacity')) ||
    // CSS Transforms 1 section 3 - and the individual transform properties, whose
    // INITIAL value is `none`. TRAP: `scale: 1` / `translate: 0px` are non-initial
    // and DO create a context while `transform` still computes to `none`.
    (set(s.transform) && claim('transform')) ||
    (set(s.translate) && claim('translate')) ||
    (set(s.rotate) && claim('rotate')) ||
    (set(s.scale) && claim('scale')) ||
    // CSS Transforms 2 section 6.
    (set(s.perspective) && claim('perspective')) ||
    (set(s.transformStyle, 'flat') && claim('transform-style')) ||
    // Filter Effects 1 section 7.
    (set(s.filter) && claim('filter')) ||
    (set(s.backdropFilter) && claim('backdrop-filter')) ||
    // Compositing and Blending 1 section 5.1 and section 7.
    (set(s.mixBlendMode, 'normal') && claim('mix-blend-mode')) ||
    (set(s.isolation, 'auto') && claim('isolation')) ||
    // CSS Masking 1 section 7.
    (set(s.clipPath) && claim('clip-path')) ||
    (set(s.maskImage) && claim('mask-image')) ||
    (set(s.webkitMaskImage) && claim('mask-image')) ||
    // CSS Containment 2 section 2. TRAP: `contain: style` alone does NOT create one.
    (CONTAIN_CREATORS.some(k => new RegExp(`(^|\\s)${k}(\\s|$)`).test((s.contain || '').toLowerCase())) && claim('contain')) ||
    (/^(size|inline-size)/.test((s.containerType || '').trim().toLowerCase()) && claim('container-type')) ||
    (/^(auto|hidden)$/.test((s.contentVisibility || '').trim().toLowerCase()) && claim('content-visibility')) ||
    // CSS Will Change section 3. TRAP: `will-change: contents` does not create one;
    // `will-change: opacity` does.
    ((s.willChange || '').toLowerCase().split(',').some(p => WILL_CHANGE_CREATORS.has(p.trim())) && claim('will-change')) ||
    // CSS View Transitions 1 section 3.
    (set(s.viewTransitionName) && claim('view-transition-name'));

  return { createsContext, reason, layer: paintLayer(position, positioned, zAuto, zNum, isFlexOrGridItem, s), z: zNum, order };
}

/**
 * Which layer this element's own paint unit sits in, inside its parent context.
 * (Appendix E section E.2 steps 3, 4, 5, 8 and 9.)
 */
function paintLayer(
  position: string, positioned: boolean, zAuto: boolean, zNum: number,
  isFlexOrGridItem: boolean, s: StackingStyle,
): PaintLayer {
  if (positioned) {
    // Steps 3 / 8 / 9. Note `z-index: auto` on a positioned element lands in
    // layer 6 alongside an explicit 0 - that is the spec, and it is why the
    // walker must treat "positioned" and "creates a context" as different
    // questions (step 8's parenthetical).
    if (!zAuto && zNum < 0) return 2;
    if (!zAuto && zNum > 0) return 7;
    return 6;
  }
  // A static flex/grid item with a non-auto z-index. Flexbox section 5.4 paints items
  // as inline blocks in order-modified document order, sorted by z-index. We map
  // that onto Appendix E's buckets by SIGN only, and deliberately leave `z: 0`
  // in layer 3 (where DOM order already puts it) rather than hoisting it past
  // in-flow siblings - `auto` and `0` compare equal for flex items, so promoting
  // one and not the other would invent an inversion that Chromium does not paint.
  if (isFlexOrGridItem && zNum < 0) return 2;
  if (isFlexOrGridItem && zNum > 0) return 7;
  // Step 5: non-positioned floats. The walker has no float model (it paints
  // floats in tree order); the bucket is assigned so a future float
  // implementation has somewhere to put them, and so that the classification is
  // never silently "whatever's left".
  if (set(s.float, 'none')) return 4;
  return 3;   // step 4: in-flow, non-positioned, block-level
}

/**
 * Ascending stable sort by `z`.
 *
 * Stability IS part of the spec, not an implementation detail: Appendix E section E.2
 * steps 3 and 9 order each layer "in z-index order (most negative first) then
 * tree order". `Array#sort` has been required-stable since ES2019, and every
 * engine this ships on predates that requirement's adoption by years - but the
 * dependency is real and named here.
 *
 * Returns a NEW array; the caller's tree-order array is left alone.
 */
export function sortUnits<T extends { z: number }>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => a.z - b.z);
}

/**
 * Order-modified document order (CSS Flexbox section 5.4, CSS Grid section 6): a flex/grid
 * container paints its items sorted by `order`, ties broken by document order.
 * A non-flex/grid parent must not call this - `order` has no effect there and
 * reordering would be a pure regression.
 */
export function orderModifiedChildren<T>(kids: readonly T[], order: (k: T) => number): T[] {
  const list = kids.slice();
  // Fast path: `order: 0` everywhere (the overwhelming majority) returns the
  // input order untouched, so no allocation-heavy sort runs on every container.
  if (list.every(k => order(k) === 0)) return list;
  return list.sort((a, b) => order(a) - order(b));
}

/** Does this parent `display` make its children flex/grid ITEMS? */
export function isFlexOrGridContainer(display: string | undefined): boolean {
  return /(^|\s)(inline-)?(flex|grid)$/.test((display || '').trim().toLowerCase());
}
