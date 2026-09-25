// SPDX-License-Identifier: MPL-2.0
/**
 * Word spacing in the engine PDF interpreter (plan 274, milestone 5 follow-up).
 *
 * Office exporters rarely spell the space between words. They place each word
 * as its own run (a text object per word, or a `Tm` per word inside one), tighten
 * letter pairs with small positive `TJ` numbers and open word gaps with large
 * negative ones, and write the glyph codes of an embedded Type0 font as raw bytes
 * inside literal strings. Two things went wrong on real decks:
 *
 *   1. The reader decodes a content stream with `TextDecoder('latin1')`, which the
 *      Encoding Standard defines as windows-1252. Bytes 0x80 to 0x9F came back as
 *      CP1252 characters (0x92 as U+2019), so a CID holding one of them was a
 *      different code and its glyph was lost: letters, commas and the space glyph
 *      all went ("Why Sovereignty" read "hySovereignty"). `streamByte` in
 *      pdf-map.ts maps them back.
 *   2. Runs were joined against an estimated right edge (0.55 em a character),
 *      which overshoots a real face and hides a word gap. The interpreter now
 *      measures each line's ink with the font's own advance widths (`lineInk`),
 *      marks a run that showed a trailing space glyph (`spaceAfter`), and one
 *      rule (`pdfWordBreak`) decides inside a node and between nodes.
 *
 * The PDF below is written by hand in this file, byte for byte, so it is the
 * same on every run and needs no committed fixture.
 *
 * Run with: node --test "tests/pdf-word-spacing.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  interpretPdfPage,
  pdfWordBreak,
  PDF_MIXED_GAP_EM,
  PDF_RUN_WORD_GAP_EM,
  PDF_WORD_GAP_EM,
  type PdfFontInfo,
  type PdfNode,
} from '../engine/src/pdf-map.ts';
import { extractPageText } from '../engine/src/pdf-text.ts';
import { loadPdfDocument, interpretPdfDocPage } from '../packages/node-shell/src/pdf-read.ts';
import { privateCorpus, skipReason } from './helpers/rebrand-fixtures.ts';

// ─── a face's advance widths (Helvetica's, in thousandths of an em) ─────────

const WIDTHS: Record<string, number> = {
  ' ': 278, "'": 191, ',': 278, '-': 333, '.': 278, ':': 278,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
};
const widthOf = (ch: string): number => WIDTHS[ch] ?? 556;
/** The ink advance of `text` at `size`, less `kern` thousandths of an em of TJ tightening. */
const inkOf = (text: string, size: number, kern = 0): number =>
  ([...text].reduce((sum, ch) => sum + widthOf(ch), 0) - kern) / 1000 * size;

/** A simple font over the table above, codes 32 to 122. */
const SIMPLE: PdfFontInfo = {
  family: 'Helvetica',
  widths: Object.fromEntries(Array.from({ length: 91 }, (_, k) => [32 + k, widthOf(String.fromCharCode(32 + k))])),
};

// ─── a hand-written PDF ──────────────────────────────────────────────────────

/** Characters of the Type0 font, CID 0x80 upward, so every low byte of the first 32 falls in 0x80 to 0x9F. */
const CID_CHARS = [...new Set('Why Sovereignty Can No Longer Wait'.split(''))];
const cidOf = (ch: string): number => {
  const k = CID_CHARS.indexOf(ch);
  assert.ok(k >= 0, `no CID for ${JSON.stringify(ch)}`);
  return 0x80 + k;
};
/** A literal string of two-byte CIDs, the raw bytes an office exporter writes. */
const cidString = (text: string): string =>
  `(${[...text].map((ch) => String.fromCharCode(cidOf(ch) >> 8, cidOf(ch) & 0xff)).join('')})`;

const stream = (dict: string, data: string): string =>
  `<< ${dict} /Length ${Buffer.byteLength(data, 'latin1')} >>\nstream\n${data}\nendstream`;

/** Serialise numbered objects (1-based, object 1 the catalog) with a correct xref. */
function buildPdf(objects: string[]): Uint8Array {
  let out = '%PDF-1.7\n%âãÏÓ\n';
  const offsets: number[] = [];
  objects.forEach((body, k) => {
    offsets.push(out.length);
    out += `${k + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

const PAGE_W = 600;
const PAGE_H = 300;

/**
 * Line 1 (y 250): one text object per word in the Type0 font, the way the evroc
 * deck is set, with a kerning pair inside "Sovereignty" and the space advance
 * between words.
 * Line 2 (y 200): one text object, a `Tm` per word in a simple font, and a TJ
 * that tightens inside "Imperative" and opens a word gap before "now".
 * Line 3 (y 150): a bold word and a regular word a space apart, then a word
 * whose first three letters are bold and touch the rest.
 * Line 4 (y 100): a run that shows its trailing space glyph, with the next word
 * pulled in closer than a word gap.
 */
function officeContent(): string {
  const ops: string[] = [];
  const size = 20;
  let x = 40;
  for (const word of 'Why Sovereignty Can No Longer Wait'.split(' ')) {
    const show = word === 'Sovereignty'
      ? `[${cidString('So')} 30 ${cidString('vereignty')}] TJ`
      : `[${cidString(word)}] TJ`;
    ops.push(`BT /F2 ${size} Tf 1 0 0 1 ${x.toFixed(3)} 250 Tm ${show} ET`);
    x += inkOf(word, size, word === 'Sovereignty' ? 30 : 0) + inkOf(' ', size);
  }

  const body = 16;
  const x2 = 40 + inkOf('The ', body);
  const x3 = x2 + inkOf('Market ', body);
  ops.push(`BT /F1 ${body} Tf 1 0 0 1 40 200 Tm (The) Tj 1 0 0 1 ${x2.toFixed(3)} 200 Tm (Market) Tj`
    + ` 1 0 0 1 ${x3.toFixed(3)} 200 Tm [(Imp) 20 (erative) -250 (now)] TJ ET`);

  const x4 = 40 + inkOf('evroc ', body);
  const x5 = x4 + inkOf('partnership ', body);
  const x6 = x5 + inkOf('Sov', body);
  ops.push(`BT /F3 ${body} Tf 1 0 0 1 40 150 Tm (evroc) Tj /F1 ${body} Tf 1 0 0 1 ${x4.toFixed(3)} 150 Tm (partnership) Tj ET`);
  ops.push(`BT /F3 ${body} Tf 1 0 0 1 ${x5.toFixed(3)} 150 Tm (Sov) Tj ET BT /F1 ${body} Tf 1 0 0 1 ${x6.toFixed(3)} 150 Tm (ereignty) Tj ET`);

  // 0.08 em past the ink of "Enterprise": narrower than a word gap, but the
  // run showed the space glyph itself.
  const x7 = 40 + inkOf('Enterprise', body) + 0.08 * body;
  ops.push(`BT /F1 ${body} Tf 1 0 0 1 40 100 Tm (Enterprise ) Tj ET BT /F3 ${body} Tf 1 0 0 1 ${x7.toFixed(3)} 100 Tm (grade) Tj ET`);
  return ops.join('\n');
}

function officePdf(): Uint8Array {
  const widthsArray = `[${Array.from({ length: 91 }, (_, k) => widthOf(String.fromCharCode(32 + k))).join(' ')}]`;
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '/CMapName /Office-UCS def /CMapType 2 def',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    `${CID_CHARS.length} beginbfchar`,
    ...CID_CHARS.map((ch) => `<${cidOf(ch).toString(16).padStart(4, '0').toUpperCase()}> <${ch.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}>`),
    'endbfchar endcmap CMapName currentdict /CMap defineresource pop end end',
  ].join('\n');
  const cidWidths = `[${0x80} [${CID_CHARS.map(widthOf).join(' ')}]]`;
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 8 0 R >> >> /Contents 9 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 32 /LastChar 122 /Widths ${widthsArray} >>`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /Office-Regular /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>',
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Office-Regular /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 1000 /W ${cidWidths} >>`,
    stream('', cmap),
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /FirstChar 32 /LastChar 122 /Widths ${widthsArray} >>`,
    stream('', officeContent()),
  ]);
}

async function readOffice(): Promise<{ nodes: PdfNode[]; lines: string[] }> {
  const doc = await loadPdfDocument(officePdf());
  const page = interpretPdfDocPage(doc, 0);
  const text = extractPageText(page.nodes, { width: page.width, height: page.height });
  return { nodes: page.nodes, lines: text.blocks.map((b) => b.text) };
}

// ─── the office page, end to end through the reader ─────────────────────────

test('CIDs whose bytes fall in 0x80 to 0x9F survive the windows-1252 decode of the stream', async () => {
  const { nodes } = await readOffice();
  const words = nodes.filter((n) => n.kind === 'text' && n.y < 60).map((n) => n.text);
  assert.deepEqual(words, ['Why', 'Sovereignty', 'Can', 'No', 'Longer', 'Wait']);
});

test('words set as separate runs join with one space, and a kerning pair stays inside its word', async () => {
  const { lines } = await readOffice();
  assert.ok(lines.includes('Why Sovereignty Can No Longer Wait'), JSON.stringify(lines));
  assert.ok(lines.some((l) => l.includes('The Market Imperative now')), JSON.stringify(lines));
});

test('a style change is a word break only where there is a gap', async () => {
  const { lines } = await readOffice();
  assert.ok(lines.some((l) => l.includes('evroc partnership Sovereignty')), JSON.stringify(lines));
});

test('a run that showed its trailing space is followed by a break even when the next word is pulled in', async () => {
  const { nodes, lines } = await readOffice();
  const enterprise = nodes.find((n) => n.text === 'Enterprise');
  assert.ok(enterprise);
  assert.equal(enterprise.spaceAfter, true);
  assert.ok(enterprise.lineInk);
  const ink = enterprise.lineInk[0] ?? NaN;
  assert.ok(ink < enterprise.w, 'the ink ends before the pen, which counts the space');
  assert.ok(Math.abs(ink - inkOf('Enterprise', 16)) < 0.01);
  assert.ok(lines.some((l) => l.includes('Enterprise grade')), JSON.stringify(lines));
});

// ─── the rule itself, on content streams ─────────────────────────────────────

const page = (content: string, fonts: Record<string, PdfFontInfo>): PdfNode[] =>
  interpretPdfPage({ width: PAGE_W, height: PAGE_H, content, fonts });
const textOf = (nodes: PdfNode[]): string => extractPageText(nodes, { width: PAGE_W, height: PAGE_H }).text;

test('TJ: kerning never breaks a word, a word-sized negative offset does, and offsets add up', () => {
  const nodes = page('BT /F 20 Tf 1 0 0 1 40 200 Tm [(W) 80 (a) -40 (ve) -60 (s) -250 (break) -100 -100 (here)] TJ ET', { F: SIMPLE });
  assert.deepEqual(nodes.map((n) => n.text), ['Waves break here']);
});

test('a gap narrower than the threshold is kerning, one wider is a word break', () => {
  const size = 20;
  const near = 40 + inkOf('in', size) + (PDF_WORD_GAP_EM - 0.05) * size;
  const far = 40 + inkOf('in', size) + (PDF_WORD_GAP_EM + 0.05) * size;
  const glued = page(`BT /F 20 Tf 1 0 0 1 40 200 Tm (in) Tj ET BT /G 20 Tf 1 0 0 1 ${near} 200 Tm (to) Tj ET`, { F: SIMPLE, G: SIMPLE });
  const broken = page(`BT /F 20 Tf 1 0 0 1 40 200 Tm (in) Tj ET BT /G 20 Tf 1 0 0 1 ${far} 200 Tm (to) Tj ET`, { F: SIMPLE, G: SIMPLE });
  assert.equal(textOf(glued), 'into');
  assert.equal(textOf(broken), 'in to');
  // Inside one text object the threshold is the wider PDF_RUN_WORD_GAP_EM.
  const runNear = 40 + inkOf('in', size) + (PDF_RUN_WORD_GAP_EM - 0.02) * size;
  const runFar = 40 + inkOf('in', size) + (PDF_RUN_WORD_GAP_EM + 0.02) * size;
  assert.equal(page(`BT /F 20 Tf 1 0 0 1 40 200 Tm (in) Tj 1 0 0 1 ${runNear} 200 Tm (to) Tj ET`, { F: SIMPLE })[0]?.text, 'into');
  assert.equal(page(`BT /F 20 Tf 1 0 0 1 40 200 Tm (in) Tj 1 0 0 1 ${runFar} 200 Tm (to) Tj ET`, { F: SIMPLE })[0]?.text, 'in to');
});

test('letter spacing written as one TJ number or one Tm per glyph keeps the heading whole', () => {
  // -160 is 0.16 em of tracking after every glyph: ordinary for a heading.
  const tj = page('BT /F 20 Tf 1 0 0 1 40 200 Tm [(S) -160 (U) -160 (S) -160 (E) -160 ( ) -160 (L) -160 (i) -160 (n) -160 (u) -160 (x)] TJ ET', { F: SIMPLE });
  assert.deepEqual(tj.map((n) => n.text), ['SUSE Linux']);
  let x = 40;
  const moves: string[] = [];
  for (const ch of 'SUSE') {
    moves.push(`1 0 0 1 ${x.toFixed(3)} 200 Tm (${ch}) Tj`);
    x += inkOf(ch, 20) + 0.16 * 20;
  }
  assert.deepEqual(page(`BT /F 20 Tf ${moves.join(' ')} ET`, { F: SIMPLE }).map((n) => n.text), ['SUSE']);
});

test('a word gap written as a trailing TJ number survives the Tm that places the next word', () => {
  const pen = 40 + inkOf('foo', 20);
  // The Tm sets the pen where the TJ left it: the whole gap is the TJ's.
  const exact = page(`BT /F 20 Tf 1 0 0 1 40 200 Tm [(foo) -300] TJ 1 0 0 1 ${pen + 6} 200 Tm (bar) Tj ET`, { F: SIMPLE });
  assert.deepEqual(exact.map((n) => n.text), ['foo bar']);
  // A smaller TJ gap and a small move past it add up to a word gap.
  const split = page(`BT /F 20 Tf 1 0 0 1 40 200 Tm [(foo) -150] TJ 1 0 0 1 ${pen + 3 + 1} 200 Tm (bar) Tj ET`, { F: SIMPLE });
  assert.deepEqual(split.map((n) => n.text), ['foo bar']);
});

test('a TJ gap is scaled by the horizontal scale, as the pen is', () => {
  // At 50 Tz, -250 moves the pen 0.125 em: kerning, not a word space.
  assert.deepEqual(page('BT /F 20 Tf 50 Tz 1 0 0 1 40 200 Tm [(Wo) -250 (rd)] TJ ET', { F: SIMPLE }).map((n) => n.text), ['Word']);
  assert.deepEqual(page('BT /F 20 Tf 50 Tz 1 0 0 1 40 200 Tm [(Wo) -500 (rd)] TJ ET', { F: SIMPLE }).map((n) => n.text), ['Wo rd']);
});

test('a font with no widths is never measured, so a word split mid-way stays whole', () => {
  // An unembedded standard font written without /Widths (jsPDF does this): the
  // pen falls back to 0.55 em a glyph, and "Ha" is really 1.278 em, not 1.1.
  const widthless: PdfFontInfo = { family: 'Helvetica' };
  const x = 40 + inkOf('Ha', 20);
  const nodes = page(`BT /F 20 Tf 1 0 0 1 40 200 Tm (Ha) Tj ET BT /G 20 Tf 1 0 0 1 ${x} 200 Tm (ppy) Tj ET`, { F: widthless, G: widthless });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0]?.lineInk, undefined, 'a guessed edge is not recorded as ink');
  assert.equal(textOf(nodes), 'Happy');
  assert.deepEqual(page(`BT /F 20 Tf 1 0 0 1 40 200 Tm (Ha) Tj 1 0 0 1 ${x} 200 Tm (ppy) Tj ET`, { F: widthless }).map((n) => n.text), ['Happy']);
});

test('the ink of a second line counts from the node origin, not from where the line starts', () => {
  const size = 20;
  // First-line indent: line 1 at x 60, line 2 at x 40, then a bold word a word gap on.
  const indented = page(`BT /F ${size} Tf 1 0 0 1 60 200 Tm (first) Tj 1 0 0 1 40 176 Tm (second) Tj ET`
    + ` BT /G ${size} Tf 1 0 0 1 ${40 + inkOf('second', size) + 0.25 * size} 176 Tm (bold) Tj ET`, { F: SIMPLE, G: SIMPLE });
  assert.equal(indented[0]?.text, 'first\nsecond');
  const ink = indented[0]?.lineInk ?? [];
  assert.ok(Math.abs((ink[1] ?? NaN) - (inkOf('second', size) - 20)) < 0.01, JSON.stringify(ink));
  assert.match(textOf(indented), /second bold/);
  // A hanging line: line 2 at x 70, and the rest of its word touching it.
  const hanging = page(`BT /F ${size} Tf 1 0 0 1 60 200 Tm (first) Tj 1 0 0 1 70 176 Tm (sec) Tj ET`
    + ` BT /G ${size} Tf 1 0 0 1 ${70 + inkOf('sec', size)} 176 Tm (ond) Tj ET`, { F: SIMPLE, G: SIMPLE });
  assert.match(textOf(hanging), /second/);
});

test('letter-spaced type split by a style change stays one word', () => {
  // 4 Tc at 20 pt is 0.2 em of tracking: past the word gap on its own, but it is
  // the spacing between every letter, so it is taken off the gap.
  const x = 40 + inkOf('SU', 20) + 4;
  const nodes = page(`BT /F 20 Tf 4 Tc 1 0 0 1 40 200 Tm (SU) Tj ET BT /G 20 Tf 4 Tc 1 0 0 1 ${x} 200 Tm (SE) Tj ET`, { F: SIMPLE, G: SIMPLE });
  assert.equal(nodes.length, 2);
  assert.equal(textOf(nodes), 'SUSE');
});

test('no space goes between characters of a script written without them, unless the gap is wide', () => {
  const han = ['日', '本', '語', '文', '字'];
  const cjk: PdfFontInfo = {
    twoByte: true,
    defaultWidth: 1000,
    widths: { 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 },
    decode: (codes) => {
      let out = '';
      for (let k = 0; k + 1 < codes.length; k += 2) out += han[((codes[k]! << 8) | codes[k + 1]!) - 1] ?? '';
      return out;
    },
  };
  // A justification offset of 0.3 em inside one text object.
  assert.equal(page('BT /C 20 Tf 1 0 0 1 40 200 Tm [<000100020003> -300 <00040005>] TJ ET', { C: cjk })[0]!.text, han.join(''));
  // Two text objects 0.3 em apart, and two 1.5 em apart (a label and its value).
  const tight = page('BT /C 20 Tf 1 0 0 1 40 200 Tm <000100020003> Tj ET BT /D 20 Tf 1 0 0 1 106 200 Tm <00040005> Tj ET', { C: cjk, D: cjk });
  const wide = page('BT /C 20 Tf 1 0 0 1 40 200 Tm <000100020003> Tj ET BT /D 20 Tf 1 0 0 1 130 200 Tm <00040005> Tj ET', { C: cjk, D: cjk });
  assert.equal(textOf(tight), han.join(''));
  assert.equal(textOf(wide), `${han.slice(0, 3).join('')} ${han.slice(3).join('')}`);
});

test('next to Chinese or Japanese a space-wide gap still breaks, and Thai keeps its phrase spaces', () => {
  const chars = ['a', 'b', 'c', '日', '本'];
  const mixed: PdfFontInfo = {
    twoByte: true,
    defaultWidth: 500,
    decode: (codes) => {
      let out = '';
      for (let k = 0; k + 1 < codes.length; k += 2) out += chars[((codes[k] ?? 0) << 8 | (codes[k + 1] ?? 0)) - 1] ?? '';
      return out;
    },
  };
  assert.equal(page('BT /M 20 Tf 1 0 0 1 40 200 Tm [<000100020003> -300 <0004>] TJ ET', { M: mixed })[0]?.text, 'abc 日');
  assert.equal(page('BT /M 20 Tf 1 0 0 1 40 200 Tm [<000100020003> -100 <0004>] TJ ET', { M: mixed })[0]?.text, 'abc日');

  const thai = ['สวัสดี', 'ครับ'];
  const phrases: PdfFontInfo = {
    twoByte: true,
    defaultWidth: 500,
    decode: (codes) => {
      let out = '';
      for (let k = 0; k + 1 < codes.length; k += 2) out += thai[((codes[k] ?? 0) << 8 | (codes[k + 1] ?? 0)) - 1] ?? '';
      return out;
    },
  };
  // One code a phrase, 0.5 em wide, so the ink of the first run ends 10 pt on.
  const apart = (em: number): string =>
    `BT /T 20 Tf 1 0 0 1 40 200 Tm <0001> Tj ET BT /U 20 Tf 1 0 0 1 ${50 + em * 20} 200 Tm <0002> Tj ET`;
  assert.equal(textOf(page(apart(0.3), { T: phrases, U: phrases })), 'สวัสดี ครับ');
  assert.equal(textOf(page(apart(0.1), { T: phrases, U: phrases })), 'สวัสดีครับ');
  assert.equal(page('BT /T 20 Tf 1 0 0 1 40 200 Tm [<0001> -300 <0002>] TJ ET', { T: phrases })[0]?.text, 'สวัสดี ครับ');
  assert.equal(pdfWordBreak('ครับ', 'ครับ', PDF_MIXED_GAP_EM - 0.01), false);
  // Halfwidth Hangul and full-width Latin letters are not treated as unspaced.
  assert.equal(pdfWordBreak('\uffa1', '\uffa1', PDF_WORD_GAP_EM + 0.01), true);
  assert.equal(pdfWordBreak('\uff21', '\uff22', PDF_WORD_GAP_EM + 0.01), true);
  assert.equal(pdfWordBreak('日', '本', 0.5), false);
  assert.equal(pdfWordBreak('\u30ab\u30fc', '\u30c9', 0.5), false, 'the prolonged sound mark is kana');
});

// ─── measured edges in the column path ──────────────────────────────────────

/** One text object per column: `lines` stacked 14 pt apart from (x, top). */
const column = (font: string, size: number, x: number, top: number, lines: string[]): string =>
  `BT /${font} ${size} Tf 1 0 0 1 ${x} ${top} Tm ${lines.map((l, k) => `${k ? `1 0 0 1 ${x} ${top - k * 14} Tm ` : ''}(${l}) Tj`).join(' ')} ET`;
const withoutInk = (nodes: PdfNode[]): PdfNode[] => nodes.map(({ lineInk: _ink, ...rest }) => rest);

test('two columns of prose are found on their measured edges, where the estimate crosses the gutter', () => {
  const left = ['little lists still fill it', 'lilt it till it is still', 'fill little tilted lists', 'it is still a little list', 'tilt it till it fills'];
  const right = ['right column text runs on', 'and on across the page', 'with more words to read', 'in a second measure', 'that ends the page'];
  const x2 = 160;
  // The premise: every left line's ink ends a clear gutter short of the right
  // column, and its 0.55 em estimate runs into that gutter.
  for (const l of left) {
    assert.ok(40 + inkOf(l, 10) < x2 - 18 * 1.2, l);
    assert.ok(40 + l.length * 10 * 0.55 > x2 - 18, l);
  }
  const nodes = page(`${column('F', 10, 40, 250, left)} ${column('F', 10, x2, 250, right)}`, { F: SIMPLE });
  assert.ok(nodes.every((n) => n.lineInk && n.lineInk.length === 5));
  const read = extractPageText(nodes, { width: PAGE_W, height: PAGE_H });
  assert.equal(read.columns, 2);
  assert.deepEqual(read.blocks.map((b) => b.column), [0, 1]);
  assert.ok(read.blocks[0]?.text.startsWith('little lists still fill it lilt'), JSON.stringify(read.blocks));
  // The same page without the measurement reads as one column, which is the change this pins.
  assert.equal(extractPageText(withoutInk(nodes), { width: PAGE_W, height: PAGE_H }).columns, 1);
});

test('a table with measured cells stays one column and reads row by row', () => {
  const rows = [['Item', 'Qty', 'Price'], ['Widget', '4', '12.00'], ['Gadget', '10', '3.50'], ['Doohickey', '1', '99.00'], ['Sprocket', '25', '0.40']];
  const content = rows.map((r, k) => r.map((cell, c) => `BT /F 10 Tf 1 0 0 1 ${40 + c * 160} ${250 - k * 14} Tm (${cell}) Tj ET`).join(' ')).join(' ');
  const nodes = page(content, { F: SIMPLE });
  assert.ok(nodes.every((n) => n.lineInk));
  const read = extractPageText(nodes, { width: PAGE_W, height: PAGE_H });
  assert.equal(read.columns, 1);
  assert.match(read.text, /Item Qty Price Widget 4 12\.00 Gadget 10 3\.50/);
});

test('two columns of Chinese are found on edges measured at a full em a glyph', () => {
  const han = ['日', '本', '語', '文', '字'];
  const cjk: PdfFontInfo = {
    twoByte: true,
    defaultWidth: 1000,
    decode: (codes) => {
      let out = '';
      for (let k = 0; k + 1 < codes.length; k += 2) out += han[(((codes[k] ?? 0) << 8) | (codes[k + 1] ?? 0)) - 1] ?? '';
      return out;
    },
  };
  // Ten glyphs a line, 100 pt of ink at 10 pt: the estimate says 55.
  const line = (k: number): string => `<${Array.from({ length: 10 }, (_, j) => `000${((j + k) % 5) + 1}`).join('')}>`;
  const col = (x: number): string =>
    `BT /C 10 Tf 1 0 0 1 ${x} 250 Tm ${Array.from({ length: 5 }, (_, k) => `${k ? `1 0 0 1 ${x} ${250 - k * 14} Tm ` : ''}${line(k)} Tj`).join(' ')} ET`;
  const nodes = page(`${col(40)} ${col(170)}`, { C: cjk });
  const ink = nodes[0]?.lineInk ?? [];
  assert.ok(Math.abs((ink[0] ?? NaN) - 100) < 0.01, JSON.stringify(ink));
  const read = extractPageText(nodes, { width: PAGE_W, height: PAGE_H });
  assert.equal(read.columns, 2);
  assert.deepEqual(read.blocks.map((b) => b.column), [0, 1]);
  assert.ok(read.blocks[0]?.text.startsWith('日本語文字日本語文字'), JSON.stringify(read.blocks));
});

test('pdfWordBreak: an existing space, a negative gap and the threshold', () => {
  assert.equal(pdfWordBreak('The ', 'Market', 1), false);
  assert.equal(pdfWordBreak('The', ' Market', 1), false);
  assert.equal(pdfWordBreak('The', 'Market', -0.1), false);
  assert.equal(pdfWordBreak('The', 'Market', PDF_WORD_GAP_EM + 0.01), true);
  assert.equal(pdfWordBreak('The', 'Market', 0.19, 0.2), false);
  assert.equal(pdfWordBreak('', 'Market', 1), false);
});

// ─── the private corpus ──────────────────────────────────────────────────────

/** Lines the private corpus is known to hold, by file: each once read with a space lost or a letter dropped. */
const KNOWN_LINES: Record<string, string[]> = {
  'evroc partnership enablement.pdf': [
    'evroc partnership enablement',
    'Internal Use only',
    'Why Sovereignty Can No Longer Wait',
    'The Market Imperative:',
    'A Partnership Built on European Values and Vision',
  ],
  'SUSE Self Assessment Explainer.pdf': [
    'Thank you',
    'The tool is designed to be a 20-minute engagement that gives a clear scoring and gap analysis.',
  ],
};

test('no page of a private PDF reads with words run together', { skip: skipReason() ?? false }, async () => {
  const corpus = privateCorpus();
  assert.ok(corpus);
  const pdfs = [...corpus.files, ...corpus.slidesToTest].filter((f) => f.toLowerCase().endsWith('.pdf'));
  assert.ok(pdfs.length > 0, 'the private corpus holds no PDF');
  for (const file of pdfs) {
    const name = path.basename(file);
    const doc = await loadPdfDocument(new Uint8Array(readFileSync(file)));
    let whole = '';
    for (let k = 0; k < doc.getPageCount(); k++) {
      const read = interpretPdfDocPage(doc, k);
      const { text, blocks } = extractPageText(read.nodes, { width: read.width, height: read.height });
      whole += `${text}\n`;
      // No English word runs past 20 letters; a longer run of letters is words
      // joined without their spaces.
      const glued = text.match(/\p{L}{21,}/gu) ?? [];
      assert.deepEqual(glued, [], `${name} page ${k + 1}`);
      // A block whose average word is longer than 14 letters has lost its
      // spaces, even when no single run is long. Web addresses are left out.
      for (const block of blocks) {
        const words = block.text.split(/\s+/).filter((w) => w && !/[/@]|\.\p{L}/u.test(w));
        const letters = words.join('').match(/\p{L}/gu)?.length ?? 0;
        if (letters >= 30) assert.ok(letters / words.length <= 14, `${name} page ${k + 1}: ${block.text.slice(0, 80)}`);
      }
    }
    for (const line of KNOWN_LINES[name] ?? []) assert.ok(whole.includes(line), `${name}: ${JSON.stringify(line)}`);
  }
});
