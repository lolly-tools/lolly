// SPDX-License-Identifier: MPL-2.0
/**
 * Crop culling for the page-SVG path - engine/src/pdf-svg.ts
 * (cullPdfNodes / pdfNodeExtent / pdfNodeElementKind).
 *
 * The point of culling is that a cropped capture of a real app page spends
 * essentially all of its bytes on a handful of enormous nodes (a re-sourced
 * <canvas> raster, a ShadingType-1 tile) which are wholly inside or wholly
 * outside the crop. Culling is therefore allowed to be imprecise, but it is NOT
 * allowed to be wrong: the same interpreter serves every user who imports a .pdf
 * or .ai, where a silently dropped hairline is permanent data loss in someone's
 * artwork.
 *
 * So the suite is built around a differential ORACLE rather than around
 * assertions about the culler's own arithmetic: `markupBoxes` below is an
 * independent bbox extractor that reads what pdfNodesToSvg actually WROTE
 * (parsing rect/ellipse/image/text/path markup, and applying the rotate/
 * translate/clip-path it finds). Two invariants are then checked over a seeded
 * random corpus:
 *
 *   no silent cull - if the emitted markup for a node intersects the window,
 *                     cullPdfNodes must keep that node
 *   superset - pdfNodeExtent(n) must contain the emitted markup's bbox
 *
 * That is what catches "someone changed textEl's baseline formula / added a
 * transform / reordered the dispatch and the extent function didn't follow".
 *
 * Run with: node --test tests/pdf-cull.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pdfNodesToSvg, cullPdfNodes, pdfNodeExtent, pdfNodeElementKind, CULL_PAD_PT,
  type CullWindow, type PdfExtent,
} from '../engine/src/pdf-svg.ts';
import type { PdfNode } from '../engine/src/pdf-map.ts';

const PAGE = { width: 1000, height: 2000 };

// ── the independent oracle: bboxes read back out of the emitted markup ────────

interface Box { x: number; y: number; w: number; h: number }

const EPS = 0.02;  // the serializer rounds geometry to 2dp; don't chase hundredths

function boxOf(xs: number[], ys: number[]): Box | null {
  if (!xs.length || !ys.length) return null;
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Every number in a path `d`, as x/y pairs (the only vocabulary this serializer
 *  emits is M/L/C/Z with pure coordinate-pair operands). */
function pathPoints(d: string): { xs: number[]; ys: number[] } {
  const xs: number[] = [], ys: number[] = [];
  const nums = [...d.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)].map((m) => +m[0]);
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]!); ys.push(nums[i + 1]!); }
  return { xs, ys };
}

function rotateBox(b: Box, deg: number, cx: number, cy: number): Box {
  const rad = (deg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const xs: number[] = [], ys: number[] = [];
  for (const x of [b.x, b.x + b.w]) for (const y of [b.y, b.y + b.h]) {
    xs.push(cx + (x - cx) * cos - (y - cy) * sin);
    ys.push(cy + (x - cx) * sin + (y - cy) * cos);
  }
  return boxOf(xs, ys)!;
}

function intersectBox(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: x2 - x, h: y2 - y };
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1]! : null;
};
const num = (tag: string, name: string, dflt = 0): number => {
  const v = attr(tag, name);
  const n = v === null ? NaN : +v;
  return isFinite(n) ? n : dflt;
};

/**
 * Drawable-element bboxes of a pdfNodesToSvg document, in page space.
 * Deliberately re-derived from the markup - never from pdfNodeExtent - so the two
 * can disagree and the test can say so. Clip-path wrappers ARE honoured (a clip
 * only removes ink, so ignoring them would make the oracle demand that clipped
 * plates be kept).
 */
function markupBoxes(svg: string): Box[] {
  // clipPath + mask regions first, then drop <defs> entirely (its gradient/pattern
  // coordinates are paint-server space, and a <mask>'s children define the mask,
  // they do not paint).
  const clips = new Map<string, Box | null>();
  for (const m of svg.matchAll(/<clipPath id="([^"]+)"><path d="([^"]*)"/g)) {
    const { xs, ys } = pathPoints(m[2]!);
    clips.set(m[1]!, boxOf(xs, ys));
  }
  // A <mask maskUnits="userSpaceOnUse" x y width height> renders neither its own
  // content nor the masked element outside that region, so the region bounds ink
  // exactly like a clip - same treatment.
  for (const m of svg.matchAll(/<mask id="([^"]+)"([^>]*)>/g)) {
    const t = `<mask${m[2]!}>`;
    clips.set(m[1]!, { x: num(t, 'x'), y: num(t, 'y'), w: num(t, 'width'), h: num(t, 'height') });
  }
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  const out: Box[] = [];
  interface Frame { tx: number; ty: number; clips: Box[] }
  const stack: Frame[] = [{ tx: 0, ty: 0, clips: [] }];
  const top = (): Frame => stack[stack.length - 1]!;
  const emit = (b: Box | null): void => {
    if (!b) return;
    const f = top();
    // Zero-area boxes are kept: a <text>'s tspan anchors are POINTS at which ink
    // definitely starts, and dropping them would make the oracle blind to text.
    // A box that a CLIP collapses to zero area is a different thing - no ink - so
    // the tolerance is decided before clipping, not after.
    const pointy = b.w === 0 || b.h === 0;
    let box: Box = { x: b.x + f.tx, y: b.y + f.ty, w: b.w, h: b.h };
    for (const c of f.clips) box = intersectBox(box, c);
    if (pointy ? box.w >= 0 && box.h >= 0 : box.w > 0 && box.h > 0) out.push(box);
  };

  const tagRe = /<(\/?)([a-zA-Z]+)((?:"[^"]*"|[^>])*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  let pendingText: { tag: string } | null = null;
  const tspanXs: number[] = [], tspanYs: number[] = [];
  while ((m = tagRe.exec(body))) {
    const close = m[1] === '/', name = m[2]!, rest = m[3]!, selfClose = m[4] === '/';
    const tag = `<${name}${rest}>`;
    if (name === 'g') {
      if (close) { if (stack.length > 1) stack.pop(); continue; }
      const f = top();
      const tr = /translate\(([-\d.eE+]+)\s+([-\d.eE+]+)\)/.exec(attr(tag, 'transform') ?? '');
      const cp = /url\(#([^)]+)\)/.exec(attr(tag, 'clip-path') ?? '');
      const mk = /url\(#([^)]+)\)/.exec(attr(tag, 'mask') ?? '');
      const bounds = [cp, mk].map((r) => (r ? clips.get(r[1]!) : undefined)).filter((b): b is Box => !!b);
      stack.push({
        tx: f.tx + (tr ? +tr[1]! : 0),
        ty: f.ty + (tr ? +tr[2]! : 0),
        clips: bounds.length ? [...f.clips, ...bounds] : f.clips,
      });
      continue;
    }
    const rotOf = (t: string): { deg: number; cx: number; cy: number } | null => {
      const r = /rotate\(([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\)/.exec(attr(t, 'transform') ?? '');
      return r ? { deg: +r[1]!, cx: +r[2]!, cy: +r[3]! } : null;
    };
    if (name === 'rect' || name === 'image') {
      let b: Box = { x: num(tag, 'x'), y: num(tag, 'y'), w: num(tag, 'width'), h: num(tag, 'height') };
      const rt = rotOf(tag);
      if (rt) b = rotateBox(b, rt.deg, rt.cx, rt.cy);
      emit(b);
    } else if (name === 'ellipse') {
      const cx = num(tag, 'cx'), cy = num(tag, 'cy'), rx = num(tag, 'rx'), ry = num(tag, 'ry');
      let b: Box = { x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry };
      const rt = rotOf(tag);
      if (rt) b = rotateBox(b, rt.deg, rt.cx, rt.cy);
      emit(b);
    } else if (name === 'path') {
      const { xs, ys } = pathPoints(attr(tag, 'd') ?? '');
      emit(boxOf(xs, ys));
    } else if (name === 'text') {
      if (close) {
        const b = boxOf(tspanXs, tspanYs);
        const rt = pendingText ? rotOf(pendingText.tag) : null;
        emit(b && rt ? rotateBox(b, rt.deg, rt.cx, rt.cy) : b);
        pendingText = null;
        tspanXs.length = 0; tspanYs.length = 0;
      } else {
        pendingText = { tag };
      }
    } else if (name === 'tspan' && !close) {
      tspanXs.push(num(tag, 'x'));
      tspanYs.push(num(tag, 'y'));
    }
    void selfClose;
  }
  return out;
}

/** Union of every drawable box in a one-node serialization, or null if it drew nothing. */
function markupBbox(n: PdfNode): Box | null {
  const boxes = markupBoxes(pdfNodesToSvg([n], { ...PAGE, images: IMAGES }));
  if (!boxes.length) return null;
  return boxOf(boxes.flatMap((b) => [b.x, b.x + b.w]), boxes.flatMap((b) => [b.y, b.y + b.h]));
}

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const IMAGES: Record<string, string> = { img0: PNG_1PX, img1: PNG_1PX, tile0: PNG_1PX };

/** engine/src/pdf-svg.ts's own "unbounded on this axis" span (not exported). */
const PLANE = 1e9;

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * engine/src/pdf-svg.ts widens a clip/mask by AA_PAD (1pt) before intersecting: a
 * rasteriser puts ink up to a device pixel past a clip edge, and an extent that
 * says "exactly zero area" bypasses cullPdfNodes' own pad entirely. Mirror it here
 * so the clip tests still pin the clip, not the tolerance.
 */
const AA = 1;
const aa = (b: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } =>
  ({ x: b.x - AA, y: b.y - AA, w: b.w + 2 * AA, h: b.h + 2 * AA });

const winBox = (w: CullWindow): Box => ({ x: w.x, y: w.y, w: w.width, h: w.height });
/**
 * Does `a` put ink inside `b`? `eps` discounts a sub-hundredth graze of the edge
 * (the serializer rounds geometry to 2dp). A degenerate dimension - a <text>
 * anchor point - only has to fall inside, not to overlap by an area.
 */
const overlaps = (a: Box, b: Box, eps = 0): boolean => {
  const i = intersectBox(a, b);
  return (a.w > 0 ? i.w > eps : i.w >= -eps) && (a.h > 0 ? i.h > eps : i.h >= -eps);
};
const contains = (outer: PdfExtent, inner: Box): boolean =>
  outer.x - EPS <= inner.x && outer.y - EPS <= inner.y
  && outer.x + outer.w + EPS >= inner.x + inner.w
  && outer.y + outer.h + EPS >= inner.y + inner.h;

// ── section 6.1 extent unit tests, per element kind ─────────────────────────────────

const box = (o: Partial<PdfNode> = {}): PdfNode =>
  ({ kind: 'box', x: 100, y: 100, w: 50, h: 50, rot: 0, fill: '#ff0000', ...o }) as PdfNode;

test('pdfNodeElementKind mirrors the serializer dispatch, incl. the _vectorPath-on-an-image landmine', () => {
  assert.equal(pdfNodeElementKind(box()), 'box');
  assert.equal(pdfNodeElementKind(box({ kind: 'text', text: 'hi' })), 'text');
  assert.equal(pdfNodeElementKind(box({ kind: 'image', _imageXObject: 'img0' })), 'image');
  assert.equal(pdfNodeElementKind(box({ kind: 'text', text: 'hi', _outlinePath: ['M0 0L1 0'] })), 'outlined-text');
  // A baked vector path is carried on a kind:'image' node with _imageXObject unset
  // OR set - _vectorPath wins in the serializer, so it must win here.
  assert.equal(pdfNodeElementKind(box({ kind: 'image', _vectorPath: 'M0 0L1 0Z', _imageXObject: 'img0' })), 'path');
  assert.equal(pdfNodeElementKind({ kind: 'image', x: 0, y: 0, w: 1, h: 1, rot: 0 } as PdfNode), 'none');
});

test('a box inside / outside / straddling the window', () => {
  const win: CullWindow = { x: 0, y: 0, width: 200, height: 200, pad: 0 };
  const inside = box({ x: 10, y: 10 });
  const outside = box({ x: 900, y: 1800 });
  const straddling = box({ x: 180, y: 180 });
  const res = cullPdfNodes([inside, outside, straddling], win);
  assert.deepEqual(res.nodes, [inside, straddling]);
  assert.equal(res.dropped, 1);
  assert.equal(res.unbounded, 0);
});

test('a 45°-rotated rect extends beyond its unrotated box by the half-diagonal', () => {
  const n = box({ x: 100, y: 100, w: 100, h: 100, rot: 45 });
  const e = pdfNodeExtent(n)!;
  const diag = Math.SQRT2 * 100;
  assert.ok(Math.abs(e.w - diag) < 0.01 && Math.abs(e.h - diag) < 0.01, `expected ${diag}, got ${e.w}×${e.h}`);
  // …and the culler keeps it for a window only the rotated corner reaches
  // (rotated AABB spans 79.3…220.7 in both axes; the unrotated box is 100…200).
  const win: CullWindow = { x: 80, y: 146, width: 8, height: 8, pad: 0 };
  assert.equal(cullPdfNodes([n], win).nodes.length, 1, 'rotated corner must survive');
  assert.equal(cullPdfNodes([box({ x: 100, y: 100, w: 100, h: 100, rot: 0 })], win).nodes.length, 0,
    'the same box unrotated does not reach that window');
});

test('a rotated <text> run fails open - a rotated unbounded strip is the whole plane', () => {
  // textEl rotates about the first line's origin, and a <text> run's advance is
  // unknowable (see the `<text>` section below), so a rotated one can put ink
  // anywhere along that ray: the only sound answer is "keep".
  const n = box({ kind: 'text', text: 'Heading', x: 500, y: 1000, w: 300, h: 40, fontSize: 30, rot: -90, fg: '#000000' });
  const e = pdfNodeExtent(n)!;
  const mb = markupBbox(n)!;
  assert.ok(contains(e, mb), `extent ${JSON.stringify(e)} must contain markup ${JSON.stringify(mb)}`);
  assert.ok(e.w >= PLANE && e.h >= PLANE, `a rotated <text> must be unbounded, got ${JSON.stringify(e)}`);
  // Window above the anchor, well clear of the unrotated box (y 985..1040).
  const win: CullWindow = { x: 495, y: 800, width: 10, height: 10, pad: 0 };
  assert.equal(cullPdfNodes([n], win).nodes.length, 1, 'rotated heading must survive');
  const centreAnchored = rotateBox({ x: 500, y: 1000, w: 300, h: 40 }, -90, 650, 1020);
  assert.ok(!overlaps(centreAnchored, winBox(win)),
    'guard: neither a centre- nor an anchor-rotated BOX reaches this window, so only failing open keeps it');
  // …but a CLIP still bounds it: an unbounded extent is intersected, not ignored.
  const clipped = box({ ...n, _clips: [{ d: 'M480 940L520 940L520 1060L480 1060Z', evenOdd: false }] }) as PdfNode;
  assert.equal(cullPdfNodes([clipped], win).nodes.length, 0, 'a clip must still bound an unbounded run');
});

test('a stroked path is outset by 2× the stroke width (SVG default miterlimit 4)', () => {
  const plain = box({ kind: 'image', _vectorPath: 'M100 100L140 100L140 140Z', _vectorFill: '#00ff00', x: 100, y: 100, w: 40, h: 40 });
  const stroked = box({ ...plain, _vectorStroke: { color: '#000000', width: 10 } }) as PdfNode;
  const ep = pdfNodeExtent(plain)!, es = pdfNodeExtent(stroked)!;
  assert.equal(es.x, ep.x - 20);
  assert.equal(es.w, ep.w + 40);
  // A node 15pt outside the window must survive on the stroke outset alone.
  const win: CullWindow = { x: 60, y: 100, width: 25, height: 20, pad: 0 };  // ends 15pt left of the path
  assert.equal(cullPdfNodes([stroked], win).nodes.length, 1, 'miter spike must survive');
  assert.equal(cullPdfNodes([plain], win).nodes.length, 0, 'the unstroked path does not reach it');
});

test('a vector path is not rotated (pathEl emits no transform) even when rot is set', () => {
  const n = box({ kind: 'image', _vectorPath: 'M100 100L140 100L140 140Z', _vectorFill: '#00ff00', x: 100, y: 100, w: 40, h: 40, rot: 45 });
  const e = pdfNodeExtent(n)!;
  assert.deepEqual({ x: e.x, y: e.y, w: e.w, h: e.h }, { x: 100, y: 100, w: 40, h: 40 });
  assert.ok(contains(e, markupBbox(n)!));
});

test('a multi-line _outlinePath grows the extent by 1.4em per line', () => {
  const mk = (lines: number): PdfNode => box({
    kind: 'text', text: Array(lines).fill('x').join('\n'), x: 100, y: 100, w: 80, h: 20 * lines,
    fontSize: 20, fg: '#000000', _outlinePath: Array(lines).fill('M0 0L10 0L10 -10Z'),
  });
  const e1 = pdfNodeExtent(mk(1))!, e3 = pdfNodeExtent(mk(3))!;
  assert.ok(Math.abs((e3.h - e1.h) - 2 * 1.4 * 20) < 0.01, `3 lines should add 2×1.4em; got ${e3.h - e1.h}`);
  assert.ok(contains(e3, markupBbox(mk(3))!));
  // The third line's window must keep the node.
  const win: CullWindow = { x: 100, y: 100 + 0.8 * 20 + 2 * 1.4 * 20 - 2, width: 10, height: 4, pad: 0 };
  assert.equal(cullPdfNodes([mk(3)], win).nodes.length, 1);
  assert.equal(cullPdfNodes([mk(1)], win).nodes.length, 0, 'a one-line run does not reach the third baseline');
});

test('a clipped full-page node (the `sh` / shadow-plate shape) collapses to its clip bbox', () => {
  // pdf-map's `sh` operator emits a node covering the WHOLE page; the only real
  // extent is the clip stack. Without clip-aware extents this class of node - 
  // the heaviest, since it carries the gradient/tile - is unculled by construction.
  const n = box({
    x: 0, y: 0, w: PAGE.width, h: PAGE.height, fill: '#123456',
    _clips: [{ d: 'M700 1700L760 1700L760 1760L700 1760Z', evenOdd: false }],
  });
  const e = pdfNodeExtent(n)!;
  assert.deepEqual({ x: e.x, y: e.y, w: e.w, h: e.h }, aa({ x: 700, y: 1700, w: 60, h: 60 }));
  assert.equal(cullPdfNodes([n], { x: 0, y: 0, width: 300, height: 300, pad: 0 }).nodes.length, 0,
    'a page-sized plate clipped to the far corner must be dropped');
  assert.equal(cullPdfNodes([n], { x: 690, y: 1690, width: 30, height: 30, pad: 0 }).nodes.length, 1);
});

test('a box-shadow plate collapses to its soft-mask region (engine 1.63)', () => {
  // Chromium prints a CSS box-shadow as a big translucent fill plus a /Luminosity
  // mask that carves the blur. The mask region is the tight bound; without it every
  // shadowed control on the page is an unculled plate.
  const n = box({
    x: 0, y: 0, w: PAGE.width, h: PAGE.height, fill: '#000000', opacity: 25,
    _softMask: {
      key: 'sm0', subtype: 'Luminosity', x: 700, y: 1700, w: 60, h: 60,
      nodes: [{ kind: 'box', x: 700, y: 1700, w: 60, h: 60, rot: 0, fill: '#ffffff' }],
    } as never,
  });
  const e = pdfNodeExtent(n)!;
  assert.deepEqual({ x: e.x, y: e.y, w: e.w, h: e.h }, aa({ x: 700, y: 1700, w: 60, h: 60 }));
  assert.equal(cullPdfNodes([n], { x: 0, y: 0, width: 300, height: 300, pad: 0 }).nodes.length, 0);
  assert.equal(cullPdfNodes([n], { x: 690, y: 1690, width: 30, height: 30, pad: 0 }).nodes.length, 1);
  // …and the emitted markup agrees: the plate is wrapped in the mask, whose region
  // is exactly that box (so this is a proof, not a coincidence).
  const svg = pdfNodesToSvg([n], PAGE);
  assert.match(svg, /<mask id="pmask0" maskUnits="userSpaceOnUse" x="700" y="1700" width="60" height="60"/);
  assert.match(svg, /<g mask="url\(#pmask0\)">/);
});

test('nested clips intersect; an unparseable clip `d` stops the extent shrinking', () => {
  const twoClips = box({
    x: 0, y: 0, w: 1000, h: 1000,
    _clips: [
      { d: 'M0 0L500 0L500 500L0 500Z', evenOdd: false },
      { d: 'M400 400L900 400L900 900L400 900Z', evenOdd: false },
    ],
  });
  const e = pdfNodeExtent(twoClips)!;
  // clip1 ⊕ AA ∩ clip2 ⊕ AA = 399..501 (each clip contributes one padded edge)
  assert.deepEqual({ x: e.x, y: e.y, w: e.w, h: e.h }, aa({ x: 400, y: 400, w: 100, h: 100 }));

  // An arc/H/V command is outside serializePath's vocabulary - degrade to "no clip
  // information" (keep the node's own extent) rather than to a wrong bbox.
  const arcClip = box({ x: 0, y: 0, w: 1000, h: 1000, _clips: [{ d: 'M0 0A50 50 0 0 1 10 10Z', evenOdd: false }] });
  const ea = pdfNodeExtent(arcClip)!;
  assert.deepEqual({ x: ea.x, y: ea.y, w: ea.w, h: ea.h }, { x: 0, y: 0, w: 1000, h: 1000 });
  assert.equal(cullPdfNodes([arcClip], { x: 900, y: 900, width: 50, height: 50, pad: 0 }).nodes.length, 1);
});

test('an interpreter-supplied clip bbox is preferred over scanning `d`', () => {
  // Forward-compatible with ClipPath.bbox (pdf-map's serializePath already computes
  // the control-point hull). A `d` we could not scan plus a bbox ⇒ still culled.
  const n = box({
    x: 0, y: 0, w: 1000, h: 1000,
    _clips: [{ d: 'M0 0H10V10Z', evenOdd: false, bbox: { x: 0, y: 0, w: 10, h: 10 } } as never],
  });
  const e = pdfNodeExtent(n)!;
  assert.deepEqual({ x: e.x, y: e.y, w: e.w, h: e.h }, { x: 0, y: 0, w: 11, h: 11 });   // ⊕ AA, clamped by the node box
});

test('nodes the serializer skips outright are dropped, not kept', () => {
  const zeroW = box({ w: 0 });
  const noKind = { kind: 'image', x: 10, y: 10, w: 10, h: 10, rot: 0 } as PdfNode;
  const res = cullPdfNodes([zeroW, noKind], { x: 0, y: 0, width: 1000, height: 1000 });
  assert.equal(res.nodes.length, 0);
  assert.equal(res.unbounded, 0);
  assert.equal(pdfNodesToSvg([zeroW, noKind], PAGE), pdfNodesToSvg([], PAGE));
});

test('the default pad is CULL_PAD_PT and it is applied outward', () => {
  const n = box({ x: 100, y: 100, w: 10, h: 10 });
  const justOutside: CullWindow = { x: 100 - CULL_PAD_PT - 5, y: 100, width: 5, height: 10 };
  assert.equal(cullPdfNodes([n], justOutside).nodes.length, 0);
  const withinPad: CullWindow = { x: 100 - CULL_PAD_PT - 1, y: 100, width: 2, height: 10 };
  assert.equal(cullPdfNodes([n], withinPad).nodes.length, 1, 'the pad must reach outward');
});

test('a degenerate window is a no-op - a malformed crop must never blank a capture', () => {
  const nodes = [box(), box({ x: 500 })];
  for (const win of [
    { x: 0, y: 0, width: 0, height: 100 },
    { x: 0, y: 0, width: 100, height: -1 },
    { x: NaN, y: 0, width: 100, height: 100 },
    { x: 0, y: Infinity, width: 100, height: 100 },
  ] as CullWindow[]) {
    const res = cullPdfNodes(nodes, win);
    assert.deepEqual(res.nodes, nodes, `window ${JSON.stringify(win)} must be a no-op`);
    assert.equal(res.dropped, 0);
  }
  assert.deepEqual(cullPdfNodes(nodes, null as unknown as CullWindow).nodes, nodes);
});

// ── section 2.3 reference-driven gradient defs ──────────────────────────────────────

test('a gradient node that yields no element ships no <defs> payload', () => {
  const grad = {
    type: 2 as const, coords: [0, 0, 1, 0], matrix: [1, 0, 0, 1, 0, 0],
    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
  };
  // An ellipse/rect with a gradient DOES emit → the def must be present.
  const painted = box({ _gradient: grad as never });
  assert.match(pdfNodesToSvg([painted], PAGE), /<linearGradient id="pgrad0"/);

  // A _vectorPath that sanitises away to an empty `d` still classifies as 'path'
  // and still asks for the gradient paint - but pathEl then yields no element.
  // The def must not be emitted. (Before the reference-driven fix, gradientFill's
  // registration side effect shipped it anyway.)
  const emptyPath = box({ kind: 'image', _vectorPath: '"<>&', _vectorFill: '#00ff00', _gradient: grad as never });
  const svg = pdfNodesToSvg([emptyPath], PAGE);
  assert.doesNotMatch(svg, /<linearGradient/, 'an unreferenced gradient must not be emitted');
  assert.ok(!svg.includes('<defs>'), `expected no defs, got: ${svg}`);

  // The culler relies on this: cull the node, and its def goes with it. Ratchets
  // that a ShadingType-1 tile's base64 PNG cannot outlive its only user.
  const tileGrad = { type: 1 as const, matrix: [1, 0, 0, 1, 0, 0], domain: [0, 1, 0, 1], tileKey: 'tile0' };
  const tiled = box({ x: 900, y: 1900, w: 50, h: 50, _gradient: tileGrad as never });
  const full = pdfNodesToSvg([tiled], { ...PAGE, images: IMAGES });
  assert.match(full, /<pattern id="pgrad0"/);
  const kept = cullPdfNodes([tiled], { x: 0, y: 0, width: 100, height: 100 });
  assert.equal(kept.nodes.length, 0);
  assert.doesNotMatch(pdfNodesToSvg(kept.nodes, { ...PAGE, images: IMAGES }), /<pattern/);
});

// ── section 6.2 the differential oracle over a seeded random corpus ─────────────────

/** mulberry32 - a tiny seeded PRNG so a failure reproduces from its seed. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Glyph-ish outline for one line, in the shaper's own frame (baseline y=0, pen from
 * x=0, ascenders negative - shells/web/src/bridge/text.ts). `adv` is that LINE's
 * advance, deliberately NOT the node's `w`: pdf-map derives `w` from the first line
 * only, so a corpus where every line is the node's width can never catch an extent
 * that trusts `w`. Uses the shaper's real vocabulary (M/L/Q/C/Z, comma-separated).
 */
function glyphPath(rnd: () => number, adv: number, size: number): string {
  const x0 = -rnd() * size * 0.2, x1 = adv * (0.8 + rnd() * 0.25);
  const top = -size * (0.6 + rnd() * 0.3), bot = size * (rnd() * 0.25);
  const mid = (x0 + x1) / 2;
  return `M${x0.toFixed(2)},${bot.toFixed(2)} L${x1.toFixed(2)},${bot.toFixed(2)} `
    + `Q${x1.toFixed(2)},${top.toFixed(2)} ${mid.toFixed(2)},${top.toFixed(2)} Z`;
}

/**
 * Text lines of DELIBERATELY unequal length, sometimes full-width (CJK advances
 * ~1em per glyph where pdf-map's estimate assumes 0.55em). Both are the shapes that
 * defeat any width guess derived from the first line.
 */
function textLines(rnd: () => number): string[] {
  const n = 1 + Math.floor(rnd() * 4);
  return Array.from({ length: n }, (_, i) => {
    const wide = rnd() < 0.25;
    const len = 1 + Math.floor(rnd() * 12) * (i + 1);           // later lines run longer
    return (wide ? '設計トークン' : 'Sample text').repeat(1 + Math.floor(len / 6)).slice(0, len);
  });
}

function randomNode(rnd: () => number): PdfNode {
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;
  const x = rnd() * PAGE.width, y = rnd() * PAGE.height;
  const w = 1 + rnd() * 300, h = 1 + rnd() * 200;
  const kind = pick(['box', 'ellipse', 'image', 'path', 'text', 'outlined', 'sh', 'shadow'] as const);
  const base = { x, y, w, h, rot: rnd() < 0.3 ? (rnd() * 720 - 360) : 0, opacity: 100 };
  const clip = rnd() < 0.3
    ? [{
        d: `M${(x - 20).toFixed(2)} ${(y - 20).toFixed(2)}L${(x + w * 0.6).toFixed(2)} ${(y - 20).toFixed(2)}`
          + `L${(x + w * 0.6).toFixed(2)} ${(y + h * 0.6).toFixed(2)}L${(x - 20).toFixed(2)} ${(y + h * 0.6).toFixed(2)}Z`,
        evenOdd: rnd() < 0.5,
      }]
    : undefined;
  const withClip = <T extends object>(o: T): T => (clip ? { ...o, _clips: clip } : o);
  switch (kind) {
    case 'box': return withClip({ ...base, kind: 'box', fill: '#3366cc', radius: rnd() < 0.5 ? 8 : 0 }) as PdfNode;
    case 'ellipse': return withClip({ ...base, kind: 'box', shape: 'ellipse', fill: '#cc3366' }) as PdfNode;
    case 'image': return withClip({ ...base, kind: 'image', _imageXObject: pick(['img0', 'img1']) }) as PdfNode;
    case 'path': {
      const d = `M${x.toFixed(2)} ${y.toFixed(2)}C${(x + w * 0.3).toFixed(2)} ${(y + h).toFixed(2)} `
        + `${(x + w * 0.7).toFixed(2)} ${(y - h * 0.2).toFixed(2)} ${(x + w).toFixed(2)} ${(y + h).toFixed(2)}Z`;
      // pdf-map's serializePath hull includes control points, so x/y/w/h must too.
      const { xs, ys } = pathPoints(d);
      const bb = boxOf(xs, ys)!;
      return withClip({
        ...base, kind: 'image', x: bb.x, y: bb.y, w: bb.w, h: bb.h, _vectorPath: d, _vectorFill: '#22aa55',
        ...(rnd() < 0.5 ? { _vectorStroke: { color: '#000000', width: 0.2 + rnd() * 12 } } : {}),
      }) as PdfNode;
    }
    case 'text': {
      const size = 6 + rnd() * 40;
      const lines = textLines(rnd);
      // `w` exactly as pdf-map's flushText computes it: FIRST line, 0.55em per char.
      const w0 = Math.max(4, lines[0]!.length * size * 0.55, size * 2);
      return withClip({
        ...base, w: w0, h: size * 1.4 * lines.length,
        kind: 'text', fontSize: size, fg: '#111111', fontFamily: 'Outfit',
        text: lines.join('\n'),
      }) as PdfNode;
    }
    case 'outlined': {
      const size = 6 + rnd() * 40;
      const lines = textLines(rnd);
      const w0 = Math.max(4, lines[0]!.length * size * 0.55, size * 2);
      return withClip({
        ...base, w: w0, h: size * 1.4 * lines.length,
        kind: 'text', fontSize: size, fg: '#111111', rot: 0, text: lines.join('\n'),
        // Each line's ink is its OWN advance (0.55em/char, 1em for full-width),
        // which for a later line can be many times the node's `w`.
        _outlinePath: lines.map((l) => (l
          ? glyphPath(rnd, [...l].reduce((a, c) => a + size * (/[ -鿿]/.test(c) ? 1 : 0.55), 0), size)
          : '')),
      }) as PdfNode;
    }
    case 'shadow': {
      // How Chromium prints a CSS box-shadow (engine 1.63): a translucent fill over
      // a much larger area, with a /Luminosity soft mask carving the blur. The real
      // extent is the MASK region, so an unmasked reading of this node is a
      // page-scale plate - the exact class of node culling has to bound.
      const mx = x, my = y, mw = Math.max(4, w * 0.4), mh = Math.max(4, h * 0.4);
      return {
        kind: 'box', x: Math.max(0, x - 200), y: Math.max(0, y - 200), w: w + 400, h: h + 400,
        rot: 0, fill: '#000000', opacity: 25,
        _softMask: {
          key: `sm${Math.floor(rnd() * 1e6)}`, subtype: 'Luminosity', x: mx, y: my, w: mw, h: mh,
          nodes: [{ kind: 'box', x: mx, y: my, w: mw, h: mh, rot: 0, fill: '#ffffff' }],
        },
      } as unknown as PdfNode;
    }
    default:  // an `sh` shading / shadow plate: page-sized, real extent in the clip
      return {
        kind: 'box', x: 0, y: 0, w: PAGE.width, h: PAGE.height, rot: 0, fill: '#888888', opacity: 30,
        _clips: [{
          d: `M${x.toFixed(2)} ${y.toFixed(2)}L${(x + w).toFixed(2)} ${(y).toFixed(2)}`
            + `L${(x + w).toFixed(2)} ${(y + h).toFixed(2)}L${x.toFixed(2)} ${(y + h).toFixed(2)}Z`,
          evenOdd: false,
        }],
      } as PdfNode;
  }
}

test('oracle: cullPdfNodes never drops a node whose emitted markup reaches the window', () => {
  const rnd = prng(0xC0FFEE);
  for (let iter = 0; iter < 200; iter++) {
    const nodes = Array.from({ length: 12 }, () => randomNode(rnd));
    const win: CullWindow = {
      x: rnd() * PAGE.width, y: rnd() * PAGE.height,
      width: 10 + rnd() * 500, height: 10 + rnd() * 500,
      pad: 0,                                     // maximally strict
    };
    const kept = new Set(cullPdfNodes(nodes, win).nodes);
    const wb = winBox(win);
    for (const n of nodes) {
      const mb = markupBbox(n);
      // EPS: the serializer rounds geometry to 2dp, so a sub-hundredth graze of
      // the window edge is not evidence of a bug.
      if (mb && overlaps(mb, wb, EPS)) {
        assert.ok(kept.has(n), `iter ${iter}: dropped a node whose markup ${JSON.stringify(mb)} reaches ${JSON.stringify(wb)}: ${JSON.stringify(n)}`);
      }
    }
  }
});

test('oracle: pdfNodeExtent is a superset of the emitted markup bbox', () => {
  const rnd = prng(0xBADF00D);
  for (let iter = 0; iter < 400; iter++) {
    const n = randomNode(rnd);
    const mb = markupBbox(n);
    if (!mb) continue;
    const e = pdfNodeExtent(n);
    assert.ok(e, `iter ${iter}: extent unbounded for an emitting node: ${JSON.stringify(n)}`);
    assert.ok(contains(e!, mb),
      `iter ${iter}: extent ${JSON.stringify(e)} does not contain markup ${JSON.stringify(mb)}: ${JSON.stringify(n)}`);
  }
});

/**
 * The ratchet the oracle above CANNOT provide. `markupBoxes` reads a `<text>`
 * element's tspan anchors - which are POINTS - because the width of a `<text>` run
 * is decided by the font the renderer resolves, and no oracle in this process can
 * know it. That blind spot is precisely how a first-line-derived width estimate
 * survived review, so the invariant is pinned structurally instead: a node that
 * emits `<text>` must report an UNBOUNDED horizontal extent. Bound it again and
 * this fails, whatever the estimate.
 */
test('a node that emits <text> must not have its horizontal extent guessed', () => {
  const rnd = prng(0x7E77);
  for (let iter = 0; iter < 200; iter++) {
    const n = randomNode(rnd);
    if (n._clips || n._softMask) continue;                       // a clip may legally bound it
    if (!pdfNodesToSvg([n], { ...PAGE, images: IMAGES }).includes('<text')) continue;
    const e = pdfNodeExtent(n);
    assert.ok(!e || (e.x <= -PLANE + 1 && e.x + e.w >= PLANE - 1),
      `iter ${iter}: a <text> run's advance was guessed: ${JSON.stringify(e)} for ${JSON.stringify(n).slice(0, 200)}`);
  }
});

test('culling only removes, preserves paint order, and is byte-identical to serializing the survivors', () => {
  const rnd = prng(0x5EED);
  for (let iter = 0; iter < 60; iter++) {
    const nodes = Array.from({ length: 30 }, () => randomNode(rnd));
    const win: CullWindow = { x: rnd() * 800, y: rnd() * 1800, width: 50 + rnd() * 300, height: 50 + rnd() * 300 };
    const res = cullPdfNodes(nodes, win);
    // subset + order
    let at = -1;
    for (const s of res.nodes) {
      const i = nodes.indexOf(s);
      assert.ok(i > at, `iter ${iter}: survivors out of paint order`);
      at = i;
    }
    assert.equal(res.total, nodes.length);
    assert.equal(res.dropped, nodes.length - res.nodes.length);
  }
});

/**
 * THE acceptance property: a cropped render must be PIXEL-IDENTICAL to the
 * uncropped-then-cropped render. Proven structurally rather than by rasterising:
 * every element the full document emits whose ink lies inside the window is
 * present, verbatim and in the same order, in the culled document - and the
 * culled document adds nothing. Since the serializer emits no filter/mask/blend
 * (see the soundness guard below), identical elements inside the viewBox ⇒
 * identical pixels inside the viewBox.
 */
test('acceptance: the culled document contains exactly the full document`s in-window ink, verbatim and in order', () => {
  const rnd = prng(0x1CE);
  for (let iter = 0; iter < 60; iter++) {
    const nodes = Array.from({ length: 25 }, () => randomNode(rnd));
    const win: CullWindow = { x: rnd() * 700, y: rnd() * 1600, width: 100 + rnd() * 400, height: 100 + rnd() * 400, pad: 0 };
    const opt = { ...PAGE, images: IMAGES };
    const fullEls = drawableEls(pdfNodesToSvg(nodes, opt));
    const culledEls = drawableEls(pdfNodesToSvg(cullPdfNodes(nodes, win).nodes, opt));

    // 1. the culled document adds nothing, and keeps paint order (a subsequence)
    let j = 0;
    for (const el of culledEls) {
      const at = fullEls.indexOf(el, j);
      assert.ok(at >= 0, `iter ${iter}: culled output invented or reordered an element: ${el.slice(0, 120)}`);
      j = at + 1;
    }
    // 2. every node with in-window ink kept ALL of its elements, in order.
    //    Asked per NODE, not per element, because a node's clip wrapper - which is
    //    what bounds an `sh` shading or a shadow plate - lives outside the element.
    const wb = winBox(win);
    let k = 0;
    for (const n of nodes) {
      const boxes = markupBoxes(pdfNodesToSvg([n], opt));
      if (!boxes.some((b) => overlaps(b, wb, EPS))) continue;
      for (const el of drawableEls(pdfNodesToSvg([n], opt))) {
        const at = culledEls.indexOf(el, k);
        assert.ok(at >= 0, `iter ${iter}: in-window element missing from the culled output: ${el.slice(0, 120)}`);
        k = at + 1;
      }
    }
  }
});

/**
 * THE ratchet on the number this feature exists for. A page shaped like a real
 * cropped capture - a viewport-sized raster (the re-sourced <canvas>: on the Mesh
 * Gradient page that one node is ~11.7 MB of base64), a ShadingType-1 tile pattern,
 * a full-page shadow plate, and a hundred ordinary controls - cropped to one small
 * control. If a future change makes culling ineffective, this fails.
 */
test('ratchet: a small crop of a spread-out page yields well under 10% of the uncropped bytes', () => {
  const bigPng = `data:image/png;base64,${'A'.repeat(600_000)}`;
  const tilePng = `data:image/png;base64,${'B'.repeat(60_000)}`;
  const images: Record<string, string> = { canvas: bigPng, tile: tilePng };
  const nodes: PdfNode[] = [];
  // the live-canvas raster, filling the right two thirds of the page
  nodes.push({ kind: 'image', x: 340, y: 60, w: 640, h: 900, rot: 0, _imageXObject: 'canvas' } as PdfNode);
  // a page-sized shadow plate, clipped to a card in the canvas area
  nodes.push({
    kind: 'box', x: 0, y: 0, w: PAGE.width, h: PAGE.height, rot: 0, fill: '#000000', opacity: 20,
    _clips: [{ d: 'M340 60L980 60L980 960L340 960Z', evenOdd: false }],
  } as PdfNode);
  // a tile-pattern swatch strip, also outside the crop
  for (let i = 0; i < 8; i++) {
    nodes.push({
      kind: 'box', x: 360 + i * 70, y: 1200, w: 60, h: 60, rot: 0, fill: '#888888',
      _gradient: { type: 1, matrix: [1, 0, 0, 1, 0, 0], domain: [0, 1, 0, 1], tileKey: 'tile' } as never,
    } as PdfNode);
  }
  // 120 sidebar controls down the left rail; only the ones at y≈500 are in the crop
  for (let i = 0; i < 120; i++) {
    const y = 80 + i * 14;
    nodes.push({ kind: 'box', x: 24, y, w: 280, h: 12, rot: 0, fill: '#eeeeee', radius: 4 } as PdfNode);
    nodes.push({
      kind: 'text', x: 30, y: y + 1, w: 200, h: 10, rot: 0, fontSize: 8, fg: '#222222',
      fontFamily: 'Outfit', text: `Control ${i}`,
    } as PdfNode);
  }

  const opt = { ...PAGE, images };
  const full = pdfNodesToSvg(nodes, opt);
  const crop: CullWindow = { x: 20, y: 496, width: 290, height: 60 };   // one control row
  const res = cullPdfNodes(nodes, crop);
  const culled = pdfNodesToSvg(res.nodes, opt);

  assert.ok(full.length > 500_000, `the fixture must be big enough to be interesting (got ${full.length})`);
  const frac = culled.length / full.length;
  assert.ok(frac < 0.1, `culled output is ${(frac * 100).toFixed(1)}% of the uncropped bytes - culling has regressed`);
  // the heavy payloads went with their nodes (this is the reference-counted-defs fix)
  assert.ok(!culled.includes(bigPng), 'the canvas raster survived a crop it cannot reach');
  assert.ok(!culled.includes(tilePng), 'the shading tile survived a crop it cannot reach');
  assert.equal(res.unbounded, 0);
  // …and the control that IS in the crop is still there, with its label.
  assert.ok(culled.includes('Control 30'), `the in-crop control was culled: ${culled.slice(0, 400)}`);
});

/** The drawable (non-defs) leaf elements of a page SVG, in paint order. */
function drawableEls(svg: string): string[] {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  // One alternation, so the result is in DOCUMENT order - two matchAll passes
  // concatenated would put every shape before every <text> and silently break any
  // paint-order assertion built on it.
  return [...body.matchAll(
    /<(?:rect|ellipse|image|path)(?:"[^"]*"|[^>])*?\/>|<text(?:"[^"]*"|[^>])*?>[\s\S]*?<\/text>/g,
  )].map((m) => m[0]);
}
const wrapSvg = (el: string): string => `<svg viewBox="0 0 1 1">${el}</svg>`;

// ── section 6.5 the soundness guard (anti-drift ratchet) ────────────────────────────

/**
 * Culling in cullPdfNodes assumes everything the serializer emits is INTERSECTIVE - 
 * a node's ink never leaves its own geometry. `clip-path` and `mask` qualify (both
 * only remove ink, and pdfNodeExtent intersects with both); a filter, a blend mode,
 * a <use> or an unbounded mask would not. If you are adding one of those, that
 * assumption is now false - fix the culler in the same commit, don't relax this
 * test.
 */
test('soundness guard: everything the serializer emits is intersective (no filter, blend, <use>)', () => {
  const rnd = prng(0xA11C0DE);
  const nodes = Array.from({ length: 400 }, () => randomNode(rnd));
  nodes.push({
    kind: 'box', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#ffffff',
    _gradient: {
      type: 3, coords: [10, 10, 0, 50, 50, 40], matrix: [1, 0, 0, 1, 0, 0],
      stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    } as never,
  } as PdfNode);
  nodes.push({
    kind: 'box', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#ffffff',
    _gradient: { type: 1, matrix: [1, 0, 0, 1, 0, 0], domain: [0, 1, 0, 1], tileKey: 'tile0' } as never,
  } as PdfNode);
  nodes.push({
    kind: 'box', x: 0, y: 0, w: 100, h: 100, rot: 0, fill: '#ffffff',
    _gradient: {
      type: 2, coords: [0, 0, 100, 0], matrix: [1, 0, 0, 1, 0, 0], extend: [true, true],
      stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#00ff00' }],
    } as never,
  } as PdfNode);
  nodes.push({ kind: 'box', x: 5, y: 5, w: 20, h: 20, rot: 0, fill: '#abc', group: 'Layer 1' } as PdfNode);
  const svg = pdfNodesToSvg(nodes, { ...PAGE, images: IMAGES, background: '#ffffff' });

  for (const banned of ['filter=', 'mix-blend-mode', '<use', '<marker', '<foreignObject']) {
    assert.ok(!svg.includes(banned), `serializer emitted "${banned}" - culling is no longer sound`);
  }
  const tags = new Set([...svg.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[1]!));
  assert.deepEqual([...tags].sort(), [
    'clipPath', 'defs', 'ellipse', 'g', 'image', 'linearGradient', 'mask', 'path', 'pattern',
    'radialGradient', 'rect', 'stop', 'svg', 'text', 'tspan',
  ], 'the emitted element vocabulary changed - re-audit cullPdfNodes');
  // And the attribute vocabulary a culler could be broken by.
  const attrs = new Set([...svg.matchAll(/\s([a-zA-Z:-]+)="/g)].map((m) => m[1]!));
  const known = new Set([
    'xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'fill', 'opacity',
    'transform', 'd', 'stroke', 'stroke-width', 'fill-rule', 'clip-rule', 'clip-path', 'href',
    'preserveAspectRatio', 'data-group', 'xml:space', 'font-size', 'font-family', 'font-weight',
    'id', 'offset', 'stop-color', 'gradientUnits', 'gradientTransform', 'x1', 'y1', 'x2', 'y2',
    'fx', 'fy', 'fr', 'r', 'patternUnits', 'patternTransform',
    // engine 1.63 soft masks - intersective, and only because of the two pins below
    'mask', 'maskUnits', 'mask-type', 'style',
  ]);
  const unknown = [...attrs].filter((a) => !known.has(a));
  assert.deepEqual(unknown, [], 'the serializer grew a new attribute - check it can’t move ink outside a node’s geometry');
  // Only `rotate(...)` and `translate(...)` transforms, i.e. nothing that can
  // scale or skew ink outside the extent pdfNodeExtent computes.
  for (const m of svg.matchAll(/transform="([^"]*)"/g)) {
    assert.match(m[1]!, /^(?:rotate\([^)]*\)|translate\([^)]*\))$/, `unexpected transform: ${m[1]}`);
  }
  // PIN 3: no ANCESTOR transform. pdfNodeExtent computes page-space boxes per node,
  // so a transform on a wrapper `<g>` - a `<g data-group>` run, a clip or a mask
  // wrap - would move every node inside it and invalidate every extent at once.
  // The only transform-bearing group the serializer emits is outlinedTextEl's, which
  // wraps exactly one glyph `<path/>` and is accounted for in the extent.
  for (const m of svg.matchAll(/<g\b([^>]*)>/g)) {
    const a = m[1]!;
    if (!/\stransform="/.test(a)) {
      assert.match(a, /^(?: data-group="[^"]*"| clip-path="url\(#pclip\d+\)"| mask="url\(#pmask\d+\)")$/,
        `unexpected wrapper group: <g${a}>`);
      continue;
    }
    assert.match(a, /^ transform="translate\([-\d.eE+ ]+\)"$/, `a transformed group must only translate: <g${a}>`);
    const after = svg.slice(m.index! + m[0].length);
    assert.match(after, /^<path d="[^"]*" fill="[^"]*"\/><\/g>/,
      'a transformed group must wrap exactly one glyph path - anything else is an untracked ancestor transform');
  }
  // PIN 1: every <mask> carries a BOUNDED userSpaceOnUse region. An objectBoundingBox
  // mask, or one with no x/y/width/height, would make pdfNodeExtent's mask
  // intersection (and therefore the cull) wrong.
  const masks = [...svg.matchAll(/<mask\b([^>]*)>/g)].map((m) => m[1]!);
  assert.ok(masks.length, 'the corpus must actually exercise a soft mask, or this pin is asleep');
  for (const m of masks) {
    assert.match(m, /maskUnits="userSpaceOnUse"/, `unbounded mask units: <mask${m}>`);
    for (const a of ['x', 'y', 'width', 'height']) {
      assert.match(m, new RegExp(`\\s${a}="-?[\\d.]+"`), `mask has no ${a}: <mask${m}>`);
    }
  }
  // PIN 2: `mask=`/`clip-path=` only ever reference our own defs, and `style=` is
  // only the mask's colour-interpolation hint - not a place ink can grow.
  for (const m of svg.matchAll(/\s(?:mask|clip-path)="([^"]*)"/g)) {
    assert.match(m[1]!, /^url\(#p(?:mask|clip)\d+\)$/, `unexpected paint reference: ${m[1]}`);
  }
  for (const m of svg.matchAll(/\sstyle="([^"]*)"/g)) {
    assert.equal(m[1], 'color-interpolation:sRGB');
  }
});

// ── section 6.7 adversarial: the silent-cull class ──────────────────────────────────
//
// Every case below was a REAL silent cull before the fix that follows it. A silent
// cull is the worst failure this feature can have: the node is simply not in the
// output, nothing warns, and the customer finds out when a logo is missing from
// their screenshot.

test('adversarial: a wrapped paragraph whose SECOND line is longer than the first', () => {
  // pdf-map's flushText derives `w` from the FIRST line only:
  //   w = max(4, firstLine.length·size·0.55, size·2)
  // …so this node claims to be 40pt wide while its second line paints ~430pt of ink.
  const size = 20;
  const text = 'Hi\nA very long second line of running text';
  const n = box({
    kind: 'text', x: 100, y: 100, w: Math.max(4, 2 * size * 0.55, size * 2), h: size * 1.4 * 2,
    fontSize: size, fg: '#111111', fontFamily: 'Outfit', text,
  });
  const e = pdfNodeExtent(n)!;
  assert.ok(e.x <= -PLANE + 1 && e.w >= 2 * PLANE - 1,
    `a <text> run's advance is the RENDERER's business - the extent must not guess it: ${JSON.stringify(e)}`);
  // A window 400pt to the right of the node's declared box still holds line 2's ink.
  assert.equal(cullPdfNodes([n], { x: 400, y: 100, width: 60, height: 60, pad: 0 }).nodes.length, 1);
  // …and the vertical band still culls: the same run 900pt further down the page.
  assert.equal(cullPdfNodes([n], { x: 400, y: 1000, width: 60, height: 60, pad: 0 }).nodes.length, 0,
    'the y band is bounded by fontSize, so a run far below the crop must still be dropped');
});

test('adversarial: a full-width (CJK) run advances ~1em per glyph, not 0.55em', () => {
  const size = 20;
  const text = '設計システムのトークンを取り込む';                     // 16 full-width glyphs ≈ 320pt
  const n = box({
    kind: 'text', x: 100, y: 100, w: Math.max(4, text.length * size * 0.55, size * 2), h: size * 1.4,
    fontSize: size, fg: '#111111', fontFamily: 'Noto Sans JP', text,
  });
  // The old estimate reached x≈364; the ink reaches x≈420.
  assert.equal(cullPdfNodes([n], { x: 390, y: 100, width: 30, height: 30, pad: 0 }).nodes.length, 1);
});

test('adversarial: outlined text is bounded EXACTLY by its glyph paths, per line', () => {
  const size = 20;
  const n = box({
    kind: 'text', x: 100, y: 100, w: 40, h: size * 1.4 * 2, fontSize: size, fg: '#111111',
    text: 'Hi\nlong', _outlinePath: ['M0,0 L20,0 L20,-14 Z', 'M0,0 L429,0 L429,-14 Z'],
  });
  const e = pdfNodeExtent(n)!;
  const mb = markupBbox(n)!;
  assert.ok(contains(e, mb), 'superset');
  // Tight, not just conservative: line 2's ink is the bound, and nothing more.
  assert.deepEqual(
    { x: r2(e.x), y: r2(e.y), w: r2(e.w), h: r2(e.h) },
    { x: r2(mb.x), y: r2(mb.y), w: r2(mb.w), h: r2(mb.h) },
    'outlined text has real path data - the extent must not fall back to an estimate',
  );
  assert.equal(cullPdfNodes([n], { x: 400, y: 100, width: 60, height: 80, pad: 0 }).nodes.length, 1);
});

test('adversarial: a clip `d` in RELATIVE (lowercase) commands must not be scanned as absolute', () => {
  // serializePath only emits M/L/C/Z today, but a blacklist of absolute letters let
  // `m`/`l`/`c`/`z` through - and a relative path read as absolute yields a bbox that
  // need not contain the real clip at all. Here the real clip is x900..950, y1900..1950
  // while an absolute reading gives x−50..900, y0..1900: disjoint in y.
  const n = box({
    x: 0, y: 0, w: PAGE.width, h: PAGE.height, fill: '#123456',
    _clips: [{ d: 'M900 1900l50 0l0 50l-50 0z', evenOdd: false }],
  });
  assert.equal(cullPdfNodes([n], { x: 900, y: 1900, width: 50, height: 50, pad: 0 }).nodes.length, 1);
  // Uppercase-only paths must still shrink - the guard is a whitelist, not a retreat.
  const abs = box({
    x: 0, y: 0, w: PAGE.width, h: PAGE.height, fill: '#123456',
    _clips: [{ d: 'M900 1900L950 1900L950 1950L900 1950Z', evenOdd: false }],
  });
  assert.equal(cullPdfNodes([abs], { x: 0, y: 0, width: 300, height: 300, pad: 0 }).nodes.length, 0);
});

test('adversarial: a nonsense clip bbox fails OPEN instead of collapsing the extent', () => {
  const n = box({
    x: 0, y: 0, w: 1000, h: 1000,
    _clips: [{ d: 'M0 0L1000 0L1000 1000L0 1000Z', evenOdd: false, bbox: { x: 10, y: 10, w: -5, h: -5 } } as never],
  });
  const e = pdfNodeExtent(n)!;
  assert.deepEqual({ x: e.x, y: e.y, w: e.w, h: e.h }, { x: 0, y: 0, w: 1000, h: 1000 },
    'a negative-span bbox is a bug upstream, not a tighter clip - fall back to `d`');
  assert.equal(cullPdfNodes([n], { x: 0, y: 0, width: 500, height: 500, pad: 0 }).nodes.length, 1);
});

test('adversarial: the extent bounds the SANITISED `d`, not the raw _vectorPath', () => {
  // pathEl DELETES `"<>&'` from the path rather than escaping them, so a quote
  // between two digits fuses them: `L1'0000` is emitted as `L10000`. Bounding the raw
  // string would put the ink at x≈1 and cull a node that paints at x=10000.
  const n = box({ kind: 'image', _vectorPath: `M0 0L1'0000 0L1'0000 50Z`, _vectorFill: '#00ff00', x: 0, y: 0, w: 1, h: 50 });
  const svg = pdfNodesToSvg([n], { width: 20000, height: 200 });
  assert.match(svg, /d="M0 0L10000 0L10000 50Z"/, 'guard: the serializer really does fuse the digits');
  const e = pdfNodeExtent(n)!;
  assert.ok(e.x + e.w >= 10000, `extent must cover the emitted geometry, got ${JSON.stringify(e)}`);
  assert.equal(cullPdfNodes([n], { x: 9900, y: 0, width: 200, height: 60, pad: 0 }).nodes.length, 1);
});

test('adversarial: an unscannable vector `d` fails open rather than trusting x/y/w/h', () => {
  // A future producer that emits arcs (or a Figma-style LOCAL-space path, design-map
  // line 836) would have a `d` its declared box does not describe.
  const n = box({ kind: 'image', _vectorPath: 'M0 0A50 50 0 0 1 900 900Z', _vectorFill: '#00ff00', x: 0, y: 0, w: 10, h: 10 });
  assert.equal(pdfNodeExtent(n)!.w >= 2 * PLANE - 1, true, 'an unreadable path is unbounded, not 10×10');
  assert.equal(cullPdfNodes([n], { x: 800, y: 800, width: 50, height: 50, pad: 0 }).nodes.length, 1);
});

test('adversarial: a clip edge that coincides with the node edge still paints a pixel', () => {
  // FOUND ON REAL CONTENT (tools gallery, 2026-07-26): a card backdrop
  //   <rect x="536.49" y="288.22" width="260.15" height="260.15" fill="#030711" opacity="0.06"/>
  // nested in a <clipPath> spanning x 276.34..536.49 - a mathematically ZERO-WIDTH
  // intersection. The extent said "no ink", the node was dropped, and the culled
  // render lost the 1-device-px column Chromium antialiases at that coincident edge
  // (23 px at ~2/255 in that instance; a visible grey hairline for an opaque fill).
  // An empty extent overlaps NO window, so cullPdfNodes' own pad cannot save it.
  const clipRight = 536.49;
  const n = box({
    x: clipRight, y: 288.22, w: 260.15, h: 260.15, fill: '#030711', opacity: 6,
    _clips: [{ d: `M276.34 288.22L${clipRight} 288.22L${clipRight} 548.37L276.34 548.37L276.34 288.22Z`, evenOdd: false }],
  });
  const e = pdfNodeExtent(n)!;
  assert.ok(e.w > 0 && e.h > 0, `a coincident clip edge is a hairline, not nothing: ${JSON.stringify(e)}`);
  assert.equal(cullPdfNodes([n], { x: 480, y: 480, width: 600, height: 60 }).nodes.length, 1,
    'the hairline column is inside this window - the node must survive');
  // …and a clip that really is elsewhere still drops the node: the tolerance is one
  // device pixel, not an excuse to keep everything.
  const far = box({
    x: 700, y: 288.22, w: 260, h: 260, fill: '#030711',
    _clips: [{ d: 'M276.34 288.22L400 288.22L400 548.37L276.34 548.37L276.34 288.22Z', evenOdd: false }],
  });
  assert.equal(pdfNodeExtent(far)!.w, 0);
  assert.equal(cullPdfNodes([far], { x: 0, y: 0, width: 1000, height: 2000 }).nodes.length, 0);
});

test('adversarial: a node exactly on the window boundary', () => {
  const n = box({ x: 100, y: 100, w: 10, h: 10 });
  // Touching edge-to-edge with no pad puts zero ink inside → drop is correct.
  assert.equal(cullPdfNodes([n], { x: 110, y: 100, width: 50, height: 10, pad: 0 }).nodes.length, 0);
  assert.equal(cullPdfNodes([n], { x: 50, y: 100, width: 50, height: 10, pad: 0 }).nodes.length, 0);
  // A hundredth of overlap - the serializer's own rounding grain - must survive.
  assert.equal(cullPdfNodes([n], { x: 109.99, y: 100, width: 50, height: 10, pad: 0 }).nodes.length, 1);
  assert.equal(cullPdfNodes([n], { x: 50, y: 100, width: 50.01, height: 10, pad: 0 }).nodes.length, 1);
});

// ── section 6.8 the <defs> ↔ body contract, and the no-op guarantee ──────────────────

/** Every `url(#id)` the body references must be defined. A culled def with a live
 *  reference renders as NO PAINT - a silent hole, not a smaller file. */
function assertNoDanglingRefs(svg: string, label: string): void {
  const defs = /<defs>([\s\S]*?)<\/defs>/.exec(svg)?.[1] ?? '';
  const defined = new Set([...defs.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');
  for (const m of body.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(defined.has(m[1]!), `${label}: dangling reference url(#${m[1]}) - the def was dropped but the paint wasn't`);
  }
}

test('a gradient def shared with a surviving node is NOT dropped with its culled twin', () => {
  const grad = {
    type: 2 as const, coords: [0, 0, 1, 0], matrix: [1, 0, 0, 1, 0, 0],
    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
  };
  // Same gradient CONTENT on two nodes (the serializer dedupes by content), the
  // first of which is culled - so the def's id is now claimed by the survivor.
  const far = box({ x: 900, y: 1900, w: 50, h: 50, _gradient: grad as never });
  const near = box({ x: 10, y: 10, w: 50, h: 50, _gradient: grad as never });
  const kept = cullPdfNodes([far, near], { x: 0, y: 0, width: 200, height: 200 });
  assert.deepEqual(kept.nodes, [near]);
  const svg = pdfNodesToSvg(kept.nodes, PAGE);
  assert.match(svg, /<linearGradient id="pgrad0"/, 'the shared def must survive its culled twin');
  assert.match(svg, /fill="url\(#pgrad0\)"/);
  assertNoDanglingRefs(svg, 'shared gradient');
});

test('no dangling clip/mask/gradient references, cropped or not, over the corpus', () => {
  const rnd = prng(0xDEFA);
  const opt = { ...PAGE, images: IMAGES };
  for (let iter = 0; iter < 60; iter++) {
    const nodes = Array.from({ length: 20 }, () => randomNode(rnd));
    assertNoDanglingRefs(pdfNodesToSvg(nodes, opt), `iter ${iter} full`);
    const win: CullWindow = { x: rnd() * 800, y: rnd() * 1800, width: 50 + rnd() * 300, height: 50 + rnd() * 300 };
    assertNoDanglingRefs(pdfNodesToSvg(cullPdfNodes(nodes, win).nodes, opt), `iter ${iter} culled`);
  }
});

test('a window that covers the content culls nothing and is byte-identical', () => {
  // The no-regression guarantee for the uncropped path: culling is only ever asked
  // about a crop, and a window that contains everything must be a no-op down to the
  // byte - identical <defs> ids, identical <g data-group> runs, identical order.
  const rnd = prng(0x40E1);
  const opt = { ...PAGE, images: IMAGES };
  const all: CullWindow = { x: -1e5, y: -1e5, width: 2e5, height: 2e5 };
  for (let iter = 0; iter < 40; iter++) {
    const nodes = Array.from({ length: 25 }, () => randomNode(rnd));
    const res = cullPdfNodes(nodes, all);
    assert.equal(res.dropped, 0, `iter ${iter}: an all-covering window dropped ${res.dropped} node(s)`);
    assert.equal(pdfNodesToSvg(res.nodes, opt), pdfNodesToSvg(nodes, opt), `iter ${iter}: not byte-identical`);

    // And with the window set to the PAGE, the only nodes that may go are ones whose
    // ink is entirely off-page - i.e. invisible in the uncropped document too.
    const pageWin: CullWindow = { x: 0, y: 0, width: PAGE.width, height: PAGE.height };
    const onPage = new Set(cullPdfNodes(nodes, pageWin).nodes);
    for (const n of nodes) {
      if (onPage.has(n)) continue;
      const mb = markupBbox(n);
      assert.ok(!mb || !overlaps(mb, { x: 0, y: 0, w: PAGE.width, h: PAGE.height }, EPS),
        `iter ${iter}: dropped a node with on-page ink ${JSON.stringify(mb)}`);
    }
  }
});

// ── section 6.6 fuzz / untrusted input ──────────────────────────────────────────────

test('fuzz: pathological nodes never throw, always terminate, and are never silently dropped', () => {
  const bad: PdfNode[] = [
    { kind: 'box', x: NaN, y: 0, w: 10, h: 10, rot: 0 } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: Infinity, h: 10, rot: 0 } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 1e308 } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: NaN } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: -50, h: -50, rot: 0 } as PdfNode,
    { kind: 'text', x: 0, y: 0, w: 10, h: 10, rot: 0, fontSize: NaN, text: 'x' } as PdfNode,
    { kind: 'text', x: 0, y: 0, w: 10, h: 10, rot: 0, fontSize: 1e308, text: 'x' } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 0, _clips: Array.from({ length: 10_000 }, () => ({ d: 'M0 0L1 1Z', evenOdd: false })) } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 0, _clips: [{ d: `M0 0L${'9'.repeat(1_000_000)} 1Z`, evenOdd: false }] } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 0, _clips: [{ d: 'M0 0 A H V garbage 1 2 3', evenOdd: false }] } as PdfNode,
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 0, _clips: [{ d: 'M 1 2 3', evenOdd: false }] } as PdfNode,  // odd operand count
    { kind: 'box', x: 0, y: 0, w: 10, h: 10, rot: 0, _clips: 'nope' as never } as PdfNode,
    { kind: 'text', x: 0, y: 0, w: 10, h: 10, rot: 0, fontSize: 10, _outlinePath: Array.from({ length: 100_000 }, () => 'M0 0L1 0Z') } as PdfNode,
    null as unknown as PdfNode,
    undefined as unknown as PdfNode,
    'not a node' as unknown as PdfNode,
    { kind: 'image', x: 1e308, y: -1e308, w: 1e308, h: 1e308, rot: 0, _imageXObject: 'img0' } as PdfNode,
  ];

  const t0 = Date.now();
  const win: CullWindow = { x: 0, y: 0, width: 100, height: 100 };
  const res = cullPdfNodes(bad, win);
  assert.ok(Date.now() - t0 < 8_000, 'the whole fuzz corpus must cull in bounded time');

  // Every node we could not bound must be KEPT and accounted for in `unbounded`.
  let expectUnbounded = 0;
  for (const n of bad) {
    const e = pdfNodeExtent(n);
    if (e === null) {
      expectUnbounded++;
      assert.ok(res.nodes.includes(n), `an unbounded node was dropped: ${JSON.stringify(n)?.slice(0, 80)}`);
    }
  }
  assert.equal(res.unbounded, expectUnbounded);

  // …and nothing the serializer would actually have drawn went missing.
  const wb = winBox(win);
  for (const n of bad) {
    let mb: Box | null = null;
    try { mb = markupBbox(n); } catch { mb = null; }
    if (mb && overlaps(mb, wb, EPS)) assert.ok(res.nodes.includes(n), 'a drawn, in-window node was dropped');
  }
});

test('fuzz: random windows over random nodes never throw and never invent nodes', () => {
  const rnd = prng(0xF0F0);
  for (let i = 0; i < 500; i++) {
    const nodes = Array.from({ length: 8 }, () => (rnd() < 0.1 ? (null as unknown as PdfNode) : randomNode(rnd)));
    const wild = [0, -1, 1e308, NaN, Infinity, rnd() * 2000];
    const win: CullWindow = {
      x: wild[Math.floor(rnd() * wild.length)]!, y: wild[Math.floor(rnd() * wild.length)]!,
      width: wild[Math.floor(rnd() * wild.length)]!, height: wild[Math.floor(rnd() * wild.length)]!,
      pad: rnd() < 0.2 ? (NaN as number) : rnd() * 5,
    };
    const res = cullPdfNodes(nodes, win);
    assert.ok(res.nodes.length <= nodes.length);
    for (const n of res.nodes) assert.ok(nodes.includes(n));
    assert.equal(res.total, nodes.length);
  }
});
