// SPDX-License-Identifier: MPL-2.0
/**
 * pptxgen-import.test.ts - the pptxgenjs builder-script parser behind deck import.
 *
 * Run with: node --test "shells/web/src/**\/*.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePptxGenJs,
  snapColorToPalette,
  inchesToNative,
  type BrandColor,
  type TextElement,
  type ShapeElement,
  type ImageElement,
} from './pptxgen-import.ts';

/** A small, representative pptxgenjs builder covering every element kind. */
const SCRIPT = `
  const pptxgen = require("pptxgenjs");
  const p = new pptxgen();
  p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
  p.layout = "W";

  // Slide 1 - a plain string addText.
  const a = p.addSlide();
  a.background = { color: "0B1512" };
  a.addText("Hello world", {
    x: 0.6, y: 0.4, w: 12.1, h: 0.72,
    fontFace: "Calibri", fontSize: 40, bold: true, color: "FFFFFF", align: "left",
  });

  // Slide 2 - a run-array addText, a roundRect shape, and an image.
  const b = p.addSlide();
  b.background = { color: "0B1512" };
  b.addText(
    [
      { text: "Bold lead", options: { bold: true, color: "30BA78", fontSize: 18, breakLine: true } },
      { text: "soft tail", options: { color: "C3D0C9", fontSize: 12, italic: true } },
    ],
    { x: 1, y: 2, w: 5, h: 1, fontFace: "Calibri", valign: "top" },
  );
  b.addShape(p.ShapeType.roundRect, {
    x: 0.6, y: 3, w: 6.8, h: 0.9,
    fill: { color: "17251E" }, line: { type: "none" }, rectRadius: 0.08,
  });
  b.addImage({ path: "assets/logo.png", x: 8, y: 3, w: 2, h: 2 });

  p.writeFile({ fileName: "out.pptx" }).then(f => f);
`;

test('parsePptxGenJs captures layout, slides, elements, and palette', () => {
  const deck = parsePptxGenJs(SCRIPT);

  // Layout comes from the custom named layout the script defined + selected.
  assert.deepEqual(deck.layout, { wIn: 13.33, hIn: 7.5 });

  // Two slides, both with the dark background.
  assert.equal(deck.slides.length, 2);
  assert.equal(deck.slides[0]?.background, '0B1512');
  assert.equal(deck.slides[1]?.background, '0B1512');

  // Slide 1: a single text element from a plain string.
  const s1 = deck.slides[0]!;
  assert.equal(s1.elements.length, 1);
  const t1 = s1.elements[0] as TextElement;
  assert.equal(t1.type, 'text');
  assert.equal(t1.xIn, 0.6);
  assert.equal(t1.yIn, 0.4);
  assert.equal(t1.wIn, 12.1);
  assert.equal(t1.hIn, 0.72);
  assert.equal(t1.fontFace, 'Calibri');
  assert.equal(t1.align, 'left');
  assert.equal(t1.runs.length, 1);
  assert.deepEqual(t1.runs[0], {
    text: 'Hello world',
    bold: true,
    color: 'FFFFFF',
    sizePt: 40,
    font: 'Calibri',
  });

  // Slide 2: text (run array) + shape + image, in order.
  const s2 = deck.slides[1]!;
  assert.equal(s2.elements.length, 3);
  assert.deepEqual(
    s2.elements.map((e) => e.type),
    ['text', 'shape', 'image'],
  );

  const t2 = s2.elements[0] as TextElement;
  assert.equal(t2.valign, 'top');
  assert.equal(t2.runs.length, 2);
  assert.deepEqual(t2.runs[0], {
    text: 'Bold lead',
    bold: true,
    color: '30BA78',
    sizePt: 18,
    font: 'Calibri',
    breakLine: true,
  });
  assert.deepEqual(t2.runs[1], {
    text: 'soft tail',
    italic: true,
    color: 'C3D0C9',
    sizePt: 12,
    font: 'Calibri',
  });

  const shape = s2.elements[1] as ShapeElement;
  assert.equal(shape.type, 'shape');
  assert.equal(shape.shape, 'roundRect');
  assert.equal(shape.xIn, 0.6);
  assert.equal(shape.wIn, 6.8);
  assert.equal(shape.fill, '17251E');
  assert.equal(shape.radius, 0.08);
  // `line: { type: "none" }` is not a visible line - nothing recorded.
  assert.equal(shape.line, undefined);
  assert.equal(shape.rawShape, undefined);

  const img = s2.elements[2] as ImageElement;
  assert.equal(img.type, 'image');
  assert.equal(img.src, 'assets/logo.png');
  assert.equal(img.xIn, 8);
  assert.equal(img.hIn, 2);

  // Palette: every colour seen, deduped, uppercase, hash-less.
  assert.ok(deck.palette.includes('0B1512'));
  assert.ok(deck.palette.includes('FFFFFF'));
  assert.ok(deck.palette.includes('30BA78'));
  assert.ok(deck.palette.includes('C3D0C9'));
  assert.ok(deck.palette.includes('17251E'));
  // Deduped: the background colour used on both slides appears once.
  assert.equal(deck.palette.filter((c) => c === '0B1512').length, 1);
});

test('parsePptxGenJs rejects a non-pptxgenjs require with a clear error', () => {
  assert.throws(
    () => parsePptxGenJs('const fs = require("fs"); fs.readFileSync("/etc/passwd");'),
    /pptxgen-import: .*requires\('fs'\).*only 'pptxgenjs'/,
  );
});

test('parsePptxGenJs normalizes hash-prefixed and 3-digit hex, and preserves exotic shapes', () => {
  const deck = parsePptxGenJs(`
    const p = new (require("pptxgenjs"))();
    const s = p.addSlide();
    s.addShape(p.ShapeType.rightArrow, { x: 1, y: 1, w: 1, h: 1, fill: { color: "#abc" } });
  `);
  const shape = deck.slides[0]!.elements[0] as ShapeElement;
  assert.equal(shape.shape, 'rect'); // unknown shape falls back to rect
  assert.equal(shape.rawShape, 'rightArrow'); // ...but the original name is preserved
  assert.equal(shape.fill, 'AABBCC'); // #abc → AABBCC
  assert.ok(deck.palette.includes('AABBCC'));
});

test('parsePptxGenJs caps captured slides at 200', () => {
  const deck = parsePptxGenJs(`
    const p = new (require("pptxgenjs"))();
    for (let i = 0; i < 500; i++) { const s = p.addSlide(); s.addText("x", { x:0, y:0, w:1, h:1 }); }
  `);
  assert.equal(deck.slides.length, 200);
});

test('snapColorToPalette picks the nearest brand colour by linear-sRGB distance', () => {
  const brand: BrandColor[] = [
    { name: 'green', hex: '30BA78' },
    { name: 'white', hex: 'FFFFFF' },
    { name: 'ink', hex: '0B1512' },
  ];
  // A light green is closest to the brand green, not white or ink.
  assert.equal(snapColorToPalette('6FE3AC', brand)?.name, 'green');
  // A near-white maps to white.
  assert.equal(snapColorToPalette('FEFEFE', brand)?.name, 'white');
  // A near-black maps to ink.
  assert.equal(snapColorToPalette('05100C', brand)?.name, 'ink');
  // Degenerate inputs return null rather than throwing.
  assert.equal(snapColorToPalette('30BA78', []), null);
  assert.equal(snapColorToPalette('not-a-color', brand), null);
});

test('inchesToNative maps inch coordinates onto native pixel units', () => {
  // 6.665" on a 13.33" layout is the horizontal centre → 960 of 1920.
  assert.ok(Math.abs(inchesToNative(6.665, 13.33, 1920) - 960) < 0.001);
  // Corners.
  assert.equal(inchesToNative(0, 13.33, 1920), 0);
  assert.equal(inchesToNative(13.33, 13.33, 1920), 1920);
  // A zero layout can't be divided - guarded to 0.
  assert.equal(inchesToNative(5, 0, 1920), 0);
});
