// SPDX-License-Identifier: MPL-2.0
/**
 * Region finding for flattened slides (plan 274 section 6, point 1), over
 * synthetic RGBA slides drawn here: rows of small blocks that stand for text,
 * a continuous-tone block that stands for a photograph, a thin rule, and a
 * coloured band with light text knocked out of it. Each gives the class it
 * should, the result is deterministic, and the work stays inside the bound the
 * module header states.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cropRgba,
  detailShare,
  findSlideRegions,
  groundOfRegion,
  inkAbove,
  inkAngleOf,
  inkBounds,
  inkColourOf,
  inkCoverage,
  largestFreeBox,
  lineGlyphsOf,
  lineGroundOf,
  lineInkColourOf,
  maskedImageOf,
  outlineColourOf,
  outlinedBoxes,
  paintOutBoxes,
  strokeRatioOf,
  textBoundsOf,
  type RgbaImageV1,
  type SlideRegionV1,
} from '../engine/src/slide-regions.ts';

type Rgb = [number, number, number];

function page(w: number, h: number, ground: (x: number, y: number) => Rgb): RgbaImageV1 {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = ground(x, y);
      const i = (y * w + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

function fill(img: RgbaImageV1, x0: number, y0: number, w: number, h: number, colour: (x: number, y: number) => Rgb): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const c = colour(x, y);
      const i = (y * img.width + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
    }
  }
}

/** One line of "words": each word is `letters` blocks 10 by 16 px, 4 px apart, words 16 px apart. */
function words(img: RgbaImageV1, x: number, y: number, letters: number[], ink: Rgb): number {
  let cursor = x;
  for (const n of letters) {
    for (let k = 0; k < n; k++) {
      // Letters of two heights, the way ascenders stand above x-height letters.
      const tall = (k + n) % 3 === 0;
      fill(img, cursor, tall ? y : y + 5, 10, tall ? 16 : 11, () => ink);
      cursor += 14;
    }
    cursor += 16;
  }
  return cursor;
}

/** A photograph stand-in: colours that are not blends of one ink and the page. */
const photo = (x: number, y: number): Rgb => [(x * 7) % 256, (y * 5) % 256, ((x + y) * 3) % 256];

function drawSlide(ground: (x: number, y: number) => Rgb = () => [255, 255, 255]): RgbaImageV1 {
  const img = page(1280, 720, ground);
  for (let row = 0; row < 3; row++) words(img, 80, 100 + row * 32, [5, 3, 7, 4, 6], [40, 40, 48]);
  fill(img, 760, 100, 420, 340, photo);
  fill(img, 80, 520, 1120, 3, () => [120, 120, 128]);
  fill(img, 0, 600, 1280, 100, () => [31, 78, 121]);
  words(img, 80, 640, [6, 4, 5], [255, 255, 255]);
  return img;
}

const kinds = (regions: SlideRegionV1[]): string[] => regions.map((r) => `${r.id}:${r.kind}`);

test('rows of small blocks are text, a continuous-tone block is a picture, a thin line is a rule, a band is a panel with its text inside', () => {
  const result = findSlideRegions(drawSlide());
  assert.equal(result.complete, true);
  assert.equal(result.background, '#ffffff');
  assert.equal(result.backgroundModel, 'flat');
  assert.deepEqual(kinds(result.regions), ['r1:text', 'r2:picture', 'r3:rule', 'r4:panel', 'r4.1:text']);

  const [text, picture, rule, band, knocked] = result.regions;
  assert.ok(text && picture && rule && band && knocked);
  // Three rows of words merge into one block around them.
  assert.ok(text.box.x <= 80 && text.box.y <= 100 && text.box.x + text.box.w >= 440 && text.box.y + text.box.h >= 180, JSON.stringify(text.box));
  assert.equal(text.evidence.reason, 'components-in-rows');
  assert.ok(text.evidence.rows >= 3);
  assert.equal(text.evidence.ink, '#282830');
  assert.deepEqual(
    [picture.box.x, picture.box.y, picture.box.w, picture.box.h].map((n) => Math.round(n / 4) * 4),
    [760, 100, 420, 340],
  );
  assert.equal(picture.evidence.reason, 'continuous-tone');
  assert.equal(rule.evidence.orientation, 'horizontal');
  assert.ok(rule.box.w >= 1100 && rule.box.h <= 6);
  assert.equal(band.evidence.ink, '#1f4e79');
  assert.equal(knocked.parent, 'r4');
  assert.equal(knocked.evidence.ground, '#1f4e79');
  assert.equal(knocked.evidence.ink, '#ffffff');
});

test('the result is deterministic, and the same regions come back with noise on the page', () => {
  const a = findSlideRegions(drawSlide());
  const b = findSlideRegions(drawSlide());
  assert.deepEqual(a, b);
  // A fixed pseudo-random speckle, like compression noise, of up to 7 per channel.
  let seed = 7;
  const noise = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % 8;
  };
  const noisy = findSlideRegions(drawSlide(() => [248 + noise(), 248 + noise(), 248 + noise()]));
  assert.deepEqual(kinds(noisy.regions), kinds(a.regions));
});

test('a gradient page is fitted as a surface, so the text on it is still text', () => {
  const img = drawSlide((x) => [255 - Math.round((x / 1280) * 90), 235, 235]);
  const result = findSlideRegions(img);
  assert.equal(result.backgroundModel, 'surface');
  assert.equal(result.regions[0]?.kind, 'text');
  assert.equal(result.regions[1]?.kind, 'picture');
  // The surface travels with the result, so a caller measures ink against it rather than one colour.
  assert.equal(result.surface?.length, 3);
  const text = result.regions[0];
  assert.ok(text);
  const ground = groundOfRegion(result, text);
  assert.equal(typeof ground, 'object');
  // Across the page the gradient drifts 90 over the threshold of 30: one flat colour would call the drift ink.
  const wide = { x: 0, y: 40, w: 1280, h: 40 };
  assert.equal(inkCoverage(img, wide, ground, result.threshold, []).ink, 0);
  assert.ok(inkCoverage(img, wide, text.evidence.ground, result.threshold, []).ink > 0);
});

/** A band 200 px tall with one line of black words `gap` px under it. */
function bandWithCaption(gap: number): RgbaImageV1 {
  const img = page(1280, 720, () => [255, 255, 255]);
  fill(img, 100, 100, 1080, 200, () => [31, 78, 121]);
  words(img, 100, 300 + gap, [5, 3, 7, 4, 6], [0, 0, 0]);
  return img;
}

test('a caption close under a band is text of its own, and the band keeps its own box', () => {
  for (const gap of [3, 6, 10]) {
    const result = findSlideRegions(bandWithCaption(gap));
    assert.deepEqual(kinds(result.regions), ['r1:panel', 'r2:text'], `gap ${gap}: ${kinds(result.regions).join(' ')}`);
    const [band, caption] = result.regions;
    assert.deepEqual(band?.box, { x: 100, y: 100, w: 1080, h: 200 }, `gap ${gap}`);
    assert.equal(caption?.box.y, 300 + gap);
    assert.equal(caption?.evidence.ink, '#000000');
  }
});

test('text in a window knocked out of a band belongs to the band alone, so no pixels have two regions', () => {
  const img = page(960, 540, () => [255, 255, 255]);
  fill(img, 100, 100, 760, 300, () => [31, 78, 121]);
  fill(img, 300, 180, 300, 120, () => [255, 255, 255]);
  words(img, 330, 220, [5, 4, 6], [0, 0, 0]);
  words(img, 330, 260, [4, 6, 5], [0, 0, 0]);
  const result = findSlideRegions(img);
  const text = result.regions.filter((r) => r.kind === 'text');
  assert.ok(text.length > 0);
  assert.ok(
    text.every((r) => r.parent === 'r1.1'),
    kinds(result.regions).join(' '),
  );
  const boxes = result.regions.map((r) => JSON.stringify(r.box));
  assert.equal(new Set(boxes).size, boxes.length);
  assert.equal(result.regions.filter((r) => r.depth === 0).length, 1);
});

test('a line in another colour stays its own block, and a line colour can be read inside a region', () => {
  const img = page(1280, 720, () => [255, 255, 255]);
  words(img, 80, 100, [5, 3, 7, 4, 6], [220, 40, 40]);
  for (let row = 1; row < 4; row++) words(img, 80, 100 + row * 32, [5, 3, 7, 4, 6], [30, 30, 30]);
  const result = findSlideRegions(img);
  assert.deepEqual(kinds(result.regions), ['r1:text', 'r2:text']);
  assert.equal(result.regions[0]?.evidence.ink, '#dc2828');
  assert.equal(result.regions[1]?.evidence.ink, '#1e1e1e');
  assert.equal(inkColourOf(img, { x: 80, y: 100, w: 410, h: 16 }, '#ffffff', 30), '#dc2828');
  assert.equal(inkColourOf(img, { x: 0, y: 0, w: 40, h: 40 }, '#ffffff', 30), null);
});

test('a table grid gives its lines up as rules and its cells stay separate text', () => {
  const img = page(1280, 720, () => [255, 255, 255]);
  const grey: Rgb = [150, 150, 150];
  for (const y of [100, 200, 300]) fill(img, 100, y, 1000, 2, () => grey);
  for (const x of [100, 600, 1098]) fill(img, x, 100, 2, 202, () => grey);
  words(img, 130, 140, [5, 4], [20, 20, 20]);
  words(img, 630, 140, [6, 3], [20, 20, 20]);
  words(img, 130, 240, [4, 4, 3], [20, 20, 20]);
  words(img, 630, 240, [3, 5], [20, 20, 20]);
  const result = findSlideRegions(img);
  const count = (k: string): number => result.regions.filter((r) => r.kind === k).length;
  assert.equal(count('text'), 4, kinds(result.regions).join(' '));
  assert.ok(count('rule') >= 5, kinds(result.regions).join(' '));
  assert.equal(count('picture'), 0);
});

test('work stays inside the stated bound on a 1920 by 1080 page, and a cap marks the result incomplete', () => {
  const img = page(1920, 1080, () => [255, 255, 255]);
  for (let row = 0; row < 12; row++) words(img, 100, 100 + row * 60, [5, 7, 4, 6, 3, 8], [30, 30, 30]);
  fill(img, 1200, 100, 600, 500, photo);
  fill(img, 0, 900, 1920, 120, () => [200, 40, 40]);
  words(img, 100, 950, [4, 6], [255, 255, 255]);
  const result = findSlideRegions(img);
  const pixels = 1920 * 1080;
  assert.ok(result.work.pixelReads <= 3 * pixels + 256 * 4096 + 8192, `reads ${result.work.pixelReads}`);
  assert.ok(result.cell <= 4);

  const capped = findSlideRegions(img, { maxRegions: 1 });
  assert.equal(capped.complete, false);
  assert.ok(capped.dropped > 0);
});

test('crop copies one box, and ink coverage says how much of a region some boxes explain', () => {
  const img = drawSlide();
  const crop = cropRgba(img, { x: 760, y: 100, w: 10, h: 10 }, 2);
  assert.deepEqual([crop.x, crop.y, crop.width, crop.height], [758, 98, 14, 14]);
  assert.equal(crop.data.length, 14 * 14 * 4);
  const box = { x: 80, y: 100, w: 400, h: 90 };
  const all = inkCoverage(img, box, '#ffffff', 30, [box]);
  assert.equal(all.share, 1);
  const half = inkCoverage(img, box, '#ffffff', 30, [{ x: 80, y: 100, w: 400, h: 30 }]);
  assert.ok(half.share > 0.2 && half.share < 0.5, String(half.share));
  // A padded detector box around the first row of words shrinks to the ink.
  assert.deepEqual(inkBounds(img, { x: 70, y: 92, w: 440, h: 30 }, '#ffffff', 30), { x: 80, y: 100, w: 410, h: 16 });
  assert.equal(inkBounds(img, { x: 0, y: 0, w: 40, h: 40 }, '#ffffff', 30), null);
});

test('an image without enough bytes is refused rather than read past its end', () => {
  assert.throws(() => findSlideRegions({ width: 10, height: 10, data: new Uint8ClampedArray(10) }), /width \* height \* 4/);
});

// ─── helpers for a page read by a text detector first (plan 275 WP10) ────────

test('a mask leaves the located text out of every reading, so a panel under it stays one panel and the text is gone', () => {
  const img = page(1280, 720, () => [250, 250, 250]);
  fill(img, 200, 200, 500, 300, () => [30, 90, 160]);
  words(img, 240, 300, [6, 4, 7], [255, 255, 255]);
  const bare = findSlideRegions(img);
  const panel = bare.regions.find((r) => r.kind === 'panel');
  assert.ok(panel, 'the band is a panel');
  assert.ok(bare.regions.some((r) => r.parent === panel.id && r.kind === 'text'), 'unmasked, its text is found inside it');

  const text = { x: 236, y: 296, w: 280, h: 24 };
  const masked = findSlideRegions(img, { mask: [text] });
  const again = masked.regions.find((r) => r.kind === 'panel');
  assert.ok(again);
  assert.deepEqual(again.box, panel.box);
  assert.ok(!masked.regions.some((r) => r.parent === again.id), 'masked, nothing is left inside the panel');
  assert.ok(masked.work.pixelReads > bare.work.pixelReads, 'the fill is counted as work');

  // The image passed in is not changed, and the masked copy is the panel's colour where the text was.
  const copy = maskedImageOf(img, [text]);
  assert.notEqual(copy.data, img.data);
  const at = (d: RgbaImageV1['data'], x: number, y: number): number[] => Array.from(d.subarray((y * 1280 + x) * 4, (y * 1280 + x) * 4 + 3));
  assert.deepEqual(at(img.data, 245, 310), [255, 255, 255]);
  assert.deepEqual(at(copy.data, 245, 310), [30, 90, 160]);
});

test('the largest text-free box of a picture avoids every obstacle and is the whole box with none', () => {
  const box = { x: 0, y: 0, w: 1000, h: 600 };
  assert.deepEqual(largestFreeBox(box, []), box);
  // A title band across the top and a line on the left: the largest free part
  // is the full width under the line, larger than the part right of it.
  const free = largestFreeBox(box, [{ x: 0, y: 0, w: 1000, h: 100 }, { x: 0, y: 150, w: 300, h: 40 }]);
  assert.deepEqual(free, { x: 0, y: 190, w: 1000, h: 410 });
  const tall = largestFreeBox(box, [{ x: 0, y: 0, w: 1000, h: 100 }, { x: 0, y: 150, w: 300, h: 400 }]);
  assert.deepEqual(tall, { x: 300, y: 100, w: 700, h: 500 });
  // Covered whole, nothing is left.
  assert.equal(largestFreeBox(box, [{ x: -10, y: -10, w: 1100, h: 700 }]), null);
});

test('a line is measured by the colour of its text, not by a drawing behind it', () => {
  const img = page(600, 120, () => [240, 243, 246]);
  // A faded drawing across the whole line box, and dark text 20 px tall in its middle.
  fill(img, 0, 0, 600, 4, () => [215, 220, 225]);
  fill(img, 0, 116, 600, 4, () => [215, 220, 225]);
  words(img, 40, 50, [5, 4], [30, 30, 30]);
  const box = { x: 20, y: 0, w: 400, h: 120 };
  const ground = outlineColourOf(img, { x: 20, y: 10, w: 400, h: 100 });
  assert.equal(ground, '#f0f3f6');
  assert.deepEqual(inkBounds(img, box, ground ?? '#ffffff', 30)?.h, 120, 'every inked row counts for plain ink bounds');
  const text = textBoundsOf(img, box, ground ?? '#ffffff', 30);
  assert.ok(text);
  assert.equal(text.y, 50);
  assert.equal(text.h, 16);
});

test('detail tells a drawing from plain ground, however steep the gradient', () => {
  const smooth = page(400, 300, (x, y) => [Math.round((x / 400) * 200), 120, Math.round((y / 300) * 200)]);
  assert.equal(detailShare(smooth, { x: 0, y: 0, w: 400, h: 300 }), 0);
  const drawn = page(400, 300, () => [240, 240, 240]);
  for (let k = 0; k < 20; k++) fill(drawn, 10 + k * 19, 20, 3, 260, () => [40, 40, 40]);
  assert.ok(detailShare(drawn, { x: 0, y: 0, w: 400, h: 300 }) > 0.05);
});

test('an icon standing over a label is found on a lit card, and a card edge beside it is not taken for it', () => {
  // A card lit from its top left, a ring over the label, and the card's edge down the left.
  const img = page(800, 600, () => [200, 225, 210]);
  fill(img, 100, 50, 400, 500, (x, y) => [Math.round(250 - (x - 100) * 0.1 - (y - 50) * 0.12), 245, 240]);
  fill(img, 100, 50, 6, 500, () => [60, 90, 70]);
  for (let y = 120; y <= 240; y++) {
    for (let x = 240; x <= 360; x++) {
      const d = Math.hypot(x - 300, y - 180);
      if (d <= 60 && d >= 52) fill(img, x, y, 1, 1, () => [20, 80, 50]);
    }
  }
  const label = { x: 200, y: 330, w: 200, h: 40 };
  const icon = inkAbove(img, { x: 104, y: 60, w: 392, h: 265 }, label, 40, 48, 5);
  assert.ok(icon);
  assert.ok(Math.abs(icon.x - 240) <= 2 && Math.abs(icon.y - 120) <= 2 && Math.abs(icon.w - 121) <= 3 && Math.abs(icon.h - 121) <= 3, JSON.stringify(icon));
  // Nothing over the label: no icon.
  assert.equal(inkAbove(img, { x: 104, y: 400, w: 392, h: 100 }, { x: 200, w: 200 }, 40, 48, 5), null);
});

test('four rules around a box are an outlined box, fragments joined, and a table frame gives no cells', () => {
  const img = page(1280, 720, () => [251, 251, 251]);
  // A callout: an outline 3 px thick, its top drawn in two pieces with a small break.
  fill(img, 680, 200, 250, 3, () => [110, 110, 110]);
  fill(img, 940, 200, 280, 3, () => [110, 110, 110]);
  fill(img, 680, 557, 540, 3, () => [110, 110, 110]);
  fill(img, 680, 200, 3, 360, () => [110, 110, 110]);
  fill(img, 1217, 200, 3, 360, () => [110, 110, 110]);
  // A table on the left: lines running past its cells.
  for (const y of [180, 330, 480]) fill(img, 48, y, 552, 2, () => [150, 150, 150]);
  fill(img, 200, 180, 2, 302, () => [150, 150, 150]);
  const found = findSlideRegions(img);
  const boxes = outlinedBoxes(found);
  assert.equal(boxes.length, 1, JSON.stringify(boxes));
  const [callout] = boxes;
  assert.ok(callout);
  assert.ok(Math.abs(callout.box.x - 680) <= 3 && Math.abs(callout.box.y - 200) <= 3, JSON.stringify(callout.box));
  assert.ok(Math.abs(callout.box.w - 540) <= 4 && Math.abs(callout.box.h - 360) <= 4, JSON.stringify(callout.box));
  assert.equal(callout.line, '#6e6e6e');
  assert.ok(callout.rules.length >= 4);
});

// ─── a line's own colour, ground and weight (plan 275 WP10) ──────────────────

/** Strokes of letters: 3 px wide uprights every 9 px, `thick` px wide when bold, inside a line box padded above and below. */
function strokes(img: RgbaImageV1, x0: number, y0: number, count: number, ink: Rgb, thick = 3): void {
  for (let k = 0; k < count; k++) fill(img, x0 + k * 9, y0, thick, 20, () => ink);
}

test('a line on a gradient reads its dark text as dark, not the pale end of the ground', () => {
  // Pink to white across the line, the ink dark: one colour for the whole box (its
  // outline's commonest) counts the pink end as ink, and the pink outnumbers the letters.
  const img = page(600, 100, (x) => [250, 250 - Math.round((1 - x / 600) * 70), 250 - Math.round((1 - x / 600) * 70)]);
  strokes(img, 20, 40, 60, [40, 42, 45]);
  const box = { x: 10, y: 32, w: 560, h: 36 };
  const read = lineInkColourOf(img, box);
  assert.ok(read);
  const hex = Number.parseInt(read.ink.slice(1), 16);
  assert.ok(((hex >> 16) & 255) < 80, `the ink is dark: ${read.ink}`);
  // The ground follows the gradient: pinker on the left than on the right.
  const along = lineGroundOf(img, box);
  const first = along.colours[0];
  const last = along.colours[along.colours.length - 1];
  assert.ok(first && last && first[1] < last[1] - 30, `${JSON.stringify(first)} to ${JSON.stringify(last)}`);
});

test('white text with a dark drop shadow on dark green reads white', () => {
  const img = page(400, 80, () => [19, 55, 45]);
  for (let k = 0; k < 30; k++) {
    // The shadow, 2 px down and right and softer, then the letter.
    fill(img, 22 + k * 9, 22, 4, 20, () => [8, 26, 21]);
    fill(img, 20 + k * 9, 20, 3, 20, () => [250, 252, 250]);
  }
  const read = lineInkColourOf(img, { x: 10, y: 12, w: 300, h: 36 });
  assert.ok(read);
  assert.equal(read.ink, '#fafcfa');
  assert.equal(read.ground, '#13372d');
});

test('a bold line has heavier strokes for its height than a regular one', () => {
  const img = page(400, 120, () => [255, 255, 255]);
  strokes(img, 20, 20, 30, [20, 20, 20], 2);
  strokes(img, 20, 70, 30, [20, 20, 20], 4);
  const regular = strokeRatioOf(img, { x: 10, y: 15, w: 300, h: 30 }, '#141414');
  const bold = strokeRatioOf(img, { x: 10, y: 65, w: 300, h: 30 }, '#141414');
  assert.ok(regular !== null && bold !== null);
  assert.ok(bold >= 1.8 * regular, `${bold} against ${regular}`);
  assert.equal(strokeRatioOf(img, { x: 350, y: 0, w: 40, h: 40 }, '#141414'), null, 'no ink, no weight');
});

// ─── the characters of one line (plan 275 WP10 part B) ──────────────────────

/**
 * A line of "letters" drawn as separate upright blocks, one per character of
 * `text` (a space is a wider gap), each `stem` px wide in its own colour; the
 * box pads 8 px above and below, where the ground is read. Returns the box.
 */
function letterLine(img: RgbaImageV1, x0: number, y0: number, text: string, ink: (k: number) => Rgb, stem: (k: number) => number = () => 6): { x: number; y: number; w: number; h: number } {
  let x = x0;
  Array.from(text).forEach((ch, k) => {
    if (ch === ' ') {
      x += 12;
      return;
    }
    const w = stem(k);
    fill(img, x, y0, w, 24, () => ink(k));
    x += w + 4;
  });
  return { x: x0 - 6, y: y0 - 8, w: x - x0 + 12, h: 40 };
}

test('a stretch drawn in its own colour, with a sharp change at each end, reads in that colour', () => {
  const img = page(500, 80, () => [31, 90, 62]);
  const white: Rgb = [252, 254, 253];
  const mint: Rgb = [179, 234, 203];
  const text = 'own it at all?';
  // "ll?" in mint, the way a title marks its last word.
  const box = letterLine(img, 20, 24, text, (k) => (k >= 11 ? mint : white));
  const read = lineGlyphsOf(img, box, text);
  assert.ok(read);
  assert.equal(read.text, text, 'no quote or dash to put right');
  const inks = read.inks;
  assert.equal(inks[0], '#fcfefd', 'the line colour');
  for (const k of [11, 12, 13]) assert.notEqual(inks[k], inks[0], `character ${k} reads in its own colour`);
  for (const k of [0, 1, 2, 4, 5, 7, 8, 10]) assert.equal(inks[k], inks[0], `character ${k} reads in the line colour`);
  assert.equal(inks[3], null, 'a space has no ink');
  assert.equal(read.measured, 11, 'every letter sits on ink of its own');
});

test('a line whose colour drifts along a gradient stays one colour, and a stray pale ground behind a letter is no colour of its own', () => {
  const img = page(600, 80, () => [250, 250, 250]);
  const text = 'the hidden cost of an task';
  // Maroon at the start drifting to near black, a little per letter.
  const n = Array.from(text).length;
  const box = letterLine(img, 20, 24, text, (k) => [Math.round(110 - (k / n) * 80), Math.round(20 + (k / n) * 20), Math.round(18 + (k / n) * 24)]);
  const read = lineGlyphsOf(img, box, text);
  assert.ok(read);
  const solid = read.inks.filter((ink): ink is string => ink !== null);
  assert.equal(new Set(solid).size, 1, `one colour: ${[...new Set(solid)].join(' ')}`);
});

test('a word set with wider stems reads heavier than the words beside it', () => {
  const img = page(500, 80, () => [255, 255, 255]);
  const text = 'Meet Lolly now';
  const box = letterLine(img, 20, 24, text, () => [20, 20, 20], (k) => (k >= 5 && k <= 9 ? 9 : 4));
  const read = lineGlyphsOf(img, box, text);
  assert.ok(read);
  const meet = read.stems[0];
  const lolly = read.stems[5];
  const now = read.stems[11];
  assert.ok(typeof meet === 'number' && typeof lolly === 'number' && typeof now === 'number');
  assert.ok(lolly >= 1.8 * meet && lolly >= 1.8 * now, `${lolly} against ${meet} and ${now}`);
  assert.equal(read.stems[4], null, 'a space has no stem');
});

test('a hyphen drawn as a long bar is an em dash, a short one stays a hyphen', () => {
  const img = page(600, 120, () => [255, 255, 255]);
  const ink: Rgb = [20, 24, 30];
  // "ab-cd": letters 24 px tall, the bar at dash height, 30 px long (over the
  // 0.75 of the ink height an em dash needs); below it the same with an 8 px bar.
  const draw = (y: number, bar: number): { x: number; y: number; w: number; h: number } => {
    let x = 20;
    for (let k = 0; k < 2; k++, x += 16) fill(img, x, y, 10, 24, () => ink);
    fill(img, x, y + 12, bar, 3, () => ink);
    x += bar + 6;
    for (let k = 0; k < 2; k++, x += 16) fill(img, x, y, 10, 24, () => ink);
    return { x: 14, y: y - 8, w: x - 8, h: 40 };
  };
  const long = lineGlyphsOf(img, draw(20, 30), 'ab-cd');
  const short = lineGlyphsOf(img, draw(70, 8), 'ab-cd');
  assert.equal(long?.text, 'ab\u2014cd');
  assert.equal(short?.text, 'ab-cd');
});

test('a quote mark drawn leaning with a heavy end is curly; one standing upright stays plain', () => {
  const img = page(400, 140, () => [255, 255, 255]);
  const ink: Rgb = [10, 10, 10];
  // "it's": letters 24 px tall, the mark in the top half, 12 px tall.
  const draw = (y: number, curly: boolean): { x: number; y: number; w: number; h: number } => {
    let x = 20;
    for (let k = 0; k < 2; k++, x += 16) fill(img, x, y, 10, 24, () => ink);
    if (curly) {
      // A 9: a heavy 5 px ball on top, then a tail leaning down to the left.
      fill(img, x + 2, y, 5, 5, () => ink);
      for (let r = 5; r < 12; r++) fill(img, x + 4 - Math.floor((r - 5) / 2), y + r, 2, 1, () => ink);
    } else {
      fill(img, x + 2, y, 3, 12, () => ink);
    }
    x += 12;
    fill(img, x, y + 6, 10, 18, () => ink);
    x += 16;
    return { x: 14, y: y - 8, w: x - 8, h: 40 };
  };
  const curly = lineGlyphsOf(img, draw(20, true), "it's");
  const plain = lineGlyphsOf(img, draw(80, false), "it's");
  assert.equal(curly?.text, 'it\u2019s');
  assert.equal(plain?.text, "it's");
});

test('text is painted out of a picture smoothly from the pixels around it, and nothing outside the boxes changes', () => {
  const img = page(64, 32, (x) => [x < 32 ? 200 : 40, 100, 50]);
  fill(img, 20, 10, 24, 8, () => [255, 255, 255]);
  const out = paintOutBoxes(img, [{ x: 20, y: 10, w: 24, h: 8 }]);
  const at = (x: number, y: number): number => out.data[(y * 64 + x) * 4] ?? -1;
  assert.equal(at(0, 0), 200);
  assert.equal(at(63, 31), 40);
  for (let x = 20; x < 44; x++) assert.ok(at(x, 14) >= 40 && at(x, 14) <= 200, `x ${x}: ${at(x, 14)} lies between the colours around it`);
  assert.ok(at(21, 14) > at(42, 14), 'the fill runs from the left colour to the right one');
  assert.equal(out.data[(14 * 64 + 30) * 4 + 1], 100, 'a channel the same all round stays the same');
  assert.equal(img.data[(14 * 64 + 30) * 4], 255, 'the picture passed in is not changed');
  assert.deepEqual(paintOutBoxes(img, []).data, img.data, 'no boxes, the same pixels');
});

test('ink running at an angle reads its angle and length; a level word reads level', () => {
  const img = page(200, 200, () => [10, 40, 35]);
  for (let k = 0; k < 120; k++) fill(img, 30 + k, 170 - k, 4, 4, () => [230, 250, 240]);
  const rising = inkAngleOf(img, { x: 20, y: 20, w: 170, h: 170 }, '#0a2823');
  assert.ok(rising);
  assert.ok(Math.abs(rising.degrees - 45) < 3, `${rising.degrees}`);
  assert.ok(rising.elongation > 5);
  const level = page(200, 60, () => [255, 255, 255]);
  words(level, 10, 20, [5, 4, 6], [20, 20, 20]);
  const flat = inkAngleOf(level, { x: 0, y: 10, w: 200, h: 40 }, '#ffffff');
  assert.ok(flat && Math.abs(flat.degrees) < 5, `${flat?.degrees}`);
  assert.equal(inkAngleOf(level, { x: 0, y: 0, w: 5, h: 5 }, '#ffffff'), null, 'no ink, no angle');
});
