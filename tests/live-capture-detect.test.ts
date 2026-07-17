// SPDX-License-Identifier: MPL-2.0
// Contract tests for the live-capture stage locator
// (shells/web/src/bridge/live-capture-detect.ts). DOM-free by design — synthetic
// RGBA frames stand in for the sampled display capture; the <video>/canvas
// sampling stays in live-capture.ts and needs a real browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMagenta, isGreen, findSolidRect, rectIoU, intersectRect,
  createStageLocator, scaleRect,
} from '../shells/web/src/bridge/live-capture-detect.ts';
import type { FrameLike, Rect } from '../shells/web/src/bridge/live-capture-detect.ts';

const MAGENTA: [number, number, number] = [255, 0, 255];
const GREEN: [number, number, number] = [0, 255, 0];
const GREY: [number, number, number] = [90, 95, 100];

function frame(width: number, height: number, bg: [number, number, number] = GREY): FrameLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

function paintRect(f: FrameLike, r: Rect, [cr, cg, cb]: [number, number, number]): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * f.width + x) * 4;
      f.data[i] = cr; f.data[i + 1] = cg; f.data[i + 2] = cb;
    }
  }
}

/** Blend a 2px border of `r` toward the background — encoder edge fuzz. */
function blurEdges(f: FrameLike, r: Rect): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const edge = Math.min(x - r.x, r.x + r.w - 1 - x, y - r.y, r.y + r.h - 1 - y);
      if (edge >= 2) continue;
      const i = (y * f.width + x) * 4;
      const k = edge === 0 ? 0.45 : 0.75;   // outermost ring blends hardest
      for (let c = 0; c < 3; c++) f.data[i + c] = Math.round(f.data[i + c]! * k + GREY[c]! * (1 - k));
    }
  }
}

test('classifiers accept the calibration colours and reject chrome-ish pixels', () => {
  assert.ok(isMagenta(...MAGENTA));
  assert.ok(isMagenta(220, 60, 210), 'compressed magenta still reads');
  assert.ok(!isMagenta(...GREEN));
  assert.ok(!isMagenta(...GREY));
  assert.ok(isGreen(...GREEN));
  assert.ok(isGreen(70, 200, 80), 'compressed green still reads');
  assert.ok(!isGreen(...MAGENTA));
  assert.ok(!isGreen(200, 200, 200), 'white/grey never reads as a flash');
});

test('findSolidRect returns the exact box of a clean flash', () => {
  const f = frame(320, 180);
  const box = { x: 40, y: 30, w: 200, h: 100 };
  paintRect(f, box, MAGENTA);
  assert.deepEqual(findSolidRect(f, isMagenta), box);
});

test('findSolidRect tolerates encoder edge blur within ~2px', () => {
  const f = frame(320, 180);
  const box = { x: 40, y: 30, w: 200, h: 100 };
  paintRect(f, box, MAGENTA);
  blurEdges(f, box);
  const got = findSolidRect(f, isMagenta);
  assert.ok(got, 'blurred flash must still be found');
  for (const [k, v] of Object.entries(got!)) {
    assert.ok(Math.abs(v - box[k as keyof Rect]) <= 4, `${k} drifted: ${v} vs ${box[k as keyof Rect]}`);
  }
});

test('findSolidRect rejects scattered matches and specks', () => {
  const scattered = frame(320, 180);
  // 6% of pixels magenta at deterministic pseudo-random spots — a big bounding
  // box with a hopeless fill ratio.
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 320 * 180 * 0.06; i++) {
    paintRect(scattered, { x: Math.floor(rand() * 319), y: Math.floor(rand() * 179), w: 1, h: 1 }, MAGENTA);
  }
  assert.equal(findSolidRect(scattered, isMagenta), null, 'scatter must not read as a stage');

  const speck = frame(320, 180);
  paintRect(speck, { x: 10, y: 10, w: 3, h: 3 }, MAGENTA);
  assert.equal(findSolidRect(speck, isMagenta), null, 'a speck is below the area floor');
});

test('rectIoU and intersectRect agree on overlap', () => {
  const a = { x: 0, y: 0, w: 100, h: 100 };
  const b = { x: 50, y: 0, w: 100, h: 100 };
  assert.equal(rectIoU(a, a), 1);
  assert.ok(Math.abs(rectIoU(a, b) - 50 / 150) < 1e-9);
  assert.deepEqual(intersectRect(a, b), { x: 50, y: 0, w: 50, h: 100 });
  assert.equal(intersectRect(a, { x: 200, y: 200, w: 10, h: 10 }), null);
  assert.equal(rectIoU(a, { x: 200, y: 200, w: 10, h: 10 }), 0);
});

test('locator confirms only when both flashes land on the same box', () => {
  const box = { x: 40, y: 30, w: 200, h: 100 };
  const noise = frame(320, 180);

  const locator = createStageLocator();
  assert.equal(locator.phase, 'seek-a');
  assert.equal(locator.feed(noise), null, 'noise alone finds nothing');

  const m = frame(320, 180); paintRect(m, box, MAGENTA);
  assert.equal(locator.feed(m), null, 'magenta alone is not confirmation');
  assert.equal(locator.phase, 'seek-b');

  // Green somewhere ELSE — a green terminal window, not our stage.
  const gElse = frame(320, 180); paintRect(gElse, { x: 10, y: 120, w: 120, h: 50 }, GREEN);
  assert.equal(locator.feed(gElse), null, 'a displaced green box must not confirm');
  assert.equal(locator.phase, 'seek-b');

  const g = frame(320, 180); paintRect(g, { x: box.x + 1, y: box.y, w: box.w - 1, h: box.h }, GREEN);
  const got = locator.feed(g);
  assert.ok(got, 'matching green confirms the stage');
  assert.equal(locator.phase, 'done');
  // Intersection of the two reads — never larger than either flash.
  assert.deepEqual(got, { x: box.x + 1, y: box.y, w: box.w - 1, h: box.h });
  assert.equal(locator.feed(g), null, 'a done locator stays done');
});

test('a lone magenta wallpaper never confirms without the green pass', () => {
  const locator = createStageLocator();
  const m = frame(320, 180); paintRect(m, { x: 0, y: 0, w: 320, h: 180 }, MAGENTA);
  for (let i = 0; i < 10; i++) assert.equal(locator.feed(m), null);
  assert.equal(locator.phase, 'seek-b');
});

test('scaleRect covers the detected box and clamps to the video bounds', () => {
  // 320-wide sample of a 1280-wide video: ×4 exact.
  assert.deepEqual(scaleRect({ x: 40, y: 30, w: 200, h: 100 }, 4, 4, 1280, 720),
    { x: 160, y: 120, w: 800, h: 400 });
  // Non-integer scale: position floors, size ceils — never undershoots.
  const r = scaleRect({ x: 3, y: 3, w: 10, h: 10 }, 1.5, 1.5, 100, 100);
  assert.deepEqual(r, { x: 4, y: 4, w: 15, h: 15 });
  // At the video edge the rect clamps instead of spilling out.
  const edge = scaleRect({ x: 310, y: 170, w: 10, h: 10 }, 4, 4, 1280, 720);
  assert.equal(edge.x + edge.w, 1280);
  assert.equal(edge.y + edge.h, 720);
});
