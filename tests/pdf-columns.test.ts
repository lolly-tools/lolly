// SPDX-License-Identifier: MPL-2.0
/**
 * Column reading order in the engine PDF text pass (plan 274, milestone 5).
 *
 * Slides and reports rarely run their columns from the top of the page to the
 * bottom. A title spans the width above them, a row of cards sits underneath, a
 * page number sits in a corner. A gutter search over the whole page finds no gap
 * the title does not cross, so every line of the left column was read beside
 * the line of the right column that shares its baseline ("dilemma. combined
 * with ... has They want"). `extractPageText` now finds columns region by region
 * on the measured right edges the interpreter reports (`PdfNode.lineInk`).
 *
 * The page below is a content stream written in this file and read by the
 * engine's own interpreter with a font's advance widths, so the right edges are
 * measured exactly as they are on a real slide, and the page is the same on
 * every run with no committed fixture.
 *
 * `interleavedJoins` is the measure: it walks each output block and counts the
 * places where the text runs from one source line to another that lies across a
 * gutter from it (side by side on one row, or on different rows with no
 * horizontal overlap). Reading one column at a time gives zero.
 *
 * Run with: node --test "tests/pdf-columns.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { interpretPdfPage, type PdfFontInfo, type PdfNode } from '../engine/src/pdf-map.ts';
import { extractPageText, PDF_TEXT_MAX_NODES, type PageText } from '../engine/src/pdf-text.ts';
import { privateCorpus, skipReason } from './helpers/rebrand-fixtures.ts';

// ─── a face's advance widths (Helvetica's, in thousandths of an em) ─────────

const WIDTHS: Record<string, number> = {
  ' ': 278, "'": 191, ',': 278, '-': 333, '.': 278, ':': 278, ';': 278,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
};
const widthOf = (ch: string): number => WIDTHS[ch] ?? 556;
const inkOf = (text: string, size: number): number => [...text].reduce((sum, ch) => sum + widthOf(ch), 0) / 1000 * size;
const HELVETICA: PdfFontInfo = {
  family: 'Helvetica',
  widths: Object.fromEntries(Array.from({ length: 91 }, (_, k) => [32 + k, widthOf(String.fromCharCode(32 + k))])),
};

const PAGE_W = 720;
const PAGE_H = 405;

/** One text object per line, at a top-down `top` baseline, the way office exporters set a slide. */
const line = (x: number, top: number, size: number, text: string): string =>
  `BT /F ${size} Tf 1 0 0 1 ${x} ${PAGE_H - top} Tm (${text}) Tj ET`;

// ─── the slide ───────────────────────────────────────────────────────────────

const TITLE = 'The Market Imperative: why regional control matters now';
const LEFT_HEAD = 'The Regulatory Trigger';
const LEFT = [
  'New rules on data residency, combined with',
  'pressure from auditors and buyers, have',
  'shifted the landscape for every vendor.',
  'Partial answers are no longer enough.',
];
const RIGHT_HEAD = 'The Customer Paradox';
const RIGHT = [
  'Teams across the region want the speed that',
  'cloud platforms bring; they also fear the',
  'legal exposure that comes with providers',
  'based outside their own jurisdiction.',
  'That tension shapes every deal.',
];
const CARDS: Array<[string, string[]]> = [
  ['Legal Certainty', ['Clear answers on which laws reach', 'the data that is stored']],
  ['Freedom to Build', ['Modern tooling for every team', 'without giving up control']],
  ['Strategic Choice', ['Keep every option open with', 'open standards and formats']],
];
const CARD_X = [22, 258, 494];

/**
 * The page: a title across the width, a two-column section whose columns share
 * a baseline grid, three cards of wrapped prose under it, and a page number in
 * the bottom corner. Painted row by row, as a slide exporter paints it.
 */
function slideContent(): string {
  const ops = [line(31, 40, 25, TITLE)];
  ops.push(line(12, 100, 15.6, LEFT_HEAD), line(373, 100, 15.6, RIGHT_HEAD));
  for (let k = 0; k < RIGHT.length; k++) {
    if (LEFT[k]) ops.push(line(12, 130 + k * 20, 11.5, LEFT[k]!));
    ops.push(line(373, 130 + k * 20, 11.5, RIGHT[k]!));
  }
  ops.push(...CARDS.map(([head], c) => line(CARD_X[c]!, 262, 13, head)));
  for (let k = 0; k < 2; k++) ops.push(...CARDS.map(([, body], c) => line(CARD_X[c]!, 284 + k * 18, 10.5, body[k]!)));
  ops.push(line(695, 390, 6.2, '2'));
  return ops.join('\n');
}

const slide = (): PdfNode[] => interpretPdfPage({ width: PAGE_W, height: PAGE_H, content: slideContent(), fonts: { F: HELVETICA } });
const read = (nodes: PdfNode[]): PageText => extractPageText(nodes, { width: PAGE_W, height: PAGE_H });

// ─── the measure ─────────────────────────────────────────────────────────────

interface Piece { text: string; x: number; right: number; baseline: number; size: number }

/** Each source line as the interpreter placed it, with its measured right edge when it has one. */
function piecesOf(nodes: PdfNode[]): Piece[] {
  const out: Piece[] = [];
  for (const n of nodes) {
    if (n.kind !== 'text' || typeof n.text !== 'string' || Math.abs(n.rot ?? 0) > 5) continue;
    const size = Math.max(1, n.fontSize ?? 12);
    const lead = typeof n.lineHeight === 'number' && n.lineHeight > 0 ? n.lineHeight : 1.4;
    n.text.split('\n').forEach((raw, k) => {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (!text) return;
      const ink = n.lineInk?.[k];
      const right = typeof ink === 'number' && ink > 0 ? n.x + ink : n.x + raw.length * size * 0.55;
      out.push({ text, x: n.x, right, baseline: n.y + size * 0.8 + k * size * lead, size });
    });
  }
  return out;
}

/** The body size: the size carrying the most characters. */
function bodySizeOf(pieces: Piece[]): number {
  const chars = new Map<number, number>();
  for (const p of pieces) chars.set(p.size, (chars.get(p.size) ?? 0) + p.text.length);
  let best = 12;
  let most = -1;
  for (const [size, n] of chars) if (n > most) { most = n; best = size; }
  return best;
}

/**
 * Count the joins inside output blocks that cross a gutter.
 *
 * Each block's text is matched back to the source lines it contains (lines of
 * eight characters or more, so a stray comma cannot match anywhere), ordered by
 * where they occur. Two neighbours on one row with a gutter-wide empty stretch
 * between them, or on rows whose extents in the block do not overlap, are an
 * interleaved join. A table read row by row counts too, so this is a measure to
 * compare, and zero only where a page has no side-by-side text in one block.
 */
function interleavedJoins(nodes: PdfNode[], page: PageText): { joins: number; samples: string[] } {
  const all = piecesOf(nodes);
  const pieces = all.filter((p) => p.text.length >= 8);
  const gutter = bodySizeOf(pieces) * 1.8;
  let joins = 0;
  const samples: string[] = [];
  for (const block of page.blocks) {
    const found = pieces
      .map((p) => ({ p, at: block.text.indexOf(p.text) }))
      .filter((f) => f.at >= 0)
      .sort((a, b) => a.at - b.at || b.p.text.length - a.p.text.length);
    // A piece found inside a longer piece's match is that piece's text, not a line of its own.
    const kept: typeof found = [];
    for (const f of found) {
      const inside = kept.some((k) => f.at >= k.at && f.at + f.p.text.length <= k.at + k.p.text.length);
      if (!inside) kept.push(f);
    }
    const sameRow = (a: Piece, b: Piece): boolean => Math.abs(a.baseline - b.baseline) <= Math.min(a.size, b.size) * 0.4;
    // Side by side across an empty stretch: a word too short to match ("and
    // the") between two matched runs of one line fills the stretch, a gutter
    // leaves it empty.
    const acrossGutter = (a: Piece, b: Piece): boolean => {
      const [l, r] = a.x <= b.x ? [a, b] : [b, a];
      if (r.x - l.right < gutter) return false;
      return !all.some((p) => p !== a && p !== b && sameRow(p, a) && p.right > l.right + 1 && p.x < r.x - 1);
    };
    // A row's extent within this block: every matched line on that baseline.
    const rowSpan = (a: Piece): [number, number] => {
      const row = kept.filter((f) => sameRow(f.p, a)).map((f) => f.p);
      return [Math.min(...row.map((r) => r.x)), Math.max(...row.map((r) => r.right))];
    };
    for (let k = 1; k < kept.length; k++) {
      const a = kept[k - 1]!.p;
      const b = kept[k]!.p;
      const [a0, a1] = rowSpan(a);
      const [b0, b1] = rowSpan(b);
      const disjoint = b0 >= a1 || a0 >= b1;
      if (sameRow(a, b) ? acrossGutter(a, b) : disjoint) {
        joins++;
        if (samples.length < 6) samples.push(`${a.text} | ${b.text}`);
      }
    }
  }
  return { joins, samples };
}

// ─── the slide, end to end ───────────────────────────────────────────────────

test('the slide premise: the interpreter measured every line, and the title crosses the gutter', () => {
  const nodes = slide();
  const text = nodes.filter((n) => n.kind === 'text');
  assert.ok(text.every((n) => Array.isArray(n.lineInk) && n.lineInk.length === 1), 'every line carries its measured ink');
  const leftEdge = Math.max(...LEFT.map((l) => 12 + inkOf(l, 11.5)));
  assert.ok(373 - leftEdge > 11.5 * 1.8, 'the measured gutter is wider than 1.8 body sizes');
  assert.ok(31 + inkOf(TITLE, 25) > 373, 'the title spans the gutter, so a page-wide search finds none');
});

test('a title over two columns and a row of cards reads each column whole, top to bottom', () => {
  const page = read(slide());
  assert.deepEqual(page.blocks.map((b) => b.text), [
    TITLE,
    LEFT_HEAD,
    LEFT.join(' '),
    RIGHT_HEAD,
    RIGHT.join(' '),
    ...CARDS.flatMap(([head, body]) => [head, body.join(' ')]),
    '2',
  ]);
  assert.equal(page.columns, 3);
  // The section's columns and the cards' columns are numbered within their own row.
  assert.deepEqual(page.blocks.map((b) => b.column), [0, 0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 2]);
  assert.deepEqual(page.blocks.slice(0, 4).map((b) => [b.kind, b.level]), [['heading', 1], ['heading', 2], ['paragraph', undefined], ['heading', 2]]);
});

test('the measure: no block of the slide joins lines across a gutter', () => {
  const nodes = slide();
  const { joins, samples } = interleavedJoins(nodes, read(nodes));
  assert.equal(joins, 0, samples.join('\n'));
});

test('the measure catches the old reading: a page read as one column interleaves', () => {
  const nodes = slide();
  // A block as the page-wide pass read it: rows of the two columns alternating.
  const flat: PageText = { ...read(nodes), blocks: [{ kind: 'paragraph', text: [LEFT[0], RIGHT[0], LEFT[1], RIGHT[1]].join(' '), size: 11.5, bold: false, column: 0 }] };
  assert.equal(interleavedJoins(nodes, flat).joins, 2);
});

test('the same slide painted in a shuffled order reads the same', () => {
  const nodes = slide();
  const shuffled = nodes.map((_, k) => nodes[(k * 7) % nodes.length]!);
  assert.equal(new Set(shuffled).size, nodes.length);
  assert.deepEqual(read(shuffled).blocks.map((b) => b.text), read(nodes).blocks.map((b) => b.text));
});

// ─── regions from nodes directly ─────────────────────────────────────────────

/** A text node at (x, baseline), with its measured ink, matching pdf-map's emission. */
function run(text: string, x: number, baseline: number, size = 10, weight = 400): PdfNode {
  const ink = inkOf(text, size);
  return { kind: 'text', x, y: baseline - size * 0.8, w: ink, h: size * 1.4, rot: 0, fontSize: size, fontWeight: weight, fontFamily: 'Helvetica', text, lineInk: [ink] };
}

const PROSE = [
  'a column of prose that fills',
  'its measure from one edge to',
  'the other on every line and',
  'wraps onto the next one here',
  'until the paragraph is done',
];

test('two columns followed by a full-width paragraph read left, right, then the paragraph', () => {
  const nodes = [
    ...PROSE.map((l, k) => run(`left ${l}`, 20, 100 + k * 14)),
    ...PROSE.map((l, k) => run(`right ${l}`, 220, 100 + k * 14)),
    run('A closing paragraph that runs across both columns of the page and past the gutter', 20, 200),
    run('and carries on for a second line across the whole width of the page as well', 20, 214),
  ];
  const page = extractPageText(nodes, { width: 400, height: 300 });
  assert.equal(page.columns, 2);
  assert.deepEqual(page.blocks.map((b) => b.text.split(' ')[0]), ['left', 'right', 'A']);
  assert.deepEqual(page.blocks.map((b) => b.column), [0, 1, 0]);
});

test('a column may hold a titled pair of columns of its own', () => {
  // Left: a heading over two narrow columns. Right: a sidebar. Read the heading,
  // the two narrow columns, then the sidebar.
  const narrow = ['one two three four', 'five six seven', 'eight nine ten', 'eleven twelve'];
  const nodes = [
    run('Section heading across the pair', 20, 60, 14),
    ...narrow.map((l, k) => run(`west ${l}`, 20, 100 + k * 14)),
    ...narrow.map((l, k) => run(`mid ${l}`, 150, 100 + k * 14)),
    ...PROSE.map((l, k) => run(`side ${l}`, 330, 60 + k * 14)),
  ];
  const page = extractPageText(nodes, { width: 500, height: 300 });
  assert.deepEqual(page.blocks.map((b) => b.text.split(' ')[0]), ['Section', 'west', 'mid', 'side']);
  assert.deepEqual(page.blocks.map((b) => b.column), [0, 0, 1, 2]);
  assert.equal(page.columns, 3);
});

test("a paragraph's short last line stays with its paragraph, not with the columns under it", () => {
  const nodes = [
    run('An introduction that runs across the whole width of the page before the', 20, 60),
    run('columns begin, and ends on a short line.', 20, 74),
    ...PROSE.map((l, k) => run(`left ${l}`, 20, 110 + k * 14)),
    ...PROSE.map((l, k) => run(`right ${l}`, 220, 110 + k * 14)),
  ];
  const page = extractPageText(nodes, { width: 400, height: 300 });
  assert.deepEqual(page.blocks.map((b) => b.text.split(' ')[0]), ['An', 'left', 'right']);
  assert.match(page.blocks[0]!.text, /before the columns begin, and ends on a short line\.$/);
});

test('four columns under a title read left to right, with a page number in the corner', () => {
  const words = ['north', 'south', 'east', 'west'];
  const nodes = [
    run('A title across all four columns of this page, from the left edge to past the last gutter', 20, 40, 14),
    ...words.flatMap((w, c) => PROSE.slice(0, 4).map((l, k) => run(`${w} ${l}`.slice(0, 24), 20 + c * 150, 80 + k * 14))),
    run('7', 600, 200, 6),
  ];
  const page = extractPageText(nodes, { width: 640, height: 220 });
  assert.equal(page.columns, 4);
  assert.deepEqual(page.blocks.map((b) => b.text.split(' ')[0]), ['A', ...words, '7']);
});

test('a table under a spanning title still reads row by row', () => {
  const rows = [['Item', 'Qty', 'Price'], ['Widget', '4', '12.00'], ['Gadget', '10', '3.50'], ['Doohickey', '1', '99.00'], ['Sprocket', '25', '0.40']];
  const nodes = [
    run('A title that spans the table and the gaps between its columns', 20, 60, 14),
    ...rows.flatMap((r, k) => r.map((cell, c) => run(cell, 20 + c * 160, 100 + k * 14))),
  ];
  const page = extractPageText(nodes, { width: 600, height: 300 });
  assert.equal(page.columns, 1);
  assert.match(page.text, /Item Qty Price Widget 4 12\.00 Gadget 10 3\.50/);
});

test('labels beside descriptions stay paired when the gap is narrower than a gutter', () => {
  const rows = [['What it is', 'A web tool that checks a platform against a standard.'], ['Who it helps', 'Buyers who need a clear score before they sign.'], ['How it works', 'Eight objectives, each scored, with a roadmap out.'], ['Where data goes', 'Nowhere: the results stay on the device that ran it.']];
  const nodes = rows.flatMap(([label, text], k) => [run(label!, 40, 100 + k * 20, 15), run(text!, 40 + inkOf('Where data goes', 15) + 20, 100 + k * 20, 15)]);
  const page = extractPageText(nodes, { width: 720, height: 405 });
  assert.equal(page.columns, 1);
  assert.match(page.text, /^What it is A web tool/);
});

test('three short lines a side with no wrap are labels, not columns', () => {
  const nodes = [
    ...['North Region', 'South Region', 'East Region'].map((l, k) => run(l, 20, 100 + k * 14)),
    ...['Forty units sold', 'Thirty units sold', 'Nine units sold'].map((l, k) => run(l, 220, 100 + k * 14)),
  ];
  assert.equal(extractPageText(nodes, { width: 400, height: 300 }).columns, 1);
});

// ─── rows, tables and entries that alternate ────────────────────────────────

test('a grid of titled cards under a title reads row by row, left to right', () => {
  // Two rows of three cards. Every gutter stays clear from the first row to the
  // last, so without rows the section is read column by column: 1, 4, 2, 5, 3, 6.
  const body = ['with a line of prose that runs', 'on to a second line here'];
  const nodes = [run('A title across all three columns of cards, from edge to edge of the page', 20, 40, 16)];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const x = 20 + c * 200;
      const top = 90 + r * 90;
      nodes.push(run(`Card ${r * 3 + c + 1}`, x, top, 13, 700), ...body.map((l, k) => run(`card ${r * 3 + c + 1} ${l}`, x, top + 20 + k * 14)));
    }
  }
  const page = extractPageText(nodes, { width: 640, height: 300 });
  assert.deepEqual(page.blocks.map((b) => b.text.split(' ').slice(0, 2).join(' ')), [
    'A title', ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`Card ${n}`, `card ${n}`]),
  ]);
  assert.equal(page.columns, 3);
});

test('entries that zig-zag down a timeline read top to bottom, each marker with its entry', () => {
  // Left, right, left, right, with numbered markers down the middle: the two
  // sides never run beside each other, so they are not columns.
  const entries: Array<[number, string, string[]]> = [
    [1, 'December 2025 - Launch', ['Joint press release and posts from both of the teams', 'with briefings for analysts and the press']],
    [2, 'Early 2026 - General availability', ['Every product available on the platform under', 'its own subscription, with support from day one']],
    [3, 'Spring 2026 - Certification', ['Complete certification of the orchestration layer', 'on the platform, ready for production workloads']],
    [4, 'Autumn 2026 - Pay as you go', ['Products and services available on the platform', 'as pay as you go models for every customer']],
  ];
  // With markers and bold heads, as a slide sets it; and plain, where no row
  // opens in bold, so only the test that columns run side by side can tell.
  for (const markers of [true, false]) {
    const nodes = [run('Launch timeline and market readiness', 30, 45, 25)];
    entries.forEach(([n, head, body], k) => {
      const top = 130 + k * 50;
      const x = k % 2 ? 404 : 30;
      if (markers) nodes.push(run(String(n), 356, top, 13));
      nodes.push(run(head, x, top, markers ? 11 : 9, markers ? 700 : 400), ...body.map((l, m) => run(l, x, top + 17 * (m + 1), 9)));
    });
    // The premise: each side is wider than the gap between them, so the width
    // test alone would believe the split.
    const leftEdge = Math.max(...nodes.filter((n) => n.x === 30).map((n) => n.x + (n.lineInk?.[0] ?? 0)));
    assert.ok(leftEdge - 30 > 404 - leftEdge, 'the left side is wider than the gap');
    const page = extractPageText(nodes, { width: 720, height: 405 });
    assert.equal(page.columns, 1, page.text);
    const heads = entries.map(([, head]) => page.text.indexOf(head));
    assert.ok(heads.every((p) => p >= 0), page.text);
    assert.deepEqual([...heads].sort((a, b) => a - b), heads, `the entries are in date order:\n${page.text}`);
    if (!markers) continue;
    for (const [n, head] of entries) assert.match(page.text, new RegExp(`(^|\\s)${n}\\s+${head}|${head}\\s+${n}(\\s|$)`), `marker ${n} sits with its entry`);
  }
});

const KEY_VALUES: Array<[string, string]> = [
  ['Availability', 'Ninety-nine point nine five percent a month'],
  ['Support', 'Around the clock, every day of the year'],
  ['Response', 'Fifteen minutes for the most urgent cases'],
  ['Data location', 'Stored in the region the customer picks'],
  ['Exit', 'A full export in open formats at any time'],
];

/** A label/value table whose gap is wider than a gutter but narrower than its label column. */
function keyValueTable(title: boolean): PdfNode[] {
  const size = 12;
  const valueX = 40 + inkOf('Data location', size) + size * 2.5;
  // The premise: the gap passes as a gutter, and the label column is wider than it.
  assert.ok(valueX - (40 + inkOf('Data location', size)) > size * 1.8);
  assert.ok(inkOf('Data location', size) > valueX - (40 + inkOf('Data location', size)));
  const nodes = KEY_VALUES.flatMap(([label, value], k) => [run(label, 40, 110 + k * 20, size, 700), run(value, valueX, 110 + k * 20, size)]);
  return title ? [run('What the service promises, from the first day to the last', 40, 60, 22), ...nodes] : nodes;
}

for (const title of [false, true]) {
  test(`a label/value table ${title ? 'under a spanning title ' : ''}keeps each label with its value`, () => {
    const page = extractPageText(keyValueTable(title), { width: 720, height: 405 });
    assert.equal(page.columns, 1);
    const at = KEY_VALUES.flatMap(([label, value]) => [page.text.indexOf(label), page.text.indexOf(value)]);
    assert.ok(at.every((p) => p >= 0), page.text);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `rows stay paired:\n${page.text}`);
  });
}

test('a label/value table with a wider header row keeps its rows paired', () => {
  const rows: Array<[string, string]> = [['Headquarters', 'Frankfurt am Main, Germany'], ['Founded in', 'Nineteen ninety-eight, as a spin-off'], ['Employees', 'Four thousand in twelve countries'], ['Customers', 'More than three thousand'], ['Revenue', 'Six hundred million last year']];
  const size = 10;
  const valueX = 20 + inkOf('Headquarters', size) + 20;
  const nodes = [
    run('Attribute of the company', 20, 80, size, 700), run('Value', valueX + 80, 80, size, 700),
    ...rows.flatMap(([label, value], k) => [run(label, 20, 100 + k * 14, size), run(value, valueX, 100 + k * 14, size)]),
  ];
  const page = extractPageText(nodes, { width: 500, height: 300 });
  assert.equal(page.columns, 1);
  assert.match(page.text, /Headquarters Frankfurt am Main, Germany Founded in Nineteen/);
});

test('a list of rows that each end in a figure reads one row a block', () => {
  const rows: Array<[string, string]> = [['Strategy', '15%'], ['Legal and jurisdiction', '10%'], ['Data and AI', '10%'], ['Operations', '15%'], ['Supply chain', '20%']];
  const nodes = [run('Objective weighting', 40, 40, 16, 700), ...rows.flatMap(([name, share], k) => [run(`${k + 1}: ${name}`, 40, 80 + k * 40, 12), run(share, 300, 80 + k * 40, 12)])];
  const page = extractPageText(nodes, { width: 400, height: 300 });
  assert.deepEqual(page.blocks.slice(1).map((b) => b.text), rows.map(([name, share], k) => `${k + 1}: ${name} ${share}`));
});

test('a phrase set in bold mid-sentence stays in its paragraph', () => {
  const nodes = [
    run('A paragraph that starts in the regular weight and', 40, 100),
    run('then sets a whole line of it in bold to stress it', 40, 114, 10, 700),
    run('before it carries on to the end of the sentence.', 40, 128),
  ];
  assert.equal(extractPageText(nodes, { width: 400, height: 300 }).blocks.length, 1);
});

for (const ragged of [false, true]) {
  test(`a long ${ragged ? 'ragged ' : ''}table does not use up the sweep before the columns under it`, () => {
    // Every stretch of the table fails as columns. Tried again from each of its
    // rows (or, when every other value is short, from each short row), it spent
    // the page's work cap, and the two columns under it read interleaved.
    const nodes: PdfNode[] = [];
    for (let r = 0; r < 1200; r++) {
      // The long value reaches the region's right edge, so each short row opens
      // a stretch the row above crosses.
      nodes.push(run(`R${r}`, 20, 20 + r * 12), run(ragged && r % 2 ? 'x' : 'a longer value in this cell that runs on to the right edge of the page', 120, 20 + r * 12));
    }
    const below = 20 + 1200 * 12 + 30;
    nodes.push(run('A title across both columns, from the left edge of the page to past the gutter', 20, below, 14));
    nodes.push(...PROSE.map((l, k) => run(`left ${l}`, 20, below + 40 + k * 14)), ...PROSE.map((l, k) => run(`right ${l}`, 220, below + 40 + k * 14)));
    const page = extractPageText(nodes, { width: 400, height: below + 200 });
    assert.deepEqual(page.blocks.slice(-2).map((b) => b.text.split(' ')[0]), ['left', 'right'], page.blocks.slice(-3).map((b) => b.text.slice(0, 60)).join('\n'));
  });
}

test('the sweep stays fast on a page of multi-line table cells at the node cap', () => {
  // Twenty narrow columns of five-line cells: every stretch fails as columns,
  // which once cost a split for every start slab (over a second a page).
  const nodes: PdfNode[] = [];
  for (let r = 0; nodes.length < PDF_TEXT_MAX_NODES; r++) {
    for (let c = 0; c < 20 && nodes.length < PDF_TEXT_MAX_NODES; c++) {
      const text = Array.from({ length: 5 }, () => 'ab 12').join('\n');
      const ink = inkOf('ab 12', 10);
      nodes.push({ kind: 'text', x: 20 + c * 60, y: 20 + r * 62, w: ink, h: 14, rot: 0, fontSize: 10, fontWeight: 400, fontFamily: 'Helvetica', text, lineHeight: 1.2, lineInk: Array(5).fill(ink) });
    }
  }
  const started = performance.now();
  const page = extractPageText(nodes);
  const ms = performance.now() - started;
  assert.equal(page.columns, 1);
  assert.ok(ms < 1000, `took ${ms.toFixed(0)} ms`);
});

// ─── the private corpus, measured ────────────────────────────────────────────

/** What a private PDF must show, by page (1-based). */
interface CorpusExpectation {
  /** Pages once read with their columns interleaved, which must now join none. */
  noJoins: number[];
  /**
   * Pages whose text right of `fromX` must read row by row: the reading never
   * climbs back up the page by more than three body sizes (a zig-zag timeline,
   * a table whose cells run to several lines).
   */
  rowOrder: Array<{ page: number; fromX: number }>;
  /** Pages of a list whose rows each end in a percentage: one row a block. */
  listRows: number[];
  /** A ceiling on the whole file's joins. */
  ceiling: number;
}

/**
 * The private corpus, keyed by the SHA-256 of each file's bytes, so this public
 * file names no document. What the ceilings leave is measured, not missed:
 * tables read row by row (a label beside its description), a row of three stat
 * tiles two lines deep (too few lines a side to believe), and one heading word
 * the measure matches in two places. Before the region sweep the two files
 * measured 30 and 12.
 */
const CORPUS: Record<string, CorpusExpectation> = {
  '107c420e9caafda98a5b028c00e5729e2e7697e14e879fa55b686b42f59fd528': { noJoins: [2, 3, 5], rowOrder: [{ page: 8, fromX: 0 }], listRows: [], ceiling: 2 },
  '1abea25b67b3fdaf9cc48b2feb70eca0c8d3b8183a1c49e8e68180bce2f629bb': { noJoins: [13, 15], rowOrder: [{ page: 14, fromX: 330 }], listRows: [15], ceiling: 5 },
};

/**
 * The furthest the reading climbs back up the page, among source lines at or
 * right of `fromX` whose text occurs once in the page text.
 */
function largestClimb(nodes: PdfNode[], page: PageText, fromX: number): { climb: number; body: number; at: string } {
  const pieces = piecesOf(nodes);
  const body = bodySizeOf(pieces);
  const once = pieces
    .filter((p) => p.x >= fromX && p.text.length >= 6)
    .map((p) => ({ p, at: page.text.indexOf(p.text) }))
    .filter(({ p, at }) => at >= 0 && at === page.text.lastIndexOf(p.text))
    .sort((a, b) => a.at - b.at);
  let lowest = -Infinity;
  let climb = 0;
  let where = '';
  for (const { p } of once) {
    if (lowest - p.baseline > climb) { climb = lowest - p.baseline; where = p.text; }
    lowest = Math.max(lowest, p.baseline);
  }
  return { climb, body, at: where };
}

test('no page of a private PDF interleaves lines from two columns', { skip: skipReason() ?? false }, async (t) => {
  const corpus = privateCorpus();
  assert.ok(corpus);
  const { loadPdfDocument, interpretPdfDocPage } = await import('../packages/node-shell/src/pdf-read.ts');
  const pdfs = [...corpus.files, ...corpus.slidesToTest].filter((f) => f.toLowerCase().endsWith('.pdf'));
  assert.ok(pdfs.length > 0, 'the private corpus holds no PDF');
  const seen: string[] = [];
  for (const file of pdfs) {
    const bytes = readFileSync(file);
    const key = createHash('sha256').update(bytes).digest('hex');
    const known = CORPUS[key];
    if (known) seen.push(key);
    const label = `${key.slice(0, 12)} (${path.basename(file)})`;
    const doc = await loadPdfDocument(new Uint8Array(bytes));
    let total = 0;
    for (let k = 0; k < doc.getPageCount(); k++) {
      const pageRead = interpretPdfDocPage(doc, k);
      const page = extractPageText(pageRead.nodes, { width: pageRead.width, height: pageRead.height });
      const { joins, samples } = interleavedJoins(pageRead.nodes, page);
      total += joins;
      if (!known) continue;
      if (known.noJoins.includes(k + 1)) assert.equal(joins, 0, `${label} page ${k + 1}:\n${samples.join('\n')}`);
      for (const { page: n, fromX } of known.rowOrder) {
        if (n !== k + 1) continue;
        const { climb, body, at } = largestClimb(pageRead.nodes, page, fromX);
        assert.ok(climb <= body * 3, `${label} page ${n} climbs ${climb.toFixed(1)} back up the page at "${at}":\n${page.text}`);
      }
      if (known.listRows.includes(k + 1)) {
        for (const b of page.blocks) assert.ok((b.text.match(/\d%/g) ?? []).length <= 1, `${label} page ${k + 1} joins list rows: ${b.text}`);
      }
    }
    t.diagnostic(`${label}: ${total} interleaved joins over ${doc.getPageCount()} pages`);
    if (known) assert.ok(total <= known.ceiling, `${label}: ${total} interleaved joins, ceiling ${known.ceiling}`);
  }
  assert.deepEqual(seen.sort(), Object.keys(CORPUS).sort(), 'every expected private PDF was found');
});
