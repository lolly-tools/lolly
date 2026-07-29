// SPDX-License-Identifier: MPL-2.0
/**
 * PDF text reconstruction — positioned runs back into readable prose.
 * Run directly:  node --test tests/pdf-text.test.ts
 *
 * The fixtures build PdfNodes the way pdf-map emits them, which means honouring
 * two of its conventions or the tests prove nothing:
 *
 *   • `y` is the box TOP, already shifted up by `size * 0.8` from the baseline,
 *     and the page is top-left y-down (pdf-map bakes the PDF's y-up flip).
 *   • `w` is ESTIMATED as `chars × size × 0.55` — never measured. Fixtures use
 *     the same estimate so column geometry behaves as it does in production.
 *
 * `run()` below applies both, so a fixture reads as "this text sits at this
 * baseline" rather than as raw box arithmetic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPageText, joinPageText } from '../engine/src/pdf-text.ts';
import type { PdfNode } from '../engine/src/pdf-map.ts';

// ─── harness ──────────────────────────────────────────────────────────────────

interface RunOpts { size?: number; bold?: boolean; rot?: number; font?: string }

/** A text node at (x, baseline), matching pdf-map's emission conventions. */
function run(text: string, x: number, baseline: number, o: RunOpts = {}): PdfNode {
  const size = o.size ?? 10;
  return {
    kind: 'text',
    x,
    y: baseline - size * 0.8,               // pdf-map's box-top shift
    w: Math.max(4, text.replace(/\n.*/s, '').length * size * 0.55, size * 2),
    h: size * 1.4 * (text.split('\n').length),
    rot: o.rot ?? 0,
    fontSize: size,
    fontWeight: o.bold ? 700 : 400,
    fontFamily: o.font ?? 'Helvetica',
    text,
  };
}

function image(x: number, y: number, w: number, h: number): PdfNode {
  return { kind: 'image', x, y, w, h, rot: 0, _imageXObject: 'im0' };
}

/** A body-text paragraph of `n` full-measure lines starting at `baseline`. */
function paragraph(x: number, baseline: number, n: number, width = 60, size = 10): PdfNode[] {
  return Array.from({ length: n }, (_, i) =>
    run('word '.repeat(Math.floor(width / 5)).trim(), x, baseline + i * size * 1.2, { size }));
}

// ─── lines ────────────────────────────────────────────────────────────────────

test('runs on one baseline become one line, in x order regardless of paint order', () => {
  // Painted right-to-left; reading order must come from geometry, not array order.
  const r = extractPageText([run('world', 60, 100), run('Hello', 20, 100)]);
  assert.equal(r.text, 'Hello world');
});

test('a visible gap between runs becomes a space, a touching split does not', () => {
  // 'Bold' ends at 20 + 4*10*0.55 = 42. A run starting at 42 is the same word.
  const joined = extractPageText([run('Bold', 20, 100), run('face', 42, 100)]);
  assert.equal(joined.text, 'Boldface');

  const spaced = extractPageText([run('Bold', 20, 100), run('face', 60, 100)]);
  assert.equal(spaced.text, 'Bold face');
});

test('mixed sizes on one baseline stay on one line', () => {
  // Clustering on the box TOP would split these: a 20pt and an 8pt run sharing a
  // baseline have tops 9.6pt apart, far beyond any line tolerance.
  const r = extractPageText([run('Big', 20, 100, { size: 20 }), run('small', 60, 100, { size: 8 })]);
  assert.equal(r.blocks.length, 1);
  assert.match(r.blocks[0]!.text, /Big small/);
});

test('a node carrying its own newlines splits into lines', () => {
  // pdf-map inserts \n when the pen drops inside one BT…ET.
  const r = extractPageText([run('first line\nsecond line', 20, 100)]);
  assert.equal(r.text, 'first line second line');
});

test('rotated runs are excluded from the flow and counted', () => {
  const r = extractPageText([run('DRAFT', 100, 300, { size: 40, rot: 45 }), run('Real text', 20, 100)]);
  assert.equal(r.text, 'Real text');
  assert.equal(r.rotated, 1);
});

// ─── paragraphs ───────────────────────────────────────────────────────────────

test('consecutive lines at normal leading form one paragraph', () => {
  const r = extractPageText([run('The first line', 20, 100), run('and its continuation', 20, 112)]);
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0]!.text, 'The first line and its continuation');
});

test('a wide vertical gap starts a new paragraph', () => {
  const r = extractPageText([
    run('Paragraph one line one', 20, 100),
    run('Paragraph one line two', 20, 112),
    run('Paragraph two', 20, 160),                 // >> 1.55 × leading
  ]);
  assert.equal(r.blocks.length, 2);
  assert.equal(r.blocks[1]!.text, 'Paragraph two');
});

test('hyphenation across a line break is repaired', () => {
  const r = extractPageText([run('an inter-', 20, 100), run('national body', 20, 112)]);
  assert.equal(r.blocks[0]!.text, 'an international body');
});

test('a trailing hyphen before a capital is NOT a hyphenation', () => {
  // "Coca-" + "Cola" would be wrong to merge as a broken word; only lowercase
  // continuations are treated as hyphenation.
  const r = extractPageText([run('the Coca-', 20, 100), run('Cola case', 20, 112)]);
  assert.equal(r.blocks[0]!.text, 'the Coca- Cola case');
});

// ─── headings ─────────────────────────────────────────────────────────────────

test('larger-than-body blocks become levelled headings', () => {
  const r = extractPageText([
    run('Document Title', 20, 60, { size: 24 }),
    run('Section', 20, 100, { size: 14 }),
    ...paragraph(20, 130, 4),
  ]);
  const heads = r.blocks.filter((b) => b.kind === 'heading');
  assert.equal(heads.length, 2);
  assert.equal(heads[0]!.level, 1);       // 24pt — the largest
  assert.equal(heads[1]!.level, 2);       // 14pt
  assert.match(r.markdown, /^# Document Title/m);
  assert.match(r.markdown, /^## Section/m);
});

test('body size is decided by character count, not block count', () => {
  // Six short 14pt headings against one long 10pt paragraph: the paragraph is
  // the body even though it is outnumbered six to one.
  const r = extractPageText([
    ...Array.from({ length: 6 }, (_, i) => run(`Heading ${i}`, 20, 60 + i * 40, { size: 14 })),
    ...paragraph(20, 320, 8),
  ]);
  assert.equal(r.blocks.filter((b) => b.kind === 'heading').length, 6);
  assert.ok(r.blocks.some((b) => b.kind === 'paragraph'));
});

test('a page set entirely in one size has no headings', () => {
  const r = extractPageText(paragraph(20, 100, 6));
  assert.equal(r.blocks.every((b) => b.kind === 'paragraph'), true);
});

// ─── lists ────────────────────────────────────────────────────────────────────

test('bullet and numbered lines become separate list items', () => {
  const r = extractPageText([
    run('• first point', 20, 100),
    run('• second point', 20, 112),
    run('2. third point', 20, 124),
  ]);
  assert.equal(r.blocks.length, 3);
  assert.equal(r.blocks.every((b) => b.kind === 'list-item'), true);
  // The original marker is replaced by markdown's, not doubled up.
  assert.match(r.markdown, /^- first point$/m);
  assert.match(r.markdown, /^- third point$/m);
});

test('a wrapped list item keeps its continuation', () => {
  const r = extractPageText([
    run('• a point that runs on', 20, 100),
    run('to a second line', 30, 112),
    run('• the next point', 20, 124),
  ]);
  assert.equal(r.blocks.length, 2);
  assert.match(r.blocks[0]!.text, /runs on to a second line/);
});

// ─── columns ──────────────────────────────────────────────────────────────────

test('two prose columns are read down one and then the other', () => {
  // Left column at x=20, right at x=320; a gutter far wider than 1.8 × body size.
  const left = paragraph(20, 100, 6, 50);
  const right = paragraph(320, 100, 6, 50);
  // Interleaved in paint order, exactly as a real two-column page arrives.
  const nodes: PdfNode[] = [];
  for (let i = 0; i < 6; i++) { nodes.push(left[i]!, right[i]!); }

  const r = extractPageText(nodes, { width: 595, height: 842 });
  assert.equal(r.columns, 2);
  // Every left-column block must precede every right-column block.
  const cols = r.blocks.map((b) => b.column);
  assert.deepEqual(cols, [...cols].sort((a, b) => a - b));
  assert.ok(cols.includes(0) && cols.includes(1));
});

test('a single column is never split by an indented or short line', () => {
  const r = extractPageText([
    ...paragraph(20, 100, 4),
    run('    an indented line', 60, 160),
    ...paragraph(20, 180, 4),
  ], { width: 595, height: 842 });
  assert.equal(r.columns, 1);
});

test('a narrow-celled table is not mistaken for columns', () => {
  // Two stacks of SHORT cells with a wide gap. The gutter is there, but prose
  // fills its measure and table cells do not — the fill guard must refuse.
  const nodes: PdfNode[] = [];
  for (let i = 0; i < 6; i++) {
    nodes.push(run('12', 20, 100 + i * 14));
    nodes.push(run('34', 320, 100 + i * 14));
  }
  const r = extractPageText(nodes, { width: 595, height: 842 });
  assert.equal(r.columns, 1);
});

test('too few lines a side is not enough evidence for a column split', () => {
  const nodes = [
    ...paragraph(20, 100, 2, 50),
    ...paragraph(320, 100, 2, 50),
  ];
  assert.equal(extractPageText(nodes, { width: 595, height: 842 }).columns, 1);
});

// ─── scans + empty pages ──────────────────────────────────────────────────────

test('a page that is one big image with no text reads as scanned', () => {
  const r = extractPageText([image(0, 0, 595, 842)], { width: 595, height: 842 });
  assert.equal(r.scanned, true);
  assert.equal(r.text, '');
  assert.equal(r.blocks.length, 0);
});

test('a genuinely blank page is empty but NOT reported as scanned', () => {
  const r = extractPageText([], { width: 595, height: 842 });
  assert.equal(r.scanned, false);
  assert.equal(r.text, '');
});

test('a small logo on an otherwise empty page is not a scan', () => {
  const r = extractPageText([image(20, 20, 80, 40)], { width: 595, height: 842 });
  assert.equal(r.scanned, false);
});

test('a scanned page with a text layer is not reported as scanned', () => {
  // Searchable scans (image + invisible OCR text) have real text to give back.
  const r = extractPageText([image(0, 0, 595, 842), run('recognised words', 20, 100)], { width: 595, height: 842 });
  assert.equal(r.scanned, false);
  assert.equal(r.text, 'recognised words');
});

// ─── markdown ─────────────────────────────────────────────────────────────────

test('a line that starts with markdown syntax is escaped, not interpreted', () => {
  const r = extractPageText([run('# not a heading', 20, 100)]);
  assert.match(r.markdown, /^\\# not a heading/);
  // Plain text keeps the original characters untouched.
  assert.equal(r.text, '# not a heading');
});

test('joinPageText separates pages and names scanned ones', () => {
  const a = extractPageText([run('Page one', 20, 100)]);
  const scan = extractPageText([image(0, 0, 595, 842)], { width: 595, height: 842 });
  const c = extractPageText([run('Page three', 20, 100)]);

  const md = joinPageText([a, scan, c]);
  assert.match(md, /Page one/);
  assert.match(md, /Page three/);
  // The gap is stated, never silent — a reader must not mistake it for absence.
  assert.match(md, /scanned image/i);
  assert.match(md, /---/);

  const plain = joinPageText([a, scan, c], { markdown: false });
  assert.match(plain, /\[Page 2: scanned image, no text layer\]/);
});

// ─── hostile input ────────────────────────────────────────────────────────────

test('degenerate geometry yields empty output rather than throwing', () => {
  const broken: PdfNode[] = [
    { kind: 'text', x: NaN, y: NaN, w: NaN, h: NaN, rot: NaN, fontSize: NaN, text: 'ghost' },
    { kind: 'text', x: 0, y: 0, w: 0, h: 0, rot: 0, fontSize: 0, text: '   ' },
    { kind: 'text', x: 0, y: 0, w: 0, h: 0, rot: 0, text: '' },
  ];
  const r = extractPageText(broken, { width: 0, height: 0 });
  assert.ok(typeof r.text === 'string');
  assert.ok(Array.isArray(r.blocks));
});

test('a page of many runs stays in reading order', () => {
  // 200 runs down the page, shuffled into the node list.
  const nodes = Array.from({ length: 200 }, (_, i) => run(`line ${i}`, 20, 100 + i * 14));
  const shuffled = nodes.map((n, i) => nodes[(i * 97) % nodes.length]!);
  const r = extractPageText(shuffled, { width: 595, height: 842 });
  const numbers = [...r.text.matchAll(/line (\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
});

test('order is reported as geometric', () => {
  assert.equal(extractPageText([run('x', 0, 10)]).order, 'geometric');
});
