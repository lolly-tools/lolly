// SPDX-License-Identifier: MPL-2.0
/**
 * Typesetting recovery from OCR lines (plan 274 section 6, point 4), over lines
 * written by hand in the shape `host.ocr.run` returns: bullets read as `o ` and
 * `e ` (the PP-OCR trap), two columns under a heading that spans both, the
 * title told from the body by the size estimate, and the estimate itself
 * against a known cap height.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  glyphSetOf,
  lineSizeEstimate,
  ocrTextBlocks,
  readingOrderOf,
  typesetOcrLines,
  type OcrLineInputV1,
} from '../engine/src/ocr-typeset.ts';

const line = (text: string, x: number, y: number, w: number, h: number, confidence = 0.95): OcrLineInputV1 => ({
  text,
  confidence,
  box: { x, y, w, h },
});

test('glyph sets follow what the letters reach, and the size divides by that reach', () => {
  assert.equal(glyphSetOf('REVENUE GROWTH'), 'caps');
  assert.equal(glyphSetOf('the whole'), 'ascender');
  assert.equal(glyphSetOf('on a new canvas'), 'x-height');
  assert.equal(glyphSetOf('grey quay'), 'x-height-descender');
  assert.equal(glyphSetOf('Quarterly results'), 'ascender-descender');
  assert.equal(glyphSetOf('Gap'), 'caps-descender');
  assert.equal(glyphSetOf('- - -'), 'none');
  // Capitals 35 px tall on a face whose cap height is 0.7 em: a 50 px em.
  assert.equal(lineSizeEstimate('REVENUE', 35, { capHeight: 0.7 }), 50);
  // The same em in lower case without ascenders is the x-height box.
  assert.equal(lineSizeEstimate('ocean', 25.2, { capHeight: 0.7 }), 50);
  assert.equal(lineSizeEstimate('...', 20), null);
});

test('bullets read as "o " and "e " are recovered, with the hanging indent and the repeat as support', () => {
  const lines = [
    line('Quarterly results', 100, 100, 420, 40),
    line('o Revenue grew in every region', 100, 180, 460, 24),
    line('and in every quarter', 132, 210, 300, 24),
    line('e Costs fell by a tenth', 100, 250, 330, 24),
    line('o Hiring stayed flat', 100, 290, 290, 24),
  ];
  const block = typesetOcrLines(lines, { pageHeight: 720 });
  assert.deepEqual(
    block.paragraphs.map((p) => [p.text, p.bullet, p.bulletGlyph ?? null]),
    [
      ['Quarterly results', 'none', null],
      ['Revenue grew in every region and in every quarter', 'bullet', 'o'],
      ['Costs fell by a tenth', 'bullet', 'e'],
      ['Hiring stayed flat', 'bullet', 'o'],
    ],
  );
  assert.equal(block.paragraphs[1]?.bulletEvidence, 'glyph-and-indent');
  assert.equal(block.paragraphs[2]?.bulletEvidence, 'repeated-glyph');
  assert.deepEqual(block.paragraphs[1]?.lines, [1, 2]);
  assert.ok(block.paragraphs.every((p) => p.lvl === 0));
});

test('a lone leading "o" with no support is a word, not a bullet', () => {
  const block = typesetOcrLines([line('o sol nasce cedo', 40, 40, 260, 24)]);
  assert.equal(block.paragraphs.length, 1);
  assert.equal(block.paragraphs[0]?.bullet, 'none');
  assert.equal(block.paragraphs[0]?.text, 'o sol nasce cedo');
});

test('an unambiguous glyph is a bullet on its own, and a deeper edge nests', () => {
  const block = typesetOcrLines([
    line('• Plan the launch', 60, 60, 300, 24),
    line('• Book the venue', 100, 100, 260, 24),
    line('• Send the invites', 60, 140, 300, 24),
  ]);
  assert.deepEqual(
    block.paragraphs.map((p) => [p.text, p.bullet, p.lvl]),
    [
      ['Plan the launch', 'bullet', 0],
      ['Book the venue', 'bullet', 1],
      ['Send the invites', 'bullet', 0],
    ],
  );
});

test('a bullet whose glyph was not read is found by where its text starts', () => {
  const block = typesetOcrLines([
    line('o First point here', 60, 60, 300, 24),
    line('second line of it', 90, 90, 280, 24),
    line('Second point read without its glyph', 90, 140, 420, 24),
  ]);
  assert.equal(block.paragraphs.length, 2);
  assert.equal(block.paragraphs[1]?.bullet, 'bullet');
  assert.equal(block.paragraphs[1]?.bulletEvidence, 'text-indent');
  assert.equal(block.paragraphs[1]?.bulletGlyph, undefined);
  assert.equal(block.paragraphs[1]?.lvl, 0);
});

test('two columns under a spanning heading read left column first, whatever the input order', () => {
  const heading = line('What changed this year', 50, 20, 850, 44);
  const left = [line('Left column opens here', 50, 100, 380, 24), line('and carries on below', 50, 130, 360, 24), line('before it ends', 50, 160, 250, 24)];
  const right = [line('Right column starts', 500, 100, 380, 24), line('beside the left one', 500, 130, 360, 24), line('and closes the block', 500, 160, 380, 24)];
  const shuffled = [right[0], left[1], right[2], heading, left[0], right[1], left[2]].filter((l): l is OcrLineInputV1 => l !== undefined);
  const block = typesetOcrLines(shuffled, { pageHeight: 720 });
  assert.equal(block.columns, 2);
  assert.deepEqual(
    block.order.map((i) => shuffled[i]?.text),
    [heading, ...left, ...right].map((l) => l.text),
  );
  assert.deepEqual(
    block.paragraphs.map((p) => [p.text, p.column]),
    [
      ['What changed this year', 0],
      ['Left column opens here and carries on below before it ends', 0],
      ['Right column starts beside the left one and closes the block', 1],
    ],
  );
  assert.equal(block.paragraphs[0]?.role, 'title');
  assert.ok(block.paragraphs.slice(1).every((p) => p.role === 'body'));
});

test('the title is told from the body by the size estimate alone, and the estimate is labelled as one', () => {
  // No page height: the leading paragraph is a title by its ratio to the rest.
  const block = typesetOcrLines([
    line('REVENUE GROWTH', 60, 26, 498, 42),
    line('Sales rose in each region this year', 60, 120, 520, 22),
    line('and costs held steady', 60, 150, 300, 22),
  ]);
  assert.equal(block.size.basis, 'estimate');
  assert.equal(block.paragraphs[0]?.role, 'title');
  assert.equal(block.paragraphs[0]?.sizePx, 60);
  assert.ok((block.paragraphs[0]?.roleEvidence.ratioToRest ?? 0) >= 1.35);
  assert.equal(block.paragraphs[1]?.role, 'body');
  assert.equal(block.size.pitchPx, 30);
});

test('reading order is total and stable for boxes on one row, and falls back past the cap', () => {
  const boxes = [
    { x: 300, y: 10, w: 50, h: 20 },
    { x: 10, y: 10, w: 50, h: 20 },
    { x: 150, y: 10, w: 50, h: 20 },
  ];
  assert.deepEqual(readingOrderOf(boxes).order, [1, 2, 0]);
  const many = Array.from({ length: 5 }, (_, i) => ({ x: 0, y: 50 - i * 10, w: 10, h: 5 }));
  const capped = readingOrderOf(many, 3);
  assert.equal(capped.fallback, true);
  assert.deepEqual(capped.order, [4, 3, 2, 1, 0]);
});

test('word boxes on one baseline join into one line before the column graph reads them', () => {
  // PP-OCR boxes large type word by word; a two-line title comes back as five boxes.
  const block = typesetOcrLines(
    [
      line('make', 330, 100, 120, 44),
      line('How', 60, 100, 100, 44),
      line('do', 180, 100, 60, 44),
      line('content?', 60, 160, 220, 44),
      line('you', 255, 104, 70, 44),
    ],
    { pageHeight: 720 },
  );
  assert.equal(block.lines.length, 2);
  assert.deepEqual(block.lines.map((l) => l.text), ['How do you make', 'content?']);
  assert.deepEqual(block.lines[0]?.parts, [1, 2, 4, 0]);
  assert.equal(block.paragraphs.length, 1);
  assert.equal(block.paragraphs[0]?.text, 'How do you make content?');
  assert.equal(block.paragraphs[0]?.role, 'title');
  assert.deepEqual(block.order, [1, 2, 4, 0, 3]);
});

test('empty and blank lines give an empty block, not a throw', () => {
  const block = typesetOcrLines([line('   ', 0, 0, 10, 10)]);
  assert.equal(block.paragraphs.length, 0);
  assert.equal(block.size.sizePx, null);
});

test('a bullet the detector boxed on its own joins its line, so items stay apart and keep their bullets', () => {
  const block = typesetOcrLines([
    line('•', 10, 16, 8, 8),
    line('Revenue grew', 30, 10, 200, 20),
    line('•', 10, 46, 8, 8),
    line('Margin held', 30, 40, 180, 20),
  ]);
  assert.deepEqual(
    block.paragraphs.map((p) => [p.text, p.bullet, p.bulletGlyph ?? null]),
    [
      ['Revenue grew', 'bullet', '•'],
      ['Margin held', 'bullet', '•'],
    ],
  );
  assert.deepEqual(block.paragraphs[0]?.lines, [0, 1]);
});

test('signs and words that start like a bullet keep their first character', () => {
  const alone = (text: string): [string, string] => {
    const p = typesetOcrLines([line(text, 40, 40, 400, 24)]).paragraphs[0];
    return [p?.text ?? '', p?.bullet ?? ''];
  };
  assert.deepEqual(alone('> 50% of users churn'), ['> 50% of users churn', 'none']);
  assert.deepEqual(alone('* Source: Gartner 2025'), ['* Source: Gartner 2025', 'none']);
  assert.deepEqual(alone('- Leonardo da Vinci'), ['- Leonardo da Vinci', 'none']);
  assert.deepEqual(alone('- 3 points'), ['- 3 points', 'none']);
  // Two lines at one left edge that open with a lower-case letter and a capital are words.
  const words = typesetOcrLines([line('eCommerce revenue', 40, 40, 300, 24), line('eLearning growth', 40, 100, 280, 24), line('oAuth rollout', 40, 160, 240, 24)]);
  assert.deepEqual(
    words.paragraphs.map((p) => [p.text, p.bullet]),
    [['eCommerce revenue eLearning growth oAuth rollout', 'none']],
  );
  // With the same mark repeated at one edge, a dash list is a list.
  const dashes = typesetOcrLines([line('- Plan the launch', 40, 40, 300, 24), line('- Book the venue', 40, 70, 280, 24)]);
  assert.deepEqual(
    dashes.paragraphs.map((p) => [p.text, p.bullet]),
    [
      ['Plan the launch', 'bullet'],
      ['Book the venue', 'bullet'],
    ],
  );
});

test('numbered items open their own paragraphs and say they are numbered', () => {
  const block = typesetOcrLines([line('1. First step', 10, 10, 200, 20), line('2. Second step', 10, 40, 220, 20), line('3) Third step', 10, 70, 200, 20)]);
  assert.deepEqual(
    block.paragraphs.map((p) => [p.text, p.bullet, p.bulletGlyph ?? null]),
    [
      ['First step', 'number', '1.'],
      ['Second step', 'number', '2.'],
      ['Third step', 'number', '3)'],
    ],
  );
  // A lone numbered-looking line with nothing to support it stays as read.
  const lone = typesetOcrLines([line('2025. A year of growth', 10, 10, 300, 20)]);
  assert.deepEqual([lone.paragraphs[0]?.text, lone.paragraphs[0]?.bullet], ['2025. A year of growth', 'none']);
});

// ─── blocks over a whole page (plan 275 WP10) ───────────────────────────────

test('page lines group into blocks: a paragraph stays whole, a title set close over its body does not join it', () => {
  const lines = [
    line('Because freedom', 86, 216, 651, 80),
    line('is sweet', 83, 307, 312, 74),
    line('We built a world-class creative engine.', 84, 405, 533, 43),
    line('It runs entirely on your local device.', 85, 445, 485, 36),
    line('No cloud. No tracking.', 83, 479, 313, 46),
    line('NotebookLM', 1267, 742, 102, 20),
  ];
  assert.deepEqual(ocrTextBlocks(lines), [[0, 1], [2, 3, 4], [5]]);
});

test('side by side cells stay apart, a label under a paragraph but off its edges stays apart, and a rule divides', () => {
  const cells = [
    line('Friction', 92, 266, 172, 55),
    line('Upload, queue, dismiss upsells,', 322, 257, 393, 43),
    line('wait.', 320, 293, 75, 40),
    line('Files rest on someone else\'s disk,', 322, 367, 414, 43),
  ];
  // Without the table's line the last cell runs on from the one above it.
  assert.deepEqual(ocrTextBlocks(cells), [[0], [1, 2, 3]]);
  // The rule between the rows keeps them apart.
  assert.deepEqual(ocrTextBlocks(cells, [{ x: 48, y: 348, w: 700, h: 3 }]), [[0], [1, 2], [3]]);
  // A label under a paragraph, sharing none of its edges.
  const drawing = [
    line('hand our house keys to a stranger.', 97, 410, 642, 50),
    line('Upload PDF to convert', 705, 464, 262, 40),
  ];
  assert.deepEqual(ocrTextBlocks(drawing), [[0], [1]]);
  // Empty text is left out.
  assert.deepEqual(ocrTextBlocks([line('', 0, 0, 10, 10), line('Word', 0, 20, 40, 10)]), [[1]]);
});

test('a paragraph under the page title size is body, however large its share of the page', () => {
  const body = [line('It just arrived one tool at a time', 96, 309, 900, 42), line('until the normal way was to hand', 96, 360, 880, 42)];
  const free = typesetOcrLines(body, { pageHeight: 768 });
  assert.ok(free.paragraphs.every((p) => p.role === 'title'), 'on its own, large copy reads as a title');
  const floored = typesetOcrLines(body, { pageHeight: 768, minTitlePx: 70 });
  assert.ok(floored.paragraphs.every((p) => p.role === 'body'), 'under the page title size it is body');
});

test('a line ending in a dash set close to its word runs on into the next with no space; a spaced dash keeps its space', () => {
  const close = typesetOcrLines([
    line('It wasn’t carelessness—', 20, 20, 400, 30),
    line('it was survival.', 20, 56, 240, 30),
  ]);
  assert.equal(close.paragraphs[0]?.text, 'It wasn’t carelessness—it was survival.');
  const spaced = typesetOcrLines([
    line('It was not carelessness —', 20, 20, 400, 30),
    line('it was survival.', 20, 56, 240, 30),
  ]);
  assert.equal(spaced.paragraphs[0]?.text, 'It was not carelessness — it was survival.');
});
