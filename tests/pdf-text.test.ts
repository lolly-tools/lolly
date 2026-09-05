// SPDX-License-Identifier: MPL-2.0
/**
 * PDF text reconstruction - positioned runs back into readable prose.
 * Run directly:  node --test tests/pdf-text.test.ts
 *
 * The fixtures build PdfNodes the way pdf-map emits them, which means honouring
 * two of its conventions or the tests prove nothing:
 *
 *   • `y` is the box TOP, already shifted up by `size * 0.8` from the baseline,
 *     and the page is top-left y-down (pdf-map bakes the PDF's y-up flip).
 *   • `w` is ESTIMATED as `chars × size × 0.55` - never measured. Fixtures use
 *     the same estimate so column geometry behaves as it does in production.
 *
 * `run()` below applies both, so a fixture reads as "this text sits at this
 * baseline" rather than as raw box arithmetic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPageText, joinPageText, PDF_TEXT_MAX_ITEMS, PDF_TEXT_MAX_NODES,
} from '../engine/src/pdf-text.ts';
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
  assert.equal(heads[0]!.level, 1);       // 24pt - the largest
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

test('the list marker is separated from the prose, not left inside it', () => {
  // Three renderers consume this (HTML draws its own bullet in CSS, markdown
  // writes "- ", plain text re-adds the original). If the marker stayed inside
  // `text`, whichever of them forgot to strip it would render "• • thing".
  const r = extractPageText([run('• first point', 20, 100), run('2. second point', 20, 130)]);
  assert.equal(r.blocks[0]!.text, 'first point');
  assert.equal(r.blocks[0]!.marker, '•');
  assert.equal(r.blocks[1]!.text, 'second point');
  assert.equal(r.blocks[1]!.marker, '2.');
  // Markdown normalises the marker; plain text keeps the document's own.
  assert.match(r.markdown, /^- first point$/m);
  assert.match(r.text, /^• first point$/m);
  assert.match(r.text, /^2\. second point$/m);
});

test('a paragraph carries no marker at all', () => {
  const r = extractPageText([run('Ordinary prose here', 20, 100)]);
  assert.equal(r.blocks[0]!.marker, undefined);
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
  // fills its measure and table cells do not - the fill guard must refuse.
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

// ─── tagged reading order ─────────────────────────────────────────────────────
// A tagged PDF STATES its reading order. Where the structure tree and geometry
// disagree, the document wins - geometry is only ever an inference.

/** A run carrying a marked-content id, as a tagged page emits. */
function tagged(text: string, x: number, baseline: number, mcid: number, o: RunOpts = {}): PdfNode {
  return { ...run(text, x, baseline, o), mcid };
}

test('the structure tree overrides a reading order geometry gets wrong', () => {
  // A pull-quote sidebar sits LEFT of the body on the same baseline, so geometry
  // reads it first and even merges the two into one line. The document says the
  // body comes first and the sidebar last.
  const nodes = [
    tagged('SIDEBAR read me last', 20, 100, 0),
    tagged('BODY read me first', 260, 100, 1),
    tagged('BODY and me second', 260, 130, 2),
  ];

  const geo = extractPageText(nodes);
  assert.equal(geo.order, 'geometric');
  assert.match(geo.text, /^SIDEBAR/, 'geometry should read the sidebar first');

  const tag = extractPageText(nodes, {
    tagged: [{ mcids: [1], type: 'P' }, { mcids: [2], type: 'P' }, { mcids: [0], type: 'Aside' }],
  });
  assert.equal(tag.order, 'tagged');
  assert.deepEqual(tag.blocks.map((b) => b.text), [
    'BODY read me first', 'BODY and me second', 'SIDEBAR read me last',
  ]);
});

test('structure types decide headings and lists, outranking the size heuristic', () => {
  // The H1 is set SMALLER than the body. Font size would call the body the
  // heading; the document says otherwise and the document is right.
  const r = extractPageText([
    tagged('A modest heading', 20, 60, 0, { size: 9 }),
    tagged('Body text set large for effect', 20, 100, 1, { size: 20 }),
    tagged('a bullet', 20, 140, 2, { size: 9 }),
  ], {
    tagged: [{ mcids: [0], type: 'H1' }, { mcids: [1], type: 'P' }, { mcids: [2], type: 'LI' }],
  });
  assert.deepEqual(r.blocks.map((b) => [b.kind, b.level]), [['heading', 1], ['paragraph', undefined], ['list-item', undefined]]);
  assert.match(r.markdown, /^# A modest heading$/m);
  assert.match(r.markdown, /^- a bullet$/m);
});

test('one element spanning several mcids becomes ONE block', () => {
  const r = extractPageText([
    tagged('a sentence that runs', 20, 100, 0),
    tagged('across two marked runs', 20, 112, 1),
  ], { tagged: [{ mcids: [0, 1], type: 'P' }] });
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0]!.text, 'a sentence that runs across two marked runs');
});

test('untagged runs are appended and counted, not silently dropped', () => {
  const r = extractPageText([
    ...Array.from({ length: 6 }, (_, i) => tagged(`tagged body line ${i}`, 20, 100 + i * 12, i)),
    run('page 7', 300, 800),                       // a running foot, outside the flow
  ], { tagged: Array.from({ length: 6 }, (_, i) => ({ mcids: [i], type: 'P' })) });

  assert.equal(r.order, 'tagged');
  assert.equal(r.untagged, 1);
  assert.match(r.blocks[r.blocks.length - 1]!.text, /page 7/);
});

test('a token structure tree over mostly-untagged content is NOT trusted', () => {
  // One tagged run against a page of untagged prose. Following it would hand back
  // a confident-looking fragment of the page, so the tree is refused outright.
  const r = extractPageText([
    tagged('a lone tagged crumb', 20, 60, 0),
    ...paragraph(20, 100, 8),
  ], { tagged: [{ mcids: [0], type: 'P' }] });
  assert.equal(r.order, 'geometric');
});

test('a tagged element with no matching content on this page is skipped', () => {
  // One structure tree spans the whole document; most of its elements belong to
  // other pages.
  const r = extractPageText([tagged('only me', 20, 100, 5)], {
    tagged: [{ mcids: [99], type: 'P' }, { mcids: [5], type: 'P' }, { mcids: [42], type: 'P' }],
  });
  assert.equal(r.order, 'tagged');
  assert.deepEqual(r.blocks.map((b) => b.text), ['only me']);
});

test('an empty tagged array leaves the geometric path untouched', () => {
  const nodes = [run('hello', 20, 100)];
  assert.equal(extractPageText(nodes, { tagged: [] }).order, 'geometric');
  assert.equal(extractPageText(nodes).order, 'geometric');
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
  // The gap is stated, never silent - a reader must not mistake it for absence.
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

test('direct structured text fan-out is capped before split allocation', () => {
  const lines = Array.from({ length: PDF_TEXT_MAX_ITEMS + 100 }, (_, i) => `line ${i}`).join('\n');
  const result = extractPageText([run(lines, 20, 100)]);
  assert.ok((result.text.match(/line /g) ?? []).length <= PDF_TEXT_MAX_ITEMS);

  const nodes = Array.from({ length: PDF_TEXT_MAX_NODES + 1 }, (_, i) => run(`node ${i}`, 20, 100 + i));
  assert.doesNotMatch(extractPageText(nodes).text, new RegExp(`node ${PDF_TEXT_MAX_NODES}`));
});
