// SPDX-License-Identifier: MPL-2.0
/**
 * The stacking-context classification table (bridge/stacking-order.ts).
 *
 * This suite is the whole defence against the ONE way the paint-order work can
 * make correct output wrong: a MISSED context creator, which lets the walker
 * hoist a node out of a context it should never have left. So there is a row per
 * spec clause in the module, and a row per known trap - the cases where the
 * obvious implementation is silently wrong (`parseInt('auto')`, `contain: style`,
 * `scale: 1` while `transform` reads `none`, `will-change: contents`).
 *
 * Pure node:test - the module takes a plain record of computed values rather
 * than a CSSStyleDeclaration precisely so this needs no browser and runs
 * everywhere, including public CI with no brand pack mounted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stackingRole, sortUnits, orderModifiedChildren, isFlexOrGridContainer,
  type StackingStyle, type PaintLayer,
} from './stacking-order.ts';

/** One table row: a computed-style fragment and what it must classify as. */
interface Row {
  name: string;
  s: StackingStyle;
  parentDisplay?: string;
  topLayer?: boolean;
  ctx: boolean;
  reason?: string;
  layer?: PaintLayer;
  z?: number;
}

const ROWS: Row[] = [
  // ── nothing set: the baseline every ordinary element must hit ──────────────
  { name: 'bare element', s: {}, ctx: false, reason: '', layer: 3, z: 0 },
  { name: 'static + overflow:hidden is NOT a context', s: { position: 'static' }, ctx: false, layer: 3 },
  { name: 'position:relative with z-index:auto is NOT a context',
    s: { position: 'relative', zIndex: 'auto' }, ctx: false, layer: 6, z: 0 },

  // ── positioning (CSS 2.1 section 9.9.1, Position L3 section 9.9.1) ──────────────────────
  { name: 'relative + z-index:5', s: { position: 'relative', zIndex: '5' }, ctx: true, reason: 'position+z-index', layer: 7, z: 5 },
  { name: 'absolute + z-index:-1', s: { position: 'absolute', zIndex: '-1' }, ctx: true, reason: 'position+z-index', layer: 2, z: -1 },
  { name: 'absolute + z-index:0', s: { position: 'absolute', zIndex: '0' }, ctx: true, reason: 'position+z-index', layer: 6, z: 0 },
  { name: 'absolute + z-index:auto → layer 6, no context',
    s: { position: 'absolute', zIndex: 'auto' }, ctx: false, layer: 6, z: 0 },
  { name: 'fixed creates a context unconditionally', s: { position: 'fixed', zIndex: 'auto' }, ctx: true, reason: 'position:fixed', layer: 6 },
  { name: 'sticky creates a context unconditionally', s: { position: 'sticky', zIndex: 'auto' }, ctx: true, reason: 'position:sticky', layer: 6 },

  // ── flex/grid items (Flexbox section 5.4, Grid section 6) ───────────────────────────────
  { name: 'static flex item + z-index:3', s: { position: 'static', zIndex: '3' }, parentDisplay: 'flex',
    ctx: true, reason: 'flex/grid item + z-index', layer: 7, z: 3 },
  { name: 'static grid item + z-index:-2', s: { position: 'static', zIndex: '-2' }, parentDisplay: 'grid',
    ctx: true, reason: 'flex/grid item + z-index', layer: 2, z: -2 },
  { name: 'static inline-flex item + z-index:1', s: { zIndex: '1' }, parentDisplay: 'inline-flex',
    ctx: true, reason: 'flex/grid item + z-index', layer: 7, z: 1 },
  // Deliberate conservatism: z:0 and z:auto compare EQUAL for flex items, so a
  // z:0 item stays in layer 3 where DOM order already puts it. Promoting it
  // would invent an inversion Chromium does not paint.
  { name: 'static flex item + z-index:0 → context but stays in layer 3',
    s: { zIndex: '0' }, parentDisplay: 'flex', ctx: true, reason: 'flex/grid item + z-index', layer: 3, z: 0 },
  { name: 'static child of a BLOCK parent ignores z-index entirely',
    s: { zIndex: '9' }, parentDisplay: 'block', ctx: false, layer: 3, z: 9 },

  // ── property-valued creators ──────────────────────────────────────────────
  { name: 'opacity:0.6', s: { opacity: '0.6' }, ctx: true, reason: 'opacity', layer: 3 },
  { name: 'opacity:1 is not', s: { opacity: '1' }, ctx: false, layer: 3 },
  { name: 'transform matrix', s: { transform: 'matrix(1, 0, 0, 1, 4, 0)' }, ctx: true, reason: 'transform' },
  { name: 'perspective', s: { perspective: '800px' }, ctx: true, reason: 'perspective' },
  { name: 'transform-style:preserve-3d', s: { transformStyle: 'preserve-3d' }, ctx: true, reason: 'transform-style' },
  { name: 'transform-style:flat is not', s: { transformStyle: 'flat' }, ctx: false },
  { name: 'filter:blur', s: { filter: 'blur(2px)' }, ctx: true, reason: 'filter' },
  { name: 'backdrop-filter', s: { backdropFilter: 'blur(8px)' }, ctx: true, reason: 'backdrop-filter' },
  { name: 'mix-blend-mode:multiply', s: { mixBlendMode: 'multiply' }, ctx: true, reason: 'mix-blend-mode' },
  { name: 'mix-blend-mode:normal is not', s: { mixBlendMode: 'normal' }, ctx: false },
  { name: 'isolation:isolate', s: { isolation: 'isolate' }, ctx: true, reason: 'isolation' },
  { name: 'isolation:auto is not', s: { isolation: 'auto' }, ctx: false },
  { name: 'clip-path', s: { clipPath: 'inset(10px)' }, ctx: true, reason: 'clip-path' },
  { name: 'mask-image', s: { maskImage: 'linear-gradient(#000, transparent)' }, ctx: true, reason: 'mask-image' },
  { name: '-webkit-mask-image', s: { webkitMaskImage: 'url(m.svg)' }, ctx: true, reason: 'mask-image' },
  { name: 'container-type:inline-size', s: { containerType: 'inline-size' }, ctx: true, reason: 'container-type' },
  { name: 'container-type:normal is not', s: { containerType: 'normal' }, ctx: false },
  { name: 'content-visibility:auto', s: { contentVisibility: 'auto' }, ctx: true, reason: 'content-visibility' },
  { name: 'content-visibility:visible is not', s: { contentVisibility: 'visible' }, ctx: false },
  { name: 'view-transition-name', s: { viewTransitionName: 'hero' }, ctx: true, reason: 'view-transition-name' },

  // ── floats (Appendix E section E.2 step 5) ───────────────────────────────────────
  { name: 'float:left → layer 4', s: { float: 'left' }, ctx: false, layer: 4 },
  { name: 'float on a POSITIONED box is not a float (position wins)',
    s: { float: 'left', position: 'absolute', zIndex: '2' }, ctx: true, layer: 7, z: 2 },

  // ── top layer ─────────────────────────────────────────────────────────────
  { name: ':modal dialog', s: {}, topLayer: true, ctx: true, reason: 'top-layer' },

  // ── the traps ─────────────────────────────────────────────────────────────
  // parseInt('auto') is NaN; collapsing it to 0 would make EVERY element look
  // like an explicit layer-6 member and hoist the entire page.
  { name: "TRAP z-index:'auto' must not read as an explicit 0",
    s: { position: 'static', zIndex: 'auto' }, ctx: false, layer: 3, z: 0 },
  // CSS Contain 2 section 2: style containment alone creates no stacking context.
  { name: 'TRAP contain:style is NOT a creator', s: { contain: 'style' }, ctx: false },
  { name: 'contain:paint IS', s: { contain: 'paint' }, ctx: true, reason: 'contain' },
  { name: 'contain:layout IS', s: { contain: 'layout' }, ctx: true, reason: 'contain' },
  { name: 'contain:content IS', s: { contain: 'content' }, ctx: true, reason: 'contain' },
  { name: 'contain:strict IS', s: { contain: 'strict' }, ctx: true, reason: 'contain' },
  { name: 'contain:size alone is NOT', s: { contain: 'size' }, ctx: false },
  { name: 'contain:"size style" is NOT', s: { contain: 'size style' }, ctx: false },
  { name: 'contain:"size layout" IS', s: { contain: 'size layout' }, ctx: true, reason: 'contain' },
  // Individual transform properties: INITIAL is `none`, so `scale: 1` is
  // non-initial and creates a context while `transform` still reads `none`.
  { name: 'TRAP scale:1 creates a context though transform is none',
    s: { transform: 'none', scale: '1' }, ctx: true, reason: 'scale' },
  { name: 'TRAP translate:0px creates a context though transform is none',
    s: { transform: 'none', translate: '0px' }, ctx: true, reason: 'translate' },
  { name: 'rotate:none does not', s: { rotate: 'none' }, ctx: false },
  // will-change only pre-empts properties that would themselves create one.
  { name: 'TRAP will-change:contents is NOT a creator', s: { willChange: 'contents' }, ctx: false },
  { name: 'will-change:opacity IS', s: { willChange: 'opacity' }, ctx: true, reason: 'will-change' },
  { name: 'will-change:"top, transform" IS', s: { willChange: 'top, transform' }, ctx: true, reason: 'will-change' },
  { name: 'will-change:auto is NOT', s: { willChange: 'auto' }, ctx: false },
  // A browser that doesn't implement a property reports '' - must read as absent.
  { name: 'unimplemented properties report "" and are not creators',
    s: { transform: '', filter: '', clipPath: '', containerType: '', contentVisibility: '' }, ctx: false },
];

for (const r of ROWS) {
  test(`stackingRole: ${r.name}`, () => {
    const got = stackingRole(r.s, r.parentDisplay ?? '', r.topLayer ?? false);
    assert.equal(got.createsContext, r.ctx, `createsContext (reason=${JSON.stringify(got.reason)})`);
    if (r.reason !== undefined) assert.equal(got.reason, r.reason, 'reason');
    if (r.layer !== undefined) assert.equal(got.layer, r.layer, 'layer');
    if (r.z !== undefined) assert.equal(got.z, r.z, 'z');
  });
}

test('stackingRole: every creator row names a distinct, non-empty reason', () => {
  // A reason of '' on a createsContext:true row would mean the `claim()` chain
  // silently short-circuited - the table would still pass its boolean assertions
  // while telling logs nothing about WHY a subtree stopped hoisting.
  for (const r of ROWS.filter(x => x.ctx)) {
    assert.notEqual(stackingRole(r.s, r.parentDisplay ?? '', r.topLayer ?? false).reason, '', r.name);
  }
});

test('sortUnits: ascending by z, ties keep tree order (Appendix E steps 3 and 9)', () => {
  const items = [
    { z: 40, id: 'a' }, { z: -1, id: 'b' }, { z: 0, id: 'c' },
    { z: 20, id: 'd' }, { z: 0, id: 'e' }, { z: -5, id: 'f' },
  ];
  assert.deepEqual(sortUnits(items).map(i => i.id), ['f', 'b', 'c', 'e', 'd', 'a']);
  // Non-destructive: the caller's tree-order array must survive.
  assert.deepEqual(items.map(i => i.id), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('sortUnits: the measured carousel case - declared 40,30,20 must paint 20,30,40', () => {
  // The real `a.gcar-deck` stack on the gallery fixture: three absolutely
  // positioned siblings whose DOM order is the exact REVERSE of paint order.
  const deck = [{ z: 40, id: 'front' }, { z: 30, id: 'mid' }, { z: 20, id: 'back' }];
  assert.deepEqual(sortUnits(deck).map(i => i.id), ['back', 'mid', 'front']);
});

test('orderModifiedChildren: sorts by order, stable, and no-ops when all zero', () => {
  const kids = [{ o: 0, id: 'a' }, { o: -1, id: 'b' }, { o: 0, id: 'c' }, { o: 2, id: 'd' }];
  assert.deepEqual(orderModifiedChildren(kids, k => k.o).map(k => k.id), ['b', 'a', 'c', 'd']);
  const plain = [{ o: 0, id: 'x' }, { o: 0, id: 'y' }];
  assert.deepEqual(orderModifiedChildren(plain, k => k.o).map(k => k.id), ['x', 'y']);
});

test('isFlexOrGridContainer: matches the four display values and nothing else', () => {
  for (const d of ['flex', 'grid', 'inline-flex', 'inline-grid']) assert.ok(isFlexOrGridContainer(d), d);
  for (const d of ['block', 'inline', 'inline-block', 'flow-root', 'table', '', undefined]) {
    assert.ok(!isFlexOrGridContainer(d), String(d));
  }
});
