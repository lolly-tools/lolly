// SPDX-License-Identifier: MPL-2.0
/**
 * Failed-redaction detection - text present in the file but not on the page.
 * Run directly:  node --test tests/pdf-redaction.test.ts
 *
 * The pass reads "painted after" from ARRAY ORDER, so every fixture here is
 * written as a paint sequence and the order of the array IS the assertion in
 * most of these tests. The last test in this file pins the upstream invariant
 * that makes that legal: `interpretPdfPage` returns nodes in paint order and
 * never sorts them. If someone ever adds a sort there, this whole module
 * silently starts reporting nonsense - highlights as redactions and redactions
 * as nothing - so that test exists to fail loudly instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHiddenText, findHiddenTextInPages, describeHiddenText } from '../engine/src/pdf-redaction.ts';
import { interpretPdfPage } from '../engine/src/pdf-map.ts';
import type { PdfNode } from '../engine/src/pdf-map.ts';

// ─── harness ──────────────────────────────────────────────────────────────────

interface BoxOpts { fill?: string; opacity?: number; softMask?: boolean }

function text(s: string, x: number, y: number, w = 100, h = 14): PdfNode {
  return { kind: 'text', x, y, w, h, rot: 0, fontSize: 11, text: s };
}

function box(x: number, y: number, w: number, h: number, o: BoxOpts = {}): PdfNode {
  const n: PdfNode = { kind: 'box', x, y, w, h, rot: 0, fill: o.fill ?? '#000000' };
  if (o.opacity !== undefined) n.opacity = o.opacity;
  // A stand-in for a real soft mask - the pass only checks for its presence.
  if (o.softMask) (n as PdfNode)._softMask = { key: 'm0', nodes: [] } as unknown as PdfNode['_softMask'];
  return n;
}

function img(x: number, y: number, w: number, h: number): PdfNode {
  return { kind: 'image', x, y, w, h, rot: 0, _imageXObject: 'im0' };
}

// ─── the core case ────────────────────────────────────────────────────────────

test('a black bar painted over text is reported, with the text intact', () => {
  const found = findHiddenText([
    text('Social Security 123-45-6789', 60, 100),
    box(55, 96, 110, 22),                                   // painted AFTER → a cover
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.text, 'Social Security 123-45-6789');
  assert.equal(found[0]!.fullyHidden, true);
  assert.equal(found[0]!.coverage, 1);
  assert.equal(found[0]!.fill, '#000000');
});

test('the SAME box painted BEFORE the text is a highlight, not a cover', () => {
  // This is the distinction the whole check turns on. Identical geometry, and
  // only the paint order differs.
  const found = findHiddenText([
    box(55, 96, 110, 22),
    text('Perfectly visible heading', 60, 100),
  ]);
  assert.deepEqual(found, []);
});

test('a page with no filled shapes at all reports nothing', () => {
  assert.deepEqual(findHiddenText([text('ordinary prose', 60, 100)]), []);
});

test('a box that misses the text entirely is not a cover', () => {
  const found = findHiddenText([text('visible', 60, 100), box(300, 400, 80, 20)]);
  assert.deepEqual(found, []);
});

// ─── opacity ──────────────────────────────────────────────────────────────────

test('a translucent shape does not conceal', () => {
  // 40% ink over words leaves them legible - reporting it would be a lie.
  const found = findHiddenText([text('still readable', 60, 100), box(55, 96, 110, 22, { opacity: 40 })]);
  assert.deepEqual(found, []);
});

test('a fully opaque shape conceals', () => {
  const found = findHiddenText([text('hidden', 60, 100), box(55, 96, 110, 22, { opacity: 100 })]);
  assert.equal(found.length, 1);
});

test('a soft-masked shape is refused even at full opacity', () => {
  // Its real per-pixel alpha is unknown here, so it cannot be offered as proof.
  const found = findHiddenText([text('uncertain', 60, 100), box(55, 96, 110, 22, { softMask: true })]);
  assert.deepEqual(found, []);
});

// ─── colour is not the test ───────────────────────────────────────────────────

test('a white box conceals exactly as well as a black one', () => {
  // White-on-white is the quieter version of the same mistake, and a
  // colour-based check would miss it completely.
  const found = findHiddenText([text('confidential', 60, 100), box(55, 96, 110, 22, { fill: '#ffffff' })]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.fill, '#ffffff');
});

test('an image pasted over text conceals it', () => {
  const found = findHiddenText([text('under the photo', 60, 100), img(55, 96, 110, 22)]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.fill, 'image');
});

// ─── coverage ─────────────────────────────────────────────────────────────────

test('a bar over half a run is below the reporting floor', () => {
  const found = findHiddenText([text('half covered', 60, 100, 100, 14), box(60, 100, 50, 14)]);
  assert.deepEqual(found, []);
});

test('the floor is adjustable for a caller that wants partials', () => {
  const found = findHiddenText([text('half covered', 60, 100, 100, 14), box(60, 100, 50, 14)], { minCoverage: 0.4 });
  assert.equal(found.length, 1);
  assert.equal(Math.round(found[0]!.coverage * 100), 50);
  // Half-covered is obscured, not gone - the distinction the UI needs.
  assert.equal(found[0]!.fullyHidden, false);
});

test('two adjacent bars over one run are unioned, not taken singly', () => {
  // Neither bar covers enough alone; together they cover everything. Taking the
  // largest single overlap would miss the most damaging case there is - a long
  // redacted line struck out in pieces.
  const found = findHiddenText([
    text('a long redacted sentence', 60, 100, 100, 14),
    box(60, 100, 50, 14),
    box(110, 100, 50, 14),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.coverage, 1);
});

test('overlapping bars are not double-counted into a false full cover', () => {
  // Summing these would give 0.8 of the run from two bars that really cover 0.5.
  const found = findHiddenText([
    text('mostly visible', 60, 100, 100, 14),
    box(60, 100, 40, 14),
    box(70, 100, 40, 14),
  ], { minCoverage: 0.01 });
  assert.equal(found.length, 1);
  assert.equal(Math.round(found[0]!.coverage * 100), 50);
});

// ─── realistic shapes ─────────────────────────────────────────────────────────

test('a redaction sweep reports every covered run and leaves the rest alone', () => {
  const found = findHiddenText([
    text('Name: Ada Lovelace', 60, 100),
    text('Role: Analyst', 60, 120),
    text('Notes: nothing sensitive', 60, 140),
    box(55, 96, 110, 22),        // over the name
    box(55, 116, 110, 22),       // over the role
  ]);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((f) => f.text), ['Name: Ada Lovelace', 'Role: Analyst']);
});

test('a background panel drawn first under a whole block is not a redaction', () => {
  // The everyday layout that a naive check turns into a page full of findings.
  const found = findHiddenText([
    box(40, 80, 300, 120, { fill: '#eeeeee' }),
    text('Callout heading', 60, 100),
    text('Callout body text', 60, 120),
    text('More body text', 60, 140),
  ]);
  assert.deepEqual(found, []);
});

test('a footer rule painted last does not swallow the page', () => {
  const found = findHiddenText([
    text('Body copy', 60, 100),
    box(40, 700, 500, 2),        // a hairline, far from the text
  ]);
  assert.deepEqual(found, []);
});

// ─── document level ───────────────────────────────────────────────────────────

test('the document pass tags findings with their page', () => {
  const clean = [text('nothing to see', 60, 100)];
  const dirty = [text('the secret', 60, 100), box(55, 96, 110, 22)];
  const found = findHiddenTextInPages([clean, dirty, dirty]);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((f) => f.page), [1, 2]);
});

test('the summary counts words and pages and never accuses', () => {
  const found = findHiddenTextInPages([
    [text('one two three', 60, 100), box(55, 96, 110, 22)],
    [text('four five', 60, 100), box(55, 96, 110, 22)],
  ]);
  const s = describeHiddenText(found);
  assert.match(s, /5 words/);
  assert.match(s, /2 runs/);
  assert.match(s, /across 2 pages/);
  assert.match(s, /present in the file, not visible on the page/);
  // Wording is an observation, not an allegation.
  assert.doesNotMatch(s, /redact|conceal|hid/i);
});

test('an empty scan summarises to nothing at all', () => {
  assert.equal(describeHiddenText([]), '');
});

// ─── hostile input ────────────────────────────────────────────────────────────

test('degenerate geometry yields no findings rather than throwing', () => {
  const found = findHiddenText([
    { kind: 'text', x: NaN, y: NaN, w: NaN, h: NaN, rot: 0, text: 'ghost' },
    { kind: 'box', x: 0, y: 0, w: 0, h: 0, rot: 0, fill: '#000' },
    { kind: 'text', x: 0, y: 0, w: 10, h: 10, rot: 0, text: '   ' },
  ]);
  assert.deepEqual(found, []);
});

test('word-by-word bars tiling one line still add up to a full cover', () => {
  // The realistic striped case: a sentence redacted one word at a time. Every
  // bar is small; only their union tells the truth.
  const nodes: PdfNode[] = [text('a long line redacted word by word', 0, 100, 400, 14)];
  for (let i = 0; i < 20; i++) nodes.push(box(i * 20, 100, 20, 14));
  const found = findHiddenText(nodes);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.coverage, 1);
  assert.equal(found[0]!.fullyHidden, true);
});

test('a pathological number of bars stays bounded and never over-reports', () => {
  // Past the per-run cap the answer can only come out LOW, never high - the cap
  // must not be able to manufacture a finding that is not there.
  const nodes: PdfNode[] = [text('a very long line', 0, 100, 4000, 14)];
  for (let i = 0; i < 500; i++) nodes.push(box(i * 2, 100, 1, 14));
  const found = findHiddenText(nodes);
  // These 500 hairlines really cover 500/4000 = 12.5%; nothing should be claimed.
  assert.deepEqual(found, []);
});

// ─── the upstream invariant this module rests on ──────────────────────────────

test('interpretPdfPage returns nodes in PAINT order — the invariant this rests on', () => {
  // Content stream: fill a rect, show text, fill a second rect. If the
  // interpreter ever sorted its output (by position, size, kind, anything), the
  // "painted after" test above would quietly become meaningless.
  const nodes = interpretPdfPage({
    content: '0 0 1 rg 10 200 50 20 re f BT /F1 12 Tf 1 0 0 1 20 150 Tm (middle) Tj ET 1 0 0 rg 10 100 50 20 re f',
    width: 400,
    height: 300,
  }) as PdfNode[];

  const kinds = nodes.map((n) => n.kind);
  assert.deepEqual(kinds, ['box', 'text', 'box'], `expected paint order, got ${kinds.join(',')}`);
  // And the colours confirm which box is which - first blue, then red.
  assert.equal(nodes[0]!.fill, '#0000ff');
  assert.equal(nodes[2]!.fill, '#ff0000');
});

test('a real content stream that paints a bar over text is caught end to end', () => {
  // Text first, then an opaque black rectangle across it - a redaction, written
  // the way a generator would emit one.
  const nodes = interpretPdfPage({
    content: 'BT /F1 12 Tf 1 0 0 1 20 150 Tm (classified) Tj ET 0 g 15 140 120 20 re f',
    width: 400,
    height: 300,
  }) as PdfNode[];

  const found = findHiddenText(nodes, { minCoverage: 0.5 });
  assert.equal(found.length, 1, 'the covered run should be found');
  assert.equal(found[0]!.text, 'classified');
});
