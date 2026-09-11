// SPDX-License-Identifier: MPL-2.0
/**
 * host.ocr runner - the PURE math (lib/ocr.ts): the CTC greedy decode, the DBNet
 * connected-component boxing, the box unclip, and the reading-order sort. The
 * ORT/canvas orchestration around these is not testable headlessly (no weights, no
 * onnxruntime-web in the dev env), so these four are what the suite pins - and they
 * are exactly where a silent wrongness would live (a bad CTC collapse or blank
 * handling ruins the text without crashing).
 *
 * Run: node --import ./tests/css-stub.mjs --test shells/web/src/lib/ocr.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ctcGreedyDecode, connectedComponentBoxes, unclipBox, orderBoxesReadingOrder } from './ocr.ts';

// charset[0] is the CTC blank; the rest map argmax indices to glyphs.
const CHARSET = ['', 'a', 'b', ' '];

/** Build a T×C probability matrix from a per-step argmax class + its peak prob. */
function probsFrom(steps: Array<[cls: number, p: number]>, C: number): Float32Array {
  const out = new Float32Array(steps.length * C);
  steps.forEach(([cls, p], t) => {
    for (let c = 0; c < C; c++) out[t * C + c] = c === cls ? p : (1 - p) / (C - 1);
  });
  return out;
}

test('CTC decode collapses repeats, then drops the blank (in that order)', () => {
  // argmax stream: a a <blank> b b  →  "ab"
  const probs = probsFrom([[1, 0.8], [1, 0.7], [0, 0.9], [2, 0.75], [2, 0.6]], 4);
  const r = ctcGreedyDecode(probs, 5, 4, CHARSET);
  assert.equal(r.text, 'ab');
  // confidence = mean of the two KEPT steps' peaks (0.8, 0.75).
  assert.ok(Math.abs(r.confidence - (0.8 + 0.75) / 2) < 1e-6);
});

test('CTC decode keeps a genuine repeat that is separated by a blank', () => {
  // a <blank> a  →  "aa" (the blank breaks the run, so the second a is NOT collapsed)
  const probs = probsFrom([[1, 0.9], [0, 0.8], [1, 0.85]], 4);
  assert.equal(ctcGreedyDecode(probs, 3, 4, CHARSET).text, 'aa');
});

test('CTC decode of an all-blank stream is empty with zero confidence', () => {
  const probs = probsFrom([[0, 0.9], [0, 0.9]], 4);
  const r = ctcGreedyDecode(probs, 2, 4, CHARSET);
  assert.equal(r.text, '');
  assert.equal(r.confidence, 0);
});

test('DBNet boxing finds two separated text blobs, filters noise', () => {
  // 6×3 map: a blob at columns 0-1 and another at columns 4-5, rows 0-1.
  const w = 6, h = 3;
  const p = new Float32Array(w * h);
  const hot = (x: number, y: number): void => { p[y * w + x] = 0.9; };
  hot(0, 0); hot(1, 0); hot(0, 1); hot(1, 1);
  hot(4, 0); hot(5, 0); hot(4, 1); hot(5, 1);
  p[2 * w + 3] = 0.9; // a lone speck that must be filtered by minArea
  const boxes = connectedComponentBoxes(p, w, h, { binThresh: 0.3, minArea: 3, boxThresh: 0.3 });
  assert.equal(boxes.length, 2, 'two blobs, the 1-pixel speck dropped');
  const xs = boxes.map((b) => b.x).sort((a, b) => a - b);
  assert.deepEqual(xs, [0, 4]);
  assert.ok(boxes.every((b) => b.w === 2 && b.h === 2 && b.score > 0.8));
});

test('DBNet boxing drops a whole blob below boxThresh', () => {
  const w = 4, h = 2;
  const p = new Float32Array(w * h).fill(0);
  p[0] = 0.4; p[1] = 0.4; p[4] = 0.4; p[5] = 0.4; // a 2×2 blob, mean 0.4
  assert.equal(connectedComponentBoxes(p, w, h, { binThresh: 0.3, minArea: 3, boxThresh: 0.6 }).length, 0);
  assert.equal(connectedComponentBoxes(p, w, h, { binThresh: 0.3, minArea: 3, boxThresh: 0.3 }).length, 1);
});

test('unclip expands a box and clamps to the bounds', () => {
  const b = unclipBox({ x: 10, y: 10, w: 20, h: 10 }, 1.6, { w: 100, h: 100 });
  assert.ok(b.x < 10 && b.y < 10, 'expanded outward');
  assert.ok(b.x + b.w > 30 && b.y + b.h > 20);
  // A box against the edge cannot expand past 0.
  const edge = unclipBox({ x: 0, y: 0, w: 20, h: 10 }, 1.6, { w: 100, h: 100 });
  assert.equal(edge.x, 0);
  assert.equal(edge.y, 0);
});

test('reading order is top-to-bottom, then left-to-right within a line', () => {
  // Two lines: (y~0) has boxes at x=40 then x=0; (y~20) has x=5. Fed out of order.
  const boxes = [
    { x: 5, y: 20, w: 10, h: 8, tag: 'line2' },
    { x: 40, y: 0, w: 10, h: 8, tag: 'a-right' },
    { x: 0, y: 1, w: 10, h: 8, tag: 'a-left' },
  ];
  const ordered = orderBoxesReadingOrder(boxes).map((b) => b.tag);
  assert.deepEqual(ordered, ['a-left', 'a-right', 'line2']);
});
