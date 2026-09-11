// SPDX-License-Identifier: MPL-2.0
/**
 * `background-size` / `background-position` / `background-repeat` arithmetic
 * (bridge/bg-layout.ts).
 *
 * The defect this replaced was one line: the walker painted every background image at
 * the element's full border box. So the cases worth pinning are the ones where the
 * right answer is NOT the box - a fixed-size icon, a one-value size whose other axis
 * is auto, a percentage position (which aligns the image's own X% with the area's X%,
 * not its top-left with X%), and an edge-offset like the `right 12px center` that puts
 * the chevron in this app's selects.
 *
 * Pure arithmetic, so no browser: the computed strings a browser would hand us are
 * the inputs, and they are short enough to write by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBgSize, resolveBgPositionAxis, placeBackground, repeatAxes, splitTopLevel } from './bg-layout.ts';

const AREA = { w: 200, h: 100 };
const ICON = { w: 24, h: 12 };   // 2:1, so a squashed axis is visible

// ── background-size ──────────────────────────────────────────────────────────
const SIZES: [string, { w: number; h: number } | null, [number, number]][] = [
  ['auto', ICON, [24, 12]],
  ['auto auto', ICON, [24, 12]],
  // The whole point of the fix: a fixed size stays fixed.
  ['14px', ICON, [14, 7]],
  ['14px 14px', ICON, [14, 14]],
  ['14px auto', ICON, [14, 7]],
  ['auto 24px', ICON, [48, 24]],
  ['50%', ICON, [100, 50]],
  ['50% 100%', ICON, [100, 100]],
  ['100% 100%', ICON, [200, 100]],
  // contain fits inside (2:1 image in a 2:1 area is exact); cover fills.
  ['contain', { w: 10, h: 10 }, [100, 100]],
  ['cover', { w: 10, h: 10 }, [200, 200]],
  ['contain', { w: 40, h: 10 }, [200, 50]],
  ['cover', { w: 40, h: 10 }, [400, 100]],
  // No intrinsic size: CSS falls back to the area, which is also the pre-fix
  // behaviour - an undiscoverable image degrades rather than disappears.
  ['auto', null, [200, 100]],
  ['cover', null, [200, 100]],
  ['14px', null, [14, 100]],
];
for (const [value, intrinsic, [w, h]] of SIZES) {
  test(`resolveBgSize: ${value} (intrinsic ${intrinsic ? `${intrinsic.w}x${intrinsic.h}` : 'none'})`, () => {
    const got = resolveBgSize(value, AREA, intrinsic);
    assert.deepEqual([Math.round(got.w * 100) / 100, Math.round(got.h * 100) / 100], [w, h]);
  });
}

test('a degenerate intrinsic size does not produce NaN', () => {
  for (const bad of [{ w: 0, h: 0 }, { w: 10, h: 0 }, { w: 0, h: 10 }]) {
    for (const v of ['auto', 'cover', 'contain', '14px']) {
      const got = resolveBgSize(v, AREA, bad);
      assert.ok(Number.isFinite(got.w) && Number.isFinite(got.h), `${v} with ${JSON.stringify(bad)} → ${JSON.stringify(got)}`);
    }
  }
});

// ── background-position ──────────────────────────────────────────────────────
const POS: [string, number, number, number][] = [
  ['0%', 200, 24, 0],
  ['left', 200, 24, 0],
  // Not 100 - a centred 24px image sits at (200-24)/2.
  ['50%', 200, 24, 88],
  ['center', 200, 24, 88],
  ['100%', 200, 24, 176],
  ['right', 200, 24, 176],
  ['12px', 200, 24, 12],
  ['-4px', 200, 24, -4],
  ['garbage', 200, 24, 0],
];
for (const [tok, area, img, want] of POS) {
  test(`resolveBgPositionAxis: ${tok}`, () => assert.equal(resolveBgPositionAxis(tok, area, img), want));
}

// ── repeat ───────────────────────────────────────────────────────────────────
const REPEATS: [string, boolean, boolean][] = [
  ['repeat', true, true],
  ['no-repeat', false, false],
  ['repeat-x', true, false],
  ['repeat-y', false, true],
  ['repeat no-repeat', true, false],
  ['no-repeat repeat', false, true],
  ['round', true, true],
  ['space space', true, true],
  ['', true, true],
];
for (const [v, x, y] of REPEATS) {
  test(`repeatAxes: "${v}"`, () => assert.deepEqual(repeatAxes(v), { x, y }));
}

// ── the real cases from this app's field primitive ───────────────────────────
test('the select chevron lands at the right edge, vertically centred, at its own size', () => {
  // .field-select: `background: var(--field-chevron) no-repeat right 12px center / 14px`
  const p = placeBackground('14px', 'right 12px center', 'no-repeat',
    { w: 200, h: 34 }, { w: 14, h: 14 });
  assert.deepEqual([p.w, p.h], [14, 14], 'the chevron keeps its 14px size');
  assert.equal(p.x, 200 - 14 - 12, 'offset from the RIGHT edge, not from the left');
  assert.equal(p.y, (34 - 14) / 2, 'vertically centred');
  assert.equal(p.repeatX, false); assert.equal(p.repeatY, false);
});

test('the checkbox tick is centred in the box rather than filling it', () => {
  const p = placeBackground('contain', 'center', 'no-repeat', { w: 16, h: 16 }, { w: 24, h: 24 });
  assert.deepEqual([p.w, p.h, p.x, p.y], [16, 16, 0, 0]);
});

test('a bottom-edge offset measures from the bottom', () => {
  const p = placeBackground('10px 10px', 'left 5px bottom 8px', 'no-repeat', AREA, { w: 10, h: 10 });
  assert.equal(p.x, 5);
  assert.equal(p.y, 100 - 10 - 8);
});

test('a keyword pair given vertical-first is still resolved to the right axes', () => {
  // `background-position: top right` is legal and means x=right, y=top.
  const p = placeBackground('10px 10px', 'top right', 'no-repeat', AREA, { w: 10, h: 10 });
  assert.equal(p.x, 190); assert.equal(p.y, 0);
});

test('a single position value centres the other axis', () => {
  const p = placeBackground('10px 10px', 'left', 'no-repeat', AREA, { w: 10, h: 10 });
  assert.equal(p.x, 0);
  assert.equal(p.y, (100 - 10) / 2);
});

test('placement never produces a non-finite coordinate', () => {
  for (const pos of ['', 'nonsense', 'left top left top', '50%', 'center center center']) {
    for (const size of ['', 'auto', 'nonsense', 'cover']) {
      const p = placeBackground(size, pos, 'repeat', AREA, ICON);
      assert.ok([p.x, p.y, p.w, p.h].every(Number.isFinite), `${size} / ${pos} → ${JSON.stringify(p)}`);
    }
  }
});

// ── the computed form the browser actually hands us ──────────────────────────
// Chromium normalises `right 12px center` to `calc(100% - 12px) 50%`. Splitting that
// on whitespace turns one value into three meaningless tokens, which is how the
// chevron ended up at x=0 despite the size arithmetic being right.
test('splitTopLevel keeps a calc() whole', () => {
  assert.deepEqual(splitTopLevel('calc(100% - 12px) 50%'), ['calc(100% - 12px)', '50%']);
  assert.deepEqual(splitTopLevel('  10px   20px '), ['10px', '20px']);
  assert.deepEqual(splitTopLevel('calc(50% + calc(2px - 1px)) top'), ['calc(50% + calc(2px - 1px))', 'top']);
});

test('a calc() position resolves percentage against area-image, plus the length', () => {
  assert.equal(resolveBgPositionAxis('calc(100% - 12px)', 200, 14), 200 - 14 - 12);
  assert.equal(resolveBgPositionAxis('calc(0% + 8px)', 200, 14), 8);
  assert.equal(resolveBgPositionAxis('calc(50% - 4px)', 200, 14), (200 - 14) / 2 - 4);
});

test('the chevron lands correctly from the COMPUTED value, not the authored one', () => {
  const p = placeBackground('14px 7px', 'calc(100% - 12px) 50%', 'no-repeat',
    { w: 200, h: 40 }, { w: 20, h: 10 });
  assert.deepEqual([p.w, p.h], [14, 7]);
  assert.equal(p.x, 174);
  assert.equal(p.y, (40 - 7) / 2);
});

test('an unparseable calc contributes 0 rather than NaN', () => {
  assert.equal(resolveBgPositionAxis('calc(var(--x))', 200, 14), 0);
  assert.ok(Number.isFinite(resolveBgPositionAxis('calc()', 200, 14)));
});
