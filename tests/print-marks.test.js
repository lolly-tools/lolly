/**
 * Print-marks geometry contract tests.
 * Run with: node --test tests/print-marks.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePrintGeometry, cmykToRgbApprox, PRINT_MARK_DEFAULTS } from '../engine/src/print-marks.js';
import { toPoints } from '../engine/src/units.js';

const TRIM = { trimWpt: 720, trimHpt: 540 };           // 10" × 7.5" at 72pt/in
const ALL = { crop: true, registration: true, bleed: true, colorBars: true };
const close = (a, b, eps = 0.001) => Math.abs(a - b) <= eps;

// A point is strictly inside the trim box (the marks must never be).
function strictlyInsideTrim(geo, x, y, eps = 0.01) {
  const t = geo.boxes.trim;
  return x > t.x + eps && x < t.x + t.w - eps && y > t.y + eps && y < t.y + t.h - eps;
}

test('page = trim + 2·margin, with margin = bleed + mark reach', () => {
  const bleedPt = toPoints({ value: 3, unit: 'mm' });
  const geo = computePrintGeometry({ ...TRIM, bleedPt, marks: ALL });
  const M = bleedPt + PRINT_MARK_DEFAULTS.markReachPt;
  assert.ok(close(geo.page.w, TRIM.trimWpt + 2 * M));
  assert.ok(close(geo.page.h, TRIM.trimHpt + 2 * M));
});

test('boxes nest: media ⊇ bleed ⊇ trim, and artwork == bleed', () => {
  const bleedPt = 8.5;
  const { boxes, artwork } = computePrintGeometry({ ...TRIM, bleedPt, marks: ALL });
  // trim sits inside bleed by exactly the bleed on each edge
  assert.ok(close(boxes.trim.x - boxes.bleed.x, bleedPt));
  assert.ok(close(boxes.trim.y - boxes.bleed.y, bleedPt));
  assert.ok(close(boxes.bleed.w - boxes.trim.w, 2 * bleedPt));
  // bleed sits inside media
  assert.ok(boxes.bleed.x > boxes.media.x && boxes.bleed.y > boxes.media.y);
  assert.ok(boxes.bleed.x + boxes.bleed.w < boxes.media.x + boxes.media.w);
  // artwork is drawn at the bleed box (scale-to-bleed)
  assert.deepEqual(artwork, boxes.bleed);
});

test('mark counts: 8 crop, 8 bleed, 4 registration targets + crosshairs', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: ALL });
  const lines = geo.primitives.lines;
  assert.equal(lines.filter(l => l.mark === 'crop').length, 8);
  assert.equal(lines.filter(l => l.mark === 'bleed').length, 8);
  assert.equal(geo.primitives.circles.filter(c => c.mark === 'registration').length, 4);
  assert.equal(lines.filter(l => l.mark === 'registration').length, 8); // 2 crosshairs × 4
  assert.ok(geo.primitives.bars.length > 0);
  assert.ok(geo.primitives.bars.every(b => b.mark === 'colorbar' && b.cmyk.length === 4 && b.rgb.length === 3));
});

test('no mark primitive falls strictly inside the trim box', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: ALL });
  for (const l of geo.primitives.lines) {
    assert.ok(!strictlyInsideTrim(geo, l.x1, l.y1), `line start inside trim (${l.mark})`);
    assert.ok(!strictlyInsideTrim(geo, l.x2, l.y2), `line end inside trim (${l.mark})`);
  }
  for (const c of geo.primitives.circles) {
    assert.ok(!strictlyInsideTrim(geo, c.cx, c.cy), 'registration centre inside trim');
  }
  for (const b of geo.primitives.bars) {
    assert.ok(!strictlyInsideTrim(geo, b.x, b.y), 'colour bar inside trim');
  }
});

test('marks with zero bleed still reserve a margin for the marks', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 0, marks: { crop: true } });
  assert.ok(geo.page.w > TRIM.trimWpt && geo.page.h > TRIM.trimHpt);
  // with no bleed, the bleed box collapses onto the trim box
  assert.deepEqual(geo.boxes.bleed, geo.boxes.trim);
  assert.equal(geo.primitives.lines.filter(l => l.mark === 'crop').length, 8);
  assert.equal(geo.primitives.lines.filter(l => l.mark === 'bleed').length, 0); // bleed marks need bleed
});

test('bleed only (no marks): page = trim + 2·bleed, no primitives, bleed == media', () => {
  const bleedPt = 8.5;
  const geo = computePrintGeometry({ ...TRIM, bleedPt, marks: {} });
  assert.ok(close(geo.page.w, TRIM.trimWpt + 2 * bleedPt));
  assert.deepEqual(geo.boxes.bleed, geo.boxes.media);
  assert.equal(geo.primitives.lines.length, 0);
  assert.equal(geo.primitives.circles.length, 0);
  assert.equal(geo.primitives.bars.length, 0);
});

test('cmykToRgbApprox: primaries and paper white', () => {
  assert.deepEqual(cmykToRgbApprox([0, 0, 0, 0]), [1, 1, 1]);      // white
  assert.deepEqual(cmykToRgbApprox([0, 0, 0, 1]), [0, 0, 0]);      // black
  assert.deepEqual(cmykToRgbApprox([1, 0, 0, 0]), [0, 1, 1]);      // cyan → (0,1,1)
});
