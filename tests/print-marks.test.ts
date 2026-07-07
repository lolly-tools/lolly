/**
 * Print-marks geometry contract tests.
 * Run with: node --test tests/print-marks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePrintGeometry, cmykToRgbApprox, PRINT_MARK_DEFAULTS } from '../engine/src/print-marks.ts';
import type { PrintGeometry, PaletteSwatch } from '../engine/src/print-marks.ts';
import { toPoints } from '../engine/src/units.ts';

const TRIM = { trimWpt: 720, trimHpt: 540 };           // 10" × 7.5" at 72pt/in
const ALL = { crop: true, registration: true, bleed: true, colorBars: true };
const close = (a: number, b: number, eps = 0.001) => Math.abs(a - b) <= eps;

// A point is strictly inside the trim box (the marks must never be).
function strictlyInsideTrim(geo: PrintGeometry, x: number, y: number, eps = 0.01) {
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

// ── Brand verification colour bar ────────────────────────────────────────────

const BRAND3: PaletteSwatch[] = [
  { rgb: [0.05, 0.20, 0.17], cmyk: [0.65, 0, 0.35, 0.85], label: 'Pine' },
  { rgb: [0.19, 0.73, 0.47], cmyk: [0.70, 0, 0.65, 0],    label: 'Jungle' },
  { rgb: [1.00, 0.49, 0.25], cmyk: [0,    0.60, 0.80, 0], label: 'Persimmon' },
];

// The four solid process primaries that lead the brand verification bar.
const CMYK_PRIMARIES = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

test('brand bar leads with solid C/M/Y/K, then a gap, then RGB+CMYK pairs', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: { colorBars: true }, palette: BRAND3 });
  const bars = geo.primitives.bars;
  // Process primaries first: four solid DeviceCMYK calibration cells.
  const primaries = bars.slice(0, 4);
  primaries.forEach((b, i) => {
    assert.equal(b.ink, 'cmyk');
    assert.deepEqual(b.cmyk, CMYK_PRIMARIES[i]);
  });
  // Then one RGB-reference + CMYK-substitution pair per brand colour.
  const pairs = bars.slice(4);
  assert.equal(pairs.length, 2 * BRAND3.length);
  for (let i = 0; i < pairs.length; i += 2) {
    const rgbCell = pairs[i]!, cmykCell = pairs[i + 1]!;
    assert.equal(rgbCell.ink, 'rgb');
    assert.equal(cmykCell.ink, 'cmyk');
    assert.deepEqual(rgbCell.rgb, cmykCell.rgb);
    assert.deepEqual(rgbCell.cmyk, cmykCell.cmyk);
    assert.equal(rgbCell.label, cmykCell.label);
    assert.ok(close(rgbCell.x + rgbCell.w, cmykCell.x));   // the pair touches (no inner gap)
    assert.ok(!strictlyInsideTrim(geo, rgbCell.x, rgbCell.y));
    assert.ok(!strictlyInsideTrim(geo, cmykCell.x, cmykCell.y));
  }
  // A wider gap separates the process primaries from the first brand pair than
  // separates one brand pair from the next.
  const groupGap = pairs[0]!.x - (primaries[3]!.x + primaries[3]!.w);
  const pairGap  = pairs[2]!.x - (pairs[1]!.x + pairs[1]!.w);
  assert.ok(groupGap > pairGap);
});

test('verification bar caps brand cells (not the primaries), in whole pairs', () => {
  const many: PaletteSwatch[] = Array.from({ length: 20 }, (_, i) =>
    ({ rgb: [0, 0, 0], cmyk: [0, 0, 0, i / 20], label: `c${i}` }));
  const bars = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: { colorBars: true }, palette: many }).primitives.bars;
  const brandCells = bars.length - 4;                    // minus the four primaries
  assert.ok(brandCells <= PRINT_MARK_DEFAULTS.barMaxCells);
  assert.equal(brandCells % 2, 0);
});

test('every bar cell stays left of the centred bottom registration target', () => {
  // Medium trim + registration: some brand pairs fit, the rest are width-capped;
  // nothing (primary or pair) may cross into the centre mark's lane.
  const geo = computePrintGeometry({ trimWpt: 320, trimHpt: 320, bleedPt: 8.5, marks: ALL, palette: BRAND3 });
  const maxX = geo.page.w / 2 - PRINT_MARK_DEFAULTS.regCrossPt - 6;
  assert.ok(geo.primitives.bars.length >= 4);            // primaries always present
  for (const b of geo.primitives.bars) assert.ok(b.x + b.w <= maxX + 0.01);
});

test('no palette → generic process bar (cells follow the page ink space)', () => {
  const bars = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: { colorBars: true } }).primitives.bars;
  assert.ok(bars.length > 0);
  assert.ok(bars.every(b => b.ink === 'page'));
});

// ── Provenance labels ────────────────────────────────────────────────────────

test('no provenance → no label anchors', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: ALL });
  assert.equal(geo.primitives.labels.length, 0);
});

test('provenance → top-left date + top-right credit + bottom-left (read-up) anchors', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 8.5, marks: { ...ALL, provenance: true } });
  const labels = geo.primitives.labels;
  const tl = labels.find(l => l.slot === 'topLeft')!;
  const tr = labels.find(l => l.slot === 'topRight')!;
  const bl = labels.find(l => l.slot === 'bottomLeftUp')!;
  assert.ok(tl && tr && bl);
  const li = PRINT_MARK_DEFAULTS.labelInsetPt;
  const t = geo.boxes.trim;
  // Labels anchor to the TRIM edges (inset li), inboard of the bleed/crop corner
  // marks so a tick never overlays the text.
  // top-left reads horizontally, left-aligned just inside the trim left edge.
  assert.equal(tl.rotation, 0);
  assert.equal(tl.align, 'left');
  assert.ok(close(tl.x, t.x + li));
  assert.ok(tl.x > geo.boxes.bleed.x);             // past the bleed corner tick
  // top-right reads horizontally, right-aligned just inside the trim right edge.
  assert.equal(tr.rotation, 0);
  assert.equal(tr.align, 'right');
  assert.ok(close(tr.x, t.x + t.w - li));
  assert.ok(tr.x < geo.boxes.bleed.x + geo.boxes.bleed.w);
  // the two top labels share a baseline.
  assert.ok(close(tl.y, tr.y));
  // bottom-left climbs (90° CCW), left-aligned, starting above the bottom corner ticks.
  assert.equal(bl.rotation, 90);
  assert.equal(bl.align, 'left');
  assert.ok(close(bl.y, t.y + t.h - li));
  // all sit in the margin, never strictly inside the trimmed artwork.
  for (const l of labels) {
    assert.ok(l.size > 0);
    assert.ok(!strictlyInsideTrim(geo, l.x, l.y));
  }
});

test('provenance alone reserves the margin band (counts as a mark)', () => {
  const geo = computePrintGeometry({ ...TRIM, bleedPt: 0, marks: { provenance: true } });
  assert.ok(geo.page.w > TRIM.trimWpt && geo.page.h > TRIM.trimHpt);  // a reach band exists
  assert.equal(geo.primitives.labels.length, 3);
});
