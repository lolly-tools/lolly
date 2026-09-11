// SPDX-License-Identifier: MPL-2.0
/**
 * Unit coverage for the PURE half of the PDF source (sources/pdf.ts): the census
 * adapter, the face dedupe and its honesty chips, and the logo cap.
 *
 * Fixtures are plain objects in the shapes `listVectors` / `listFonts` return,
 * which is the whole point of the split - the browser half is the only part that
 * needs a document, and everything with judgement in it lives on this side of
 * the line and runs under bare node.
 *
 * `censusFromPdfVectors` and `describeFaceSource` are the real modules on
 * purpose: the assertions that matter are "the ink/ground split survived the
 * adapter" and "a subset stayed a subset", neither of which a stub could answer.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/sources/pdf.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { candidatesFromCensus } from '../tray.ts';
import {
  MAX_LOGO_PICKS, PDF_MAX_BYTES, PDF_PAGE_CAP,
  pdfFontCandidates, pdfLogoPicks, pdfScanToCensus,
} from './pdf.ts';
import type { PdfScanFont, PdfScanVector } from './pdf.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const bytes = (n = 8): Uint8Array => new Uint8Array(n).fill(1);

/** Two marks off a guidelines page: a two-colour logo and a one-colour repeat. */
const MARKS: PdfScanVector[] = [
  { fills: ['#1E4FD8', '#FFFFFF'], svg: '<svg id="a"/>', page: 0, shapes: 6 },
  { fills: ['#1E4FD8'], svg: '<svg id="b"/>', page: 2, shapes: 3 },
];

const FONTS: PdfScanFont[] = [
  {
    name: 'ABCDEF+Inter-Regular', family: 'Inter-Regular', subset: true, installable: true,
    bytes: bytes(), embedding: { permission: 'installable' },
  },
  {
    name: 'GHIJKL+Inter-Bold', family: 'Inter-Bold', subset: true, installable: true, bytes: bytes(),
  },
];

const find = (rows: { hex: string }[], hex: string): { hex: string; weight?: number; kind?: string } | undefined =>
  rows.find(r => r.hex === hex) as { hex: string; weight?: number; kind?: string } | undefined;

// ── Colours ──────────────────────────────────────────────────────────────────

test('fills aggregate across marks, most-used-first within each mark', () => {
  const census = pdfScanToCensus({ vectors: MARKS, fonts: [] }, 'guidelines.pdf');

  // Mark 1 gives blue 2 (leading) and white 1; mark 2 gives blue 1 → blue 3.
  assert.equal(find(census.colors, '#1E4FD8')?.weight, 3);
  assert.equal(find(census.colors, '#FFFFFF')?.weight, 1);
  assert.equal(census.source.kind, 'pdf');
  assert.equal(census.source.label, 'guidelines.pdf');
});

test('the ink/ground split survives the adapter', () => {
  const census = pdfScanToCensus({ vectors: MARKS, fonts: [] }, 'g.pdf');
  // A saturated mark colour is ink (stroke); the near-white is the ground it
  // sits on (fill). Getting this backwards is what inverts every proposed role.
  assert.equal(find(census.colors, '#1E4FD8')?.kind, 'stroke');
  assert.equal(find(census.colors, '#FFFFFF')?.kind, 'fill');
});

// ── Fonts in the census ──────────────────────────────────────────────────────

test('two weights of one family are one census font, flat and role-free', () => {
  const census = pdfScanToCensus({ vectors: [], fonts: FONTS }, 'g.pdf');
  assert.deepEqual(census.fonts, [{ family: 'Inter', usage: 'unknown', count: 1 }]);
});

test('a mono family is still reported as unknown usage', () => {
  const census = pdfScanToCensus({
    vectors: [],
    fonts: [{ name: 'MNOPQR+IBMPlexMono-Regular', subset: true }],
  }, 'g.pdf');
  // Nothing here saw a text run, so nothing here claims a role.
  assert.equal(census.fonts[0]?.usage, 'unknown');
  assert.equal(census.fonts[0]?.family, 'IBM Plex Mono');
});

test('a face with no readable name is dropped rather than filed as ""', () => {
  const census = pdfScanToCensus({ vectors: [], fonts: [{ name: '   ' }] }, 'g.pdf');
  assert.deepEqual(census.fonts, []);
});

// ── The document name ────────────────────────────────────────────────────────

test('a title becomes the census name; blank and overlong titles do not', () => {
  assert.equal(pdfScanToCensus({ vectors: [], fonts: [], title: '  Acme  Brand ' }, 'g.pdf').name, 'Acme Brand');
  assert.equal(pdfScanToCensus({ vectors: [], fonts: [], title: '   ' }, 'g.pdf').name, undefined);
  assert.equal(pdfScanToCensus({ vectors: [], fonts: [], title: 'x'.repeat(200) }, 'g.pdf').name, undefined);
  // No title at all: the label is provenance, never promoted to a name.
  assert.equal(pdfScanToCensus({ vectors: [], fonts: [] }, 'brand-v4-FINAL').name, undefined);
});

// ── Empty scans ──────────────────────────────────────────────────────────────

test('an empty scan yields an empty census, not a throw', () => {
  const census = pdfScanToCensus({ vectors: [], fonts: [] }, '');
  assert.deepEqual(census.colors, []);
  assert.deepEqual(census.fonts, []);
  assert.deepEqual(census.gradients, []);
  assert.deepEqual(pdfFontCandidates([]), []);
  assert.deepEqual(pdfLogoPicks([]), []);
});

test('marks that carry no colour at all do not invent a ground', () => {
  const census = pdfScanToCensus({ vectors: [{ fills: [] }], fonts: [] }, 'g.pdf');
  assert.deepEqual(census.colors, []);
});

// ── Font candidates ──────────────────────────────────────────────────────────

test('candidates dedupe per family+weight and keep the document spelling', () => {
  const rows = pdfFontCandidates([
    ...FONTS,
    // The same Regular program reached through a second subset prefix.
    { name: 'ZZZZZZ+Inter-Regular', family: 'Inter-Regular', subset: true, installable: true, bytes: bytes() },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.family), ['Inter', 'Inter']);
  assert.equal(rows[0]?.raw, 'ABCDEF+Inter-Regular');
  assert.equal(rows[1]?.raw, 'GHIJKL+Inter-Bold');
});

test('an italic is its own candidate, not a duplicate of the upright', () => {
  const rows = pdfFontCandidates([
    { name: 'AAAAAA+Inter-Regular', installable: true, bytes: bytes() },
    { name: 'BBBBBB+Inter-Italic', installable: true, bytes: bytes() },
  ]);
  assert.equal(rows.length, 2);
});

test('chips report what the source stated and nothing more', () => {
  const [subsetted, silent] = pdfFontCandidates(FONTS);
  // Stated subset + stated fsType permission.
  assert.deepEqual(subsetted?.chips, ['SUBSET', 'installable']);
  // Subset stated, embedding never mentioned - unknown stays unknown.
  assert.deepEqual(silent?.chips, ['SUBSET', 'unknown']);

  // subset: false produces no chip (the source may simply not have looked).
  const [full] = pdfFontCandidates([{ name: 'Work Sans', subset: false, bytes: bytes() }]);
  assert.deepEqual(full?.chips, ['unknown']);

  // An embedding word we cannot vouch for is not repeated back.
  const [odd] = pdfFontCandidates([
    { name: 'Work Sans', bytes: bytes(), embedding: { permission: 'probably fine' } },
  ]);
  assert.deepEqual(odd?.chips, ['unknown']);
});

test('installable candidates come first, document order otherwise', () => {
  const rows = pdfFontCandidates([
    { name: 'Locked One', bytes: bytes() },
    { name: 'Open One', installable: true, bytes: bytes() },
    { name: 'Locked Two', bytes: bytes() },
  ]);
  assert.deepEqual(rows.map(r => r.family), ['Open One', 'Locked One', 'Locked Two']);
});

test('a duplicate that is better to install replaces the one kept', () => {
  const good = bytes(16);
  const rows = pdfFontCandidates([
    { name: 'ABCDEF+Inter-Regular', subset: true, bytes: bytes(4) },
    { name: 'Inter-Regular', subset: false, installable: true, bytes: good },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.bytes, good);
  assert.deepEqual(rows[0]?.chips, ['unknown']);
});

test('a face with no bytes is not offered', () => {
  assert.deepEqual(pdfFontCandidates([
    { name: 'Inter-Regular', installable: true },
    { name: 'Inter-Bold', installable: true, bytes: new Uint8Array(0) },
  ]), []);
});

// ── Logo picks ───────────────────────────────────────────────────────────────

test('picks are capped at eight, richest marks first', () => {
  const many: PdfScanVector[] = Array.from({ length: 12 }, (_, i) => ({
    fills: ['#000000'], svg: `<svg id="${i}"/>`, page: i, shapes: i,
  }));
  const picks = pdfLogoPicks(many);
  assert.equal(picks.length, MAX_LOGO_PICKS);
  assert.equal(picks[0]?.svg, '<svg id="11"/>');   // 11 shapes
  assert.equal(picks[7]?.svg, '<svg id="4"/>');    // 4 shapes

  // The cap is hard: a caller asking for more still gets eight.
  assert.equal(pdfLogoPicks(many, { max: 50 }).length, MAX_LOGO_PICKS);
  assert.equal(pdfLogoPicks(many, { max: 3 }).length, 3);
  assert.deepEqual(pdfLogoPicks(many, { max: 0 }), []);
});

test('equal shape counts keep document order', () => {
  const picks = pdfLogoPicks([
    { fills: [], svg: '<svg id="first"/>', page: 0, shapes: 4 },
    { fills: [], svg: '<svg id="second"/>', page: 1, shapes: 4 },
  ]);
  assert.deepEqual(picks.map(p => p.svg), ['<svg id="first"/>', '<svg id="second"/>']);
});

test('names number the picks and the page a human would turn to', () => {
  const picks = pdfLogoPicks(MARKS);
  assert.equal(picks[0]?.name, 'Mark 1 (page 1)');
  assert.equal(picks[1]?.name, 'Mark 2 (page 3)');
  // …while `page` stays in the extractor's own 0-based numbering.
  assert.deepEqual(picks.map(p => p.page), [0, 2]);
});

test('every pick carries the row it came from, through the filter and the sort', () => {
  const picks = pdfLogoPicks([
    { fills: [], page: 0, shapes: 9 },                              // no svg - dropped
    { fills: [], svg: '<svg id="small"/>', page: 0, shapes: 2 },
    { fills: [], svg: '   ', page: 1, shapes: 9 },                  // blank svg - dropped
    { fills: [], svg: '<svg id="big"/>', page: 1, shapes: 7 },
  ]);
  // Ranked richest-first, so the picks are in neither the document's order nor
  // the filtered list's - `index` is the position in the array as SUPPLIED.
  assert.deepEqual(picks.map(p => p.svg), ['<svg id="big"/>', '<svg id="small"/>']);
  assert.deepEqual(picks.map(p => p.index), [3, 1]);
});

test('two marks with identical SVG keep distinct indices', () => {
  // The case that motivated the field: a logo repeated verbatim on two pages
  // used to be resolved by matching the SVG text back into the scan, which
  // returned the FIRST match and named both files the same thing.
  const twin = '<svg id="repeat"/>';
  const picks = pdfLogoPicks([
    { fills: [], svg: twin, page: 0, shapes: 5 },
    { fills: [], svg: twin, page: 4, shapes: 5 },
  ]);
  assert.deepEqual(picks.map(p => p.index), [0, 1]);
  assert.deepEqual(picks.map(p => p.page), [0, 4]);
});

test('a mark with no SVG is not a pick', () => {
  assert.deepEqual(pdfLogoPicks([
    { fills: ['#000000'], page: 0, shapes: 9 },
    { fills: ['#000000'], svg: '   ', page: 1, shapes: 9 },
  ]), []);
});

// ── Composition ──────────────────────────────────────────────────────────────

test('the census feeds the tray without further adaptation', () => {
  const census = pdfScanToCensus({ vectors: MARKS, fonts: FONTS, title: 'Acme' }, 'guidelines.pdf');
  const kinds = candidatesFromCensus(census).map(c => `${c.type}:${c.value}`);
  assert.ok(kinds.includes('color:#1E4FD8'));
  assert.ok(kinds.includes('font:Inter'));
  assert.ok(kinds.includes('name:Acme'));
  assert.equal(candidatesFromCensus(census)[0]?.provenance.label, 'guidelines.pdf');
});

// ── Caps are stated, not implied ─────────────────────────────────────────────

test('the published caps are the ones the plan asked for', () => {
  assert.equal(PDF_MAX_BYTES, 64 * 1024 * 1024);
  assert.equal(PDF_PAGE_CAP, 30);   // the REDACTION_PAGE_CAP precedent
  assert.equal(MAX_LOGO_PICKS, 8);
});
