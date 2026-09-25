// SPDX-License-Identifier: MPL-2.0
/**
 * Decode budgets and the resolution ladder (plan 274 section 9, "Memory").
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/budget.test.ts
 *
 * The table is the point of these tests. The numbers are starting engineering
 * goals, so they will move when the plan's baselines exist; pinning them here
 * means a move is a decision someone took rather than a drift nobody saw. The
 * arithmetic the plan states is asserted too, so the reason for the phone ceiling
 * stays attached to the ceiling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DECODE_BUDGETS,
  RGBA_BYTES_PER_PIXEL,
  classifyDevice,
  decodeBudgetFor,
  pixelsForLongEdge,
  resolutionLadder,
  rgbaBytesForPixels,
  type DeviceClassV1,
} from './budget.ts';

const CLASSES: DeviceClassV1[] = ['desktop', 'laptop', 'phone'];
const MIB = 1024 * 1024;

/** RGBA bytes a 16:9 buffer of this long edge occupies, the ladder's own arithmetic. */
const ladderBytes = (longEdge: number): number => longEdge * Math.round(longEdge * 9 / 16) * RGBA_BYTES_PER_PIXEL;

/** One slide's pair of thumbnails: a source and a proposal. */
const thumbnailPairBytes = (longEdge: number): number => ladderBytes(longEdge) * 2;

/** The plan's own arithmetic: one 1920 by 1080 RGBA buffer, and eighty of them. */
const ONE_SLIDE_BUFFER = 1920 * 1080 * RGBA_BYTES_PER_PIXEL;
const FORTY_PAIRS = ONE_SLIDE_BUFFER * 80;

test('the plan section 9 arithmetic is what the table was sized against', () => {
  assert.equal(ONE_SLIDE_BUFFER, 8_294_400, 'a 1920 by 1080 RGBA buffer is 8,294,400 bytes');
  assert.equal(Math.round((ONE_SLIDE_BUFFER / MIB) * 100) / 100, 7.91, 'which is 7.91 MiB');
  assert.equal(FORTY_PAIRS, 663_552_000, 'forty originals plus forty proposals');
  assert.equal(Math.round(FORTY_PAIRS / MIB), 633, 'which is about 633 MiB');
});

test('every long edge in the table is a multiple of the ladder step', () => {
  for (const cls of CLASSES) {
    assert.equal(DECODE_BUDGETS[cls].thumbnailLongEdge % 16, 0, cls);
    assert.equal(DECODE_BUDGETS[cls].previewLongEdge % 16, 0, cls);
  }
});

test('every class pins its numbers', () => {
  assert.deepEqual(DECODE_BUDGETS.desktop, {
    deviceClass: 'desktop',
    maxDecodedPixels: 96_000_000,
    maxCacheBytes: 384_000_000,
    thumbnailLongEdge: 320,
    previewLongEdge: 1600,
    ocrConcurrency: 2,
    decodeConcurrency: 4,
  });
  assert.deepEqual(DECODE_BUDGETS.laptop, {
    deviceClass: 'laptop',
    maxDecodedPixels: 48_000_000,
    maxCacheBytes: 192_000_000,
    thumbnailLongEdge: 256,
    previewLongEdge: 1280,
    ocrConcurrency: 1,
    decodeConcurrency: 3,
  });
  assert.deepEqual(DECODE_BUDGETS.phone, {
    deviceClass: 'phone',
    maxDecodedPixels: 12_000_000,
    maxCacheBytes: 48_000_000,
    thumbnailLongEdge: 192,
    previewLongEdge: 896,
    ocrConcurrency: 1,
    decodeConcurrency: 2,
  });
});

test('the cache ceiling is the decoded-pixel ceiling at four bytes a pixel', () => {
  for (const cls of CLASSES) {
    const b = DECODE_BUDGETS[cls];
    assert.equal(b.maxCacheBytes, b.maxDecodedPixels * RGBA_BYTES_PER_PIXEL, cls);
    assert.equal(rgbaBytesForPixels(b.maxDecodedPixels), b.maxCacheBytes, cls);
  }
});

test('the phone ceiling sits far below the forty-pair figure the plan warns about', () => {
  const phone = DECODE_BUDGETS.phone;
  assert.ok(phone.maxCacheBytes * 13 < FORTY_PAIRS,
    `${phone.maxCacheBytes} bytes is under a thirteenth of ${FORTY_PAIRS}`);
  // And the ladder is what keeps it there: eighty full-size buffers never fit.
  assert.ok(phone.maxDecodedPixels < 1920 * 1080 * 80 / 10);
});

test('a class name returns its own numbers, as a copy', () => {
  for (const cls of CLASSES) {
    const b = decodeBudgetFor(cls);
    assert.deepEqual(b, DECODE_BUDGETS[cls]);
    b.maxCacheBytes = 1;
    assert.notEqual(DECODE_BUDGETS[cls].maxCacheBytes, 1, 'the table is not handed out by reference');
  }
});

test('device hints classify by the stated rules', () => {
  // A mobile device is a phone whatever else it reports.
  assert.equal(classifyDevice({ isMobile: true, deviceMemoryGb: 16, hardwareConcurrency: 16 }), 'phone');
  // Reported memory decides first.
  assert.equal(classifyDevice({ deviceMemoryGb: 4, hardwareConcurrency: 16 }), 'phone');
  assert.equal(classifyDevice({ deviceMemoryGb: 2 }), 'phone');
  assert.equal(classifyDevice({ deviceMemoryGb: 8, hardwareConcurrency: 8 }), 'desktop');
  assert.equal(classifyDevice({ deviceMemoryGb: 32, hardwareConcurrency: 24 }), 'desktop');
  // Plenty of memory but few cores is the constrained laptop.
  assert.equal(classifyDevice({ deviceMemoryGb: 16, hardwareConcurrency: 4 }), 'laptop');
  assert.equal(classifyDevice({ deviceMemoryGb: 6 }), 'laptop');
  // No memory reading at all: cores alone, and the middle of the table by default.
  assert.equal(classifyDevice({ hardwareConcurrency: 12 }), 'desktop');
  assert.equal(classifyDevice({ hardwareConcurrency: 8 }), 'laptop');
  assert.equal(classifyDevice({}), 'laptop');
  assert.equal(classifyDevice({ isMobile: false }), 'laptop');
  assert.equal(decodeBudgetFor({ isMobile: true }).deviceClass, 'phone');
});

test('the ladder keeps the class ceilings for a deck that fits', () => {
  for (const cls of CLASSES) {
    const b = DECODE_BUDGETS[cls];
    const l = resolutionLadder(b, 40);
    assert.equal(l.thumbnailLongEdge, b.thumbnailLongEdge, `${cls} thumbnails at 40 slides`);
    assert.equal(l.previewLongEdge, b.previewLongEdge, `${cls} previews at 40 slides`);
    assert.equal(l.exportFullRes, true);
  }
});

test('the ladder shrinks the thumbnails as the deck grows', () => {
  const rungs = (b: typeof DECODE_BUDGETS.phone, slides: number): [number, number] => {
    const l = resolutionLadder(b, slides);
    return [l.thumbnailLongEdge, l.previewLongEdge];
  };
  assert.deepEqual(rungs(DECODE_BUDGETS.phone, 200), [160, 896]);
  assert.deepEqual(rungs(DECODE_BUDGETS.phone, 2000), [96, 896]);
  assert.deepEqual(rungs(DECODE_BUDGETS.desktop, 2000), [144, 1600]);
  assert.deepEqual(rungs(DECODE_BUDGETS.laptop, 2000), [96, 1280]);
});

test('the ladder says how many slides its thumbnails fit, and when the filmstrip has to window', () => {
  const small = resolutionLadder(DECODE_BUDGETS.phone, 200);
  assert.equal(small.filmstripMustWindow, false, '200 slides fit on a phone');
  assert.ok(small.slidesThatFitThumbnails >= 200, `fits ${small.slidesThatFitThumbnails}`);

  // Past the thumbnail floor the arithmetic stops fitting, and the ladder says so
  // in a number rather than handing back floors that imply more than the ceiling.
  const big = resolutionLadder(DECODE_BUDGETS.phone, 2000);
  assert.equal(big.thumbnailLongEdge, 96, 'at the floor');
  assert.equal(big.filmstripMustWindow, true);
  assert.ok(big.slidesThatFitThumbnails > 0 && big.slidesThatFitThumbnails < 2000,
    `the window is ${big.slidesThatFitThumbnails} slides`);
  assert.equal(resolutionLadder(DECODE_BUDGETS.phone, big.slidesThatFitThumbnails).filmstripMustWindow, false,
    'exactly the number it states does fit');
});

test('what the ladder says it holds stays under the ceiling, at every deck size', () => {
  for (const cls of CLASSES) {
    const b = DECODE_BUDGETS[cls];
    for (const slides of [1, 40, 200, 1158, 2000, 4000, 100000]) {
      const l = resolutionLadder(b, slides);
      const held = Math.min(slides, l.slidesThatFitThumbnails);
      const thumbnails = thumbnailPairBytes(l.thumbnailLongEdge) * held;
      const previews = ladderBytes(l.previewLongEdge) * 6;
      assert.ok(thumbnails <= b.maxCacheBytes / 2 + 1,
        `${cls} at ${slides}: ${thumbnails} bytes of thumbnails is over half the ceiling`);
      assert.ok(thumbnails + previews <= b.maxCacheBytes,
        `${cls} at ${slides}: ${thumbnails + previews} bytes held is over the ${b.maxCacheBytes} ceiling`);
    }
  }
});

test('the ladder never goes below its floors and never above its class', () => {
  for (const cls of CLASSES) {
    const b = DECODE_BUDGETS[cls];
    for (const slides of [0, 1, 3, 40, 500, 5000, 100000]) {
      const l = resolutionLadder(b, slides);
      assert.ok(l.thumbnailLongEdge >= 96, `${cls} at ${slides}: thumbnail floor`);
      assert.ok(l.thumbnailLongEdge <= b.thumbnailLongEdge, `${cls} at ${slides}: thumbnail ceiling`);
      assert.ok(l.previewLongEdge >= 480, `${cls} at ${slides}: preview floor`);
      assert.ok(l.previewLongEdge <= b.previewLongEdge, `${cls} at ${slides}: preview ceiling`);
      assert.equal(l.thumbnailLongEdge % 16, 0, 'a ladder value is a multiple of 16');
      assert.equal(l.previewLongEdge % 16, 0, 'a ladder value is a multiple of 16');
    }
  }
});

test('a slide count that is not a number falls back to one slide', () => {
  const l = resolutionLadder(DECODE_BUDGETS.laptop, Number.NaN);
  assert.deepEqual(l, resolutionLadder(DECODE_BUDGETS.laptop, 1));
});

test('two thumbnails a slide fit under half the ceiling for a deck that fits', () => {
  for (const cls of CLASSES) {
    const b = DECODE_BUDGETS[cls];
    for (const slides of [1, 12, 40, 200]) {
      const l = resolutionLadder(b, slides);
      assert.equal(l.filmstripMustWindow, false, `${cls} at ${slides}: a deck this size fits`);
      const bytes = thumbnailPairBytes(l.thumbnailLongEdge) * slides;
      assert.ok(bytes <= b.maxCacheBytes / 2 + 1, `${cls} at ${slides}: ${bytes} bytes of thumbnails`);
    }
  }
});

test('pixelsForLongEdge scales down and never up', () => {
  // A 1920 by 1080 slide at a 320 long edge: 320 by 180.
  assert.equal(pixelsForLongEdge(1920, 1080, 320), 320 * 180);
  // Portrait: the long edge is the height.
  assert.equal(pixelsForLongEdge(1080, 1920, 320), 180 * 320);
  // Already smaller than the rung: unchanged, never enlarged.
  assert.equal(pixelsForLongEdge(200, 100, 900), 200 * 100);
  assert.equal(pixelsForLongEdge(900, 900, 900), 900 * 900);
  // A very thin source keeps at least one pixel on its short edge.
  assert.equal(pixelsForLongEdge(4000, 3, 100), 100 * 1);
});

test('pixelsForLongEdge answers zero for a degenerate request', () => {
  assert.equal(pixelsForLongEdge(0, 1080, 320), 0);
  assert.equal(pixelsForLongEdge(1920, 0, 320), 0);
  assert.equal(pixelsForLongEdge(1920, 1080, 0), 0);
  assert.equal(pixelsForLongEdge(-5, -5, 320), 0);
  assert.equal(pixelsForLongEdge(Number.NaN, 1080, 320), 0);
});

test('a preview at the ladder rung stays inside the decoded-pixel ceiling', () => {
  for (const cls of CLASSES) {
    const b = DECODE_BUDGETS[cls];
    const l = resolutionLadder(b, 40);
    const pixels = pixelsForLongEdge(3840, 2160, l.previewLongEdge);
    assert.ok(rgbaBytesForPixels(pixels) * 6 <= b.maxCacheBytes, `${cls}: six previews fit`);
  }
});

test('a class name the table does not hold falls back to the middle of the table', () => {
  // A budget crosses a structured clone and can be read back from a stored
  // record, so a name no longer in the table reaches here without a type error.
  const budget = decodeBudgetFor('tablet' as DeviceClassV1);
  assert.deepEqual(budget, { ...DECODE_BUDGETS.laptop });
  assert.equal(Number.isFinite(budget.maxCacheBytes), true);
});
