// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for migrateCarouselToFrames — the pure carousel-maker → Design frame shim
 * (shells/web/src/views/free-canvas-math.ts). A saved carousel-maker session stores a
 * FLAT global-strip boxes array + pages/pageW/pageH; Design only paints per-artboard
 * [data-pdf-page] pages when boxes carry kind:'frame' + a `frame` membership field. This
 * suite pins that the migration reproduces carousel-maker's page layout: one synthesized
 * artboard per page at the right stride, and every original box stamped with the SAME page
 * bucket carousel-maker's pageOf() would give it.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  migrateCarouselToFrames,
  resolveFrame,
  num,
} from '../shells/web/src/views/free-canvas-math.ts';

// carousel-maker/hooks.js pageOf, verbatim — the oracle the migration must match.
const GAP = 56;
function carouselPageOf(b: any, pw: number, count: number): number {
  const stride = pw + GAP;
  const cx = num(b?.x, 0) + Math.max(1, num(b?.w, 1)) / 2;
  const idx = Math.round((cx - pw / 2) / stride);
  return idx < 0 ? 0 : idx > count - 1 ? count - 1 : idx;
}

// A realistic 3-page carousel record. pw=1080, stride=1136.
// Page 0 spans x∈[0,1080], page 1 [1136,2216], page 2 [2272,3352].
function makeRecord(): any {
  return {
    __toolId: 'carousel-maker',
    __label: 'My Carousel',
    pages: 3,
    pageW: 1080,
    pageH: 1350,
    background: '#101820',
    boxes: [
      { id: 'p0title', kind: 'text', x: 80, y: 120, w: 400, h: 90, text: 'One' },       // page 0
      { id: 'p0logo', kind: 'image', x: 700, y: 900, w: 200, h: 200 },                   // page 0
      { id: 'p1bg', kind: 'box', x: 1136, y: 0, w: 1080, h: 1350 },                       // page 1 (centre 1676)
      { id: 'p1title', kind: 'text', x: 1200, y: 120, w: 400, h: 90, text: 'Two' },       // page 1
      { id: 'p2title', kind: 'text', x: 2360, y: 120, w: 400, h: 90, text: 'Three' },     // page 2
      { id: 'edge', kind: 'box', x: 520, y: 40, w: 120, h: 120 },                         // centre 580 → page 0
    ],
  };
}

test('migrateCarouselToFrames synthesizes one frame per page at the right stride', () => {
  const out: any = migrateCarouselToFrames(makeRecord());
  const frames = out.boxes.filter((b: any) => b.kind === 'frame');
  assert.equal(frames.length, 3);
  // x = i*stride, stride = 1080+56 = 1136.
  assert.deepEqual(frames.map((f: any) => f.x), [0, 1136, 2272]);
  for (const f of frames) {
    assert.equal(f.y, 0);
    assert.equal(f.w, 1080);
    assert.equal(f.h, 1350);
    assert.equal(f.clipChildren, true);
    assert.equal(f.bg, '#101820');
  }
  assert.deepEqual(frames.map((f: any) => f.order), [0, 1, 2]);
  // Ids unique + deterministic.
  const ids = frames.map((f: any) => f.id);
  assert.deepEqual(ids, ['page-1', 'page-2', 'page-3']);
});

test('frame boxes come FIRST so they paint behind their children', () => {
  const out: any = migrateCarouselToFrames(makeRecord());
  assert.equal(out.boxes.length, 3 + 6);
  for (let i = 0; i < 3; i++) assert.equal(out.boxes[i].kind, 'frame');
  for (let i = 3; i < out.boxes.length; i++) assert.notEqual(out.boxes[i].kind, 'frame');
});

test('every original box is stamped with the frame id of its pageOf bucket', () => {
  const rec = makeRecord();
  const out: any = migrateCarouselToFrames(rec);
  const originals = out.boxes.filter((b: any) => b.kind !== 'frame');
  assert.equal(originals.length, rec.boxes.length);
  for (let i = 0; i < rec.boxes.length; i++) {
    const src = rec.boxes[i];
    const migrated = originals[i];
    // same identity + all original fields preserved
    assert.equal(migrated.id, src.id);
    assert.equal(migrated.x, src.x);
    assert.equal(migrated.w, src.w);
    // membership = the pageOf bucket's frame id
    const page = carouselPageOf(src, 1080, 3);
    assert.equal(migrated.frame, 'page-' + (page + 1));
  }
});

test('PARITY: resolveFrame on the migrated boxes buckets each box to its pageOf page', () => {
  // For boxes whose centre lands INSIDE an artboard, resolveFrame (strict containment) must
  // agree with the stored frame stamped via pageOf. (Gaps/out-of-strip boxes are exactly where
  // the two DISAGREE, which is why the migration stores pageOf; those are covered separately.)
  const rec = makeRecord();
  const out: any = migrateCarouselToFrames(rec);
  const frames = out.boxes.filter((b: any) => b.kind === 'frame');
  const originals = out.boxes.filter((b: any) => b.kind !== 'frame');
  const pw = 1080, stride = pw + GAP;
  for (const b of originals) {
    const cx = num(b.x, 0) + Math.max(1, num(b.w, 1)) / 2;
    const col = cx - Math.floor((cx) / stride) * stride; // position within a stride cell
    const insideArtboard = col <= pw; // centre lands on an artboard, not in the 56px gap
    const page = carouselPageOf(b, pw, 3);
    if (insideArtboard && cx >= 0 && cx <= 2 * stride + pw) {
      const resolved = resolveFrame(b, frames);
      assert.equal(resolved, 'page-' + (page + 1), `resolveFrame parity for ${b.id}`);
    }
    // In all cases the STORED frame is the pageOf bucket — the render reads this, not resolveFrame.
    assert.equal(b.frame, 'page-' + (page + 1));
  }
});

test('out-of-strip + gap boxes are clamped/rounded by pageOf, where resolveFrame would give ""', () => {
  const rec: any = {
    pages: 2,
    pageW: 1000,
    pageH: 1000,
    boxes: [
      { id: 'left', kind: 'box', x: -500, y: 0, w: 100, h: 100 },   // way left of strip → page 0
      { id: 'right', kind: 'box', x: 9000, y: 0, w: 100, h: 100 },  // way right → clamp page 1
    ],
  };
  const out: any = migrateCarouselToFrames(rec);
  const frames = out.boxes.filter((b: any) => b.kind === 'frame');
  const originals = out.boxes.filter((b: any) => b.kind !== 'frame');
  assert.equal(originals.find((b: any) => b.id === 'left').frame, 'page-1');
  assert.equal(originals.find((b: any) => b.id === 'right').frame, 'page-2');
  // resolveFrame gives '' for both (outside every artboard) — proving pageOf is the right bridge.
  assert.equal(resolveFrame(originals.find((b: any) => b.id === 'left'), frames), '');
  assert.equal(resolveFrame(originals.find((b: any) => b.id === 'right'), frames), '');
});

test('transparentBg → frames get bg:"transparent"; default bg when no background', () => {
  const t: any = migrateCarouselToFrames({ pages: 1, pageW: 800, pageH: 800, transparentBg: true, boxes: [] });
  assert.equal(t.boxes[0].bg, 'transparent');
  const d: any = migrateCarouselToFrames({ pages: 1, pageW: 800, pageH: 800, boxes: [] });
  assert.equal(d.boxes[0].bg, '#ffffff');
});

test('clamps pages to 1..6 and defaults pw/ph', () => {
  const hi: any = migrateCarouselToFrames({ pages: 99, boxes: [] });
  assert.equal(hi.boxes.filter((b: any) => b.kind === 'frame').length, 6);
  const lo: any = migrateCarouselToFrames({ pages: 0, pageW: 1080, boxes: [] });
  assert.equal(lo.boxes.filter((b: any) => b.kind === 'frame').length, 1);
  // pageW present but pageH absent → default 1350.
  assert.equal(lo.boxes[0].h, 1350);
  assert.equal(lo.boxes[0].w, 1080);
});

test('idempotent: a record that already has frame boxes is returned UNCHANGED', () => {
  const already: any = {
    pages: 2,
    pageW: 1080,
    pageH: 1350,
    boxes: [
      { id: 'page-1', kind: 'frame', x: 0, y: 0, w: 1080, h: 1350, order: 0 },
      { id: 'a', kind: 'box', x: 10, y: 10, w: 50, h: 50, frame: 'page-1' },
    ],
  };
  const out = migrateCarouselToFrames(already);
  assert.equal(out, already); // same reference — untouched
});

test('non-carousel record (no page geometry) is returned UNCHANGED', () => {
  const notCarousel: any = { __toolId: 'qr-code', boxes: [{ id: 'x', kind: 'box', x: 0, y: 0, w: 10, h: 10 }] };
  assert.equal(migrateCarouselToFrames(notCarousel), notCarousel);
  const noBoxes: any = { pages: 3, pageW: 1080 };
  assert.equal(migrateCarouselToFrames(noBoxes), noBoxes); // boxes not an array → unchanged
});

test('input record + its boxes are never mutated', () => {
  const rec = makeRecord();
  const snapshot = JSON.stringify(rec);
  const out = migrateCarouselToFrames(rec);
  assert.notEqual(out, rec);
  assert.notEqual((out as any).boxes, rec.boxes);
  // original boxes untouched (no `frame` key leaked back onto them)
  for (const b of rec.boxes) assert.equal((b as any).frame, undefined);
  assert.equal(JSON.stringify(rec), snapshot);
});

test('frame ids escalate to avoid collision with existing box ids', () => {
  const rec: any = {
    pages: 2,
    pageW: 1080,
    pageH: 1350,
    boxes: [
      { id: 'page-1', kind: 'box', x: 0, y: 0, w: 100, h: 100 }, // collides with the default prefix
    ],
  };
  const out: any = migrateCarouselToFrames(rec);
  const frames = out.boxes.filter((b: any) => b.kind === 'frame');
  const frameIds = frames.map((f: any) => f.id);
  // deterministic escalation → 'ppage-' prefix, and no id equals the existing box id
  assert.deepEqual(frameIds, ['ppage-1', 'ppage-2']);
  assert.equal(new Set([...frameIds, 'page-1']).size, 3);
});
