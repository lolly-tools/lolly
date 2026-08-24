// SPDX-License-Identifier: MPL-2.0
/**
 * Barcode (community/barcode) - encoding contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine with the shared base host, so this guards the shipped
 * encoders rather than a fixture.
 *
 * What is pinned here:
 *  - EAN-13 4006381333931, UPC-A 036000291452 and EAN-8 96385074 against the
 *    published L / G / R patterns, rebuilt in this file from the standard's own
 *    tables so a typo in the tool's copy cannot agree with a typo here;
 *  - Code 128 "RI476394652CH" and an all-digit value, as the exact symbol
 *    sequence AND the module string, with the modulo-103 check recomputed here;
 *  - the 107-symbol width table's self-checking properties (eleven modules,
 *    three bars, an even bar sum);
 *  - check-digit validation, the "did you mean" hint, and automatic symbology;
 *  - every example, template and preset seed hydrates with no hook error.
 *
 * Run with: node --test tests/barcode.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// barcode ships in the PUBLIC community pack. Load from the SOURCE pack, not
// the gitignored tools/ profile view, so the suite is profile-independent: skip
// only when community/ is not checked out (a clone without submodules); with it
// present, a missing tool dir means a rename or delete and must fail loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'barcode');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')),
    'community/barcode/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('barcode', fetchFile);

async function mount(values: Record<string, any> = {}) {
  const rt = await createRuntime(tool, baseHost(), values);
  return {
    rt,
    html: rt.getHydrated() as string,
    // Extras are read raw: a module string must not be entity-escaped.
    read: (name: string) => rt.getHydratedText(`{{${name}}}`),
  };
}

// ─── Reference encoders, written from the published tables ───────────────────
// Independent of the tool's own copy: these are transcribed straight from the
// EAN/UPC and Code 128 standards, so agreement between the two is evidence and
// not a shared typo.

const REF_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const REF_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];
const REF_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const REF_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

function refEan13(v: string): string {
  const parity = REF_PARITY[Number(v[0])] as string;
  let out = '101';
  for (let i = 0; i < 6; i++) {
    const d = Number(v[1 + i]);
    out += parity[i] === 'L' ? REF_L[d] : REF_G[d];
  }
  out += '01010';
  for (let i = 7; i < 13; i++) out += REF_R[Number(v[i])];
  return out + '101';
}

function refEan8(v: string): string {
  let out = '101';
  for (let i = 0; i < 4; i++) out += REF_L[Number(v[i])];
  out += '01010';
  for (let i = 4; i < 8; i++) out += REF_R[Number(v[i])];
  return out + '101';
}

// The check digit as the standard states it: weight 3 on the rightmost body
// digit, alternating leftwards.
function refCheck(body: string): number {
  let sum = 0;
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w;
  return (10 - (sum % 10)) % 10;
}

// The tool's Code 128 table, read out of the shipped source. The test does not
// re-transcribe 107 rows; it verifies the table's own invariants instead, then
// pins the symbol sequences the encoder chooses.
function toolC128Table(): string[] {
  const src = readFileSync(join(PKG, 'hooks.js'), 'utf8');
  const block = /var C128 = \[([\s\S]*?)\];/.exec(src);
  assert.ok(block, 'the Code 128 width table was not found in hooks.js');
  const rows = ((block[1] ?? '').match(/'(\d+)'/g) ?? []).map(s => s.slice(1, -1));
  return rows;
}

function widthsToModules(widths: string | undefined): string {
  let out = '';
  let dark = true;
  for (const ch of widths ?? '') {
    out += (dark ? '1' : '0').repeat(Number(ch));
    dark = !dark;
  }
  return out;
}

// ─── EAN / UPC ───────────────────────────────────────────────────────────────

test('EAN-13 4006381333931 matches the published pattern tables', { skip: SKIP }, async () => {
  const { read } = await mount({ value: '4006381333931', symbology: 'ean13' });
  const modules = read('bcModules');

  assert.equal(read('bcSymbology'), 'ean13');
  assert.equal(read('bcValue'), '4006381333931');
  assert.equal(modules.length, 95, 'an EAN-13 symbol is 95 modules');
  assert.equal(modules, refEan13('4006381333931'));
  // The guards, spelled out: they are what the descender geometry hangs off.
  assert.equal(modules.slice(0, 3), '101');
  assert.equal(modules.slice(45, 50), '01010');
  assert.equal(modules.slice(92), '101');
  assert.equal(read('bcCheck'), '1');
});

test('UPC-A 036000291452 encodes as the EAN-13 with a leading zero', { skip: SKIP }, async () => {
  const { read } = await mount({ value: '036000291452', symbology: 'upca' });
  assert.equal(read('bcModules'), refEan13('0036000291452'));
  assert.equal(read('bcValue'), '036000291452');
  assert.equal(read('bcCheck'), '2');
  assert.equal(refCheck('03600029145'), 2);
});

test('EAN-8 96385074 matches the published pattern tables', { skip: SKIP }, async () => {
  const { read } = await mount({ value: '96385074', symbology: 'ean8' });
  const modules = read('bcModules');
  assert.equal(modules.length, 67, 'an EAN-8 symbol is 67 modules');
  assert.equal(modules, refEan8('96385074'));
  assert.equal(read('bcCheck'), '4');
});

test('a body one digit short gets its check digit worked out', { skip: SKIP }, async () => {
  for (const [value, symbology, full] of [
    ['400638133393', 'ean13', '4006381333931'],
    ['9638507', 'ean8', '96385074'],
    ['03600029145', 'upca', '036000291452'],
  ] as const) {
    const { read } = await mount({ value, symbology });
    assert.equal(read('bcError'), '', `${symbology} ${value} was refused`);
    assert.equal(read('bcValue'), full);
  }
});

test('spaces and hyphens in a typed-out number are ignored', { skip: SKIP }, async () => {
  const { read } = await mount({ value: '4 006381-333931', symbology: 'ean13' });
  assert.equal(read('bcError'), '');
  assert.equal(read('bcModules'), refEan13('4006381333931'));
});

// ─── Validation and the hint ─────────────────────────────────────────────────

test('a wrong check digit is refused with the number that would have worked', { skip: SKIP }, async () => {
  const { read, html } = await mount({ value: '4006381333932', symbology: 'ean13' });
  assert.match(read('bcError'), /check digit/i);
  assert.equal(read('bcHint'), 'Did you mean 4006381333931?');
  assert.equal(read('bcModules'), '', 'nothing may be encoded from a bad number');
  // The panel is on the canvas, not only in an extra.
  assert.match(html, /Barcode unavailable/);
  assert.match(html, /Did you mean 4006381333931\?/);
  assert.equal(read('bcSummary'), 'nothing yet', 'the accessible label must still say something');
});

test('a wrong length is refused, and says the length it needs', { skip: SKIP }, async () => {
  const { read } = await mount({ value: '12345', symbology: 'ean13' });
  assert.match(read('bcError'), /EAN-13 needs 13 digits/);
  assert.equal(read('bcHint'), '', 'the check digit is not the fault here');
});

test('non-digits in a retail code point at Code 128 instead', { skip: SKIP }, async () => {
  const { read } = await mount({ value: 'ABC0381333931', symbology: 'ean13' });
  assert.match(read('bcError'), /digits only/);
  assert.match(read('bcError'), /Code 128/);
});

test('a character Code 128 cannot hold is named, with its position', { skip: SKIP }, async () => {
  const { read } = await mount({ value: 'CAFÉ-01', symbology: 'code128' });
  assert.match(read('bcError'), /Code 128 cannot hold "É" \(character 4\)/);
  assert.equal(read('bcModules'), '');
});

test('an empty value asks for one rather than blanking the canvas', { skip: SKIP }, async () => {
  const { read, html } = await mount({ value: '' });
  assert.match(read('bcError'), /Type the text/);
  assert.match(html, /Barcode unavailable/);
});

// Every way the tool can refuse a value, so the panel geometry below is measured
// against the real message set and not one hand-picked sentence.
const REFUSALS: Array<Record<string, unknown>> = [
  { value: '', symbology: 'code128' },
  { value: '', symbology: 'ean13' },
  { value: 'ABC0381333931', symbology: 'ean13' },
  { value: '12345', symbology: 'ean13' },
  { value: '123456', symbology: 'ean8' },
  { value: '4006381333932', symbology: 'ean13' },
  { value: '036000291453', symbology: 'upca' },
  { value: 'CAFÉ-01', symbology: 'code128' },
];

// An inline <svg> clips whatever runs past its viewBox, so a message wider than
// the panel loses its own beginning and end. The panel sets its note at 17 in a
// sans-serif face, which averages about half the size per character.
test('no refusal message is wider than the panel it is drawn in', { skip: SKIP }, async () => {
  for (const values of REFUSALS) {
    const { read, html } = await mount(values);
    assert.notEqual(read('bcError'), '', `${JSON.stringify(values)} was accepted`);

    const box = String((/viewBox="([^"]+)"/.exec(html) ?? [])[1]).split(' ').map(Number);
    const [, , panelW = 0, panelH = 0] = box;
    const lines = [...html.matchAll(/<text[^>]*y="(\d+)"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)]
      // Entities are one glyph on the page, so measure the decoded text.
      .map(m => ({
        y: Number(m[1]),
        size: Number(m[2]),
        str: String(m[3]).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
      }));
    assert.ok(lines.length >= 2, `${read('bcError')}: the panel drew no message`);

    for (const line of lines) {
      const wide = 0.5 * line.size * line.str.length;
      assert.ok(wide <= panelW - 60,
        `"${line.str}" is about ${Math.round(wide)} wide in a ${panelW} panel: it would be clipped`);
      assert.ok(line.y + line.size <= panelH, `"${line.str}" sits below the panel floor`);
    }
  }
});

// "The last digit of a EAN-13" read wrong; the name goes into the sentence, so
// the sentence carries no article.
test('no refusal message puts an article in front of a symbology name', { skip: SKIP }, async () => {
  for (const values of REFUSALS) {
    const { read } = await mount(values);
    assert.doesNotMatch(read('bcError'), /\ba (EAN|UPC|Code)\b/,
      `${read('bcError')} needs "an", or no article at all`);
  }
});

// Outer whitespace is not payload. A space is a real Code 128 character, and an
// encoded one is invisible in the printed line under the bars, so a pasted cell
// would scan back with a character nobody can see.
test('Code 128 does not encode whitespace around the value', { skip: SKIP }, async () => {
  const plain = await mount({ value: 'AB12', symbology: 'code128' });
  for (const padded of [' AB12', 'AB12 ', '  AB12\n', '\tAB12\r\n']) {
    const { read } = await mount({ value: padded, symbology: 'code128' });
    assert.equal(read('bcError'), '', `${JSON.stringify(padded)} was refused`);
    assert.equal(read('bcSymbols'), plain.read('bcSymbols'), `${JSON.stringify(padded)} encoded its padding`);
  }
  // Whitespace alone is not a value, however wide it is.
  const blank = await mount({ value: '   ' });
  assert.match(blank.read('bcError'), /Type the text/);
  assert.equal(blank.read('bcModules'), '');
});

// ─── Automatic symbology ─────────────────────────────────────────────────────

test('automatic picks the symbology from the shape of the value', { skip: SKIP }, async () => {
  for (const [value, want] of [
    ['4006381333931', 'ean13'],
    ['036000291452', 'upca'],
    ['96385074', 'ean8'],
    ['LOLLY-ASSET-00417', 'code128'],
    ['12345678901234', 'code128'],
    ['1234567', 'code128'],
  ] as const) {
    const { read } = await mount({ value, symbology: 'auto' });
    assert.equal(read('bcSymbology'), want, `automatic misread ${value}`);
    assert.equal(read('bcError'), '', `automatic produced an error for ${value}`);
  }
});

// ─── Code 128 ────────────────────────────────────────────────────────────────

test('the Code 128 width table holds its own self-checking properties', { skip: SKIP }, () => {
  const table = toolC128Table();
  assert.equal(table.length, 107, 'Code 128 has 107 symbols');
  table.forEach((widths, i) => {
    const total = [...widths].reduce((n, c) => n + Number(c), 0);
    const bars = [...widths].filter((_, k) => k % 2 === 0).map(Number);
    if (i === 106) {
      assert.equal(widths.length, 7, 'the stop pattern has seven elements');
      assert.equal(total, 13, 'the stop pattern is 13 modules');
    } else {
      assert.equal(widths.length, 6, `symbol ${i} must have six elements`);
      assert.equal(total, 11, `symbol ${i} must be 11 modules`);
      assert.equal(bars.length, 3, `symbol ${i} must have three bars`);
    }
    // The symbology's own parity rule: every symbol's bar widths sum even.
    assert.equal(bars.reduce((a, b) => a + b, 0) % 2, 0, `symbol ${i} breaks the even-bar rule`);
  });
  // The four symbols the encoder addresses by name, against their published bit
  // patterns.
  assert.equal(widthsToModules(table[99]), '10111011110', 'CODE C');
  assert.equal(widthsToModules(table[100]), '10111101110', 'CODE B');
  assert.equal(widthsToModules(table[104]), '11010010000', 'START B');
  assert.equal(widthsToModules(table[105]), '11010011100', 'START C');
  assert.equal(widthsToModules(table[106]), '1100011101011', 'STOP');
});

// The modulo-103 check, recomputed here from the symbol sequence.
function refC128Check(values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += (values[i] as number) * (i === 0 ? 1 : i);
  return sum % 103;
}

test('Code 128 RI476394652CH takes code set C for the digit block', { skip: SKIP }, async () => {
  const { read } = await mount({ value: 'RI476394652CH', symbology: 'code128' });
  // START B, R, I, CODE C, 47 63 94 65, CODE B, 2, C, H, check, STOP.
  assert.equal(read('bcSymbols'), '104,50,41,99,47,63,94,65,100,18,35,40,99,106');

  const symbols = read('bcSymbols').split(',').map(Number);
  const data = symbols.slice(0, -2);
  assert.equal(refC128Check(data), 99, 'the modulo-103 check does not agree');
  assert.equal(read('bcCheck'), '99');

  const table = toolC128Table();
  assert.equal(read('bcModules'), symbols.map(v => widthsToModules(table[v])).join(''));
  assert.equal(read('bcModules').length, 11 * 13 + 13, '13 symbols of 11 modules plus the 13-module stop');
  assert.ok(read('bcModules').endsWith('11'), 'a Code 128 symbol ends on the stop pattern\'s two-module bar');
});

test('an all-digit value starts in code set C, two digits to a symbol', { skip: SKIP }, async () => {
  const { read } = await mount({ value: '12345678', symbology: 'code128' });
  assert.equal(read('bcSymbols'), '105,12,34,56,78,47,106');
  assert.equal(refC128Check([105, 12, 34, 56, 78]), 47);
  assert.equal(read('bcModules').length, 11 * 6 + 13);
});

test('a digit run shorter than four stays in code set B', { skip: SKIP }, async () => {
  const { read } = await mount({ value: 'A12B', symbology: 'code128' });
  // START B, A, 1, 2, B, check, STOP - no code-set switch to pay for.
  assert.equal(read('bcSymbols'), '104,33,17,18,34,' + refC128Check([104, 33, 17, 18, 34]) + ',106');
});

test('an odd digit run pairs off from its start and drops back for the leftover', { skip: SKIP }, async () => {
  const { read } = await mount({ value: 'A12345B', symbology: 'code128' });
  // START B, A, CODE C, 12, 34, CODE B, 5, B: the odd digit is the one left in B.
  const data = [104, 33, 99, 12, 34, 100, 21, 34];
  assert.equal(read('bcSymbols'), data.concat([refC128Check(data), 106]).join(','));
});

// ─── The rendered sheet ──────────────────────────────────────────────────────

test('the sheet is one SVG of crisp rects, and every bar carries the ink colour', { skip: SKIP }, async () => {
  const { html } = await mount({ value: '4006381333931', symbology: 'ean13', color: '#1a1a2e', background: '#faf7f2' });

  assert.match(html, /shape-rendering="crispEdges"/);
  assert.match(html, /fill="#1a1a2e"/);
  assert.match(html, /fill="#faf7f2"/);
  assert.ok(!/<image|<script/i.test(html), 'the symbol must be pure vector');
  // 30 dark runs: 3 guards of two bars each, plus two bars per digit.
  assert.equal((html.match(/<rect /g) ?? []).length, 1 + 30, 'one background rect plus one rect per dark run');
  // The printed digits, including the one that sits outside the guards.
  assert.equal((html.match(/<text /g) ?? []).length, 13);
});

test('turning the number off drops the text and the guard descenders', { skip: SKIP }, async () => {
  const withText = (await mount({ value: '4006381333931', barHeight: 100, moduleWidth: 2 })).html;
  const without = (await mount({ value: '4006381333931', barHeight: 100, moduleWidth: 2, showText: false })).html;

  assert.ok(!without.includes('<text '), 'no digits when the number is off');
  const tall = (s: string) => Math.max(...[...s.matchAll(/height="([\d.]+)"/g)].map(m => Number(m[1])));
  assert.ok(tall(withText) > tall(without), 'the guards must stop descending with the digits gone');
});

test('a bad colour value cannot reach the SVG', { skip: SKIP }, async () => {
  const { html } = await mount({ value: '96385074', color: '#fff" onload="x', background: 'red; }' });
  assert.ok(!html.includes('onload'), 'a colour value must never carry markup into an attribute');
  assert.match(html, /fill="#111111"/, 'the ink falls back to the literal default');
  assert.match(html, /fill="#ffffff"/, 'the background falls back to the literal default');
});

test('the quiet zone widens the field without moving the bars', { skip: SKIP }, async () => {
  const viewBox = (html: string) => String((/viewBox="([^"]+)"/.exec(html) ?? [])[1]).split(' ').map(Number);
  const narrow = viewBox((await mount({ value: '96385074', quiet: 0, moduleWidth: 3, showText: false })).html);
  const wide = viewBox((await mount({ value: '96385074', quiet: 10, moduleWidth: 3, showText: false })).html);

  assert.equal(narrow[0], 0, 'with no quiet zone the field starts at the first module');
  assert.equal(narrow[2], 67 * 3, 'the symbol is 67 modules wide');
  assert.equal(wide[0], -30);
  assert.equal(wide[2], (67 + 20) * 3);
  // The bar geometry itself is untouched: the same first bar in both.
  const firstBar = (html: string) => (/<rect x="([-\d.]+)" y/.exec(html.slice(html.indexOf('crispEdges'))) ?? [])[1];
  assert.equal(firstBar((await mount({ value: '96385074', quiet: 0, moduleWidth: 3, showText: false })).html), '0');
  assert.equal(firstBar((await mount({ value: '96385074', quiet: 10, moduleWidth: 3, showText: false })).html), '0');
});

// ISO/IEC 15420 and 15417 state a minimum quiet zone per symbology: 11 modules
// on an EAN-13's left, 10 either side of a Code 128, 9 for UPC-A, 7 for EAN-8.
// A symmetric 11 clears all four, and a default under it prints a symbol a
// conforming verifier grades down.
test('the default quiet zone meets the widest published minimum', { skip: SKIP }, async () => {
  const declared = (tool.manifest.inputs as Array<{ id: string; default?: unknown }>)
    .find(i => i.id === 'quiet');
  assert.equal(declared?.default, 11, 'the declared default is the one a first-time user prints');

  for (const values of [
    { value: '4006381333931' },
    { value: '036000291452', symbology: 'upca' },
    { value: '96385074', symbology: 'ean8' },
    { value: 'LOLLY-ASSET-00417', symbology: 'code128' },
    JSON.parse(readFileSync(join(PKG, 'templates', 'retail.json'), 'utf8')).values,
  ] as Array<Record<string, unknown>>) {
    const { read, html } = await mount(values);
    const mw = Number(values.moduleWidth ?? 3);
    const [x0 = 0, , w = 0] = String((/viewBox="([^"]+)"/.exec(html) ?? [])[1]).split(' ').map(Number);
    const symbol = read('bcModules').length;
    assert.ok(symbol > 0, `${JSON.stringify(values)} encoded nothing`);
    assert.ok(-x0 / mw >= 11, `${JSON.stringify(values)} leaves only ${-x0 / mw} modules clear on the left`);
    assert.ok((x0 + w) / mw - symbol >= 11,
      `${JSON.stringify(values)} leaves only ${(x0 + w) / mw - symbol} modules clear on the right`);
  }
});

test('out-of-range geometry from a URL is clamped, never NaN', { skip: SKIP }, async () => {
  const { html } = await mount({ value: '96385074', moduleWidth: 'wide' as unknown as number, barHeight: -50, quiet: 999 });
  assert.ok(!html.includes('NaN'), 'a non-numeric slider value must not reach the SVG');
  assert.match(html, /viewBox="-?[\d.]+ 0 [\d.]+ [\d.]+"/);
});

// ─── Seeds ───────────────────────────────────────────────────────────────────

function seeds(): Array<{ label: string; values: Record<string, unknown> }> {
  const out: Array<{ label: string; values: Record<string, unknown> }> = [];
  for (const ex of (tool.manifest.examples ?? []) as Array<{ label: string; values: Record<string, unknown> }>) {
    out.push({ label: `example ${ex.label}`, values: ex.values });
  }
  const dir = join(PKG, 'templates');
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    assert.equal(t.id, file.replace(/\.json$/, ''), 'a template id must be its filename');
    out.push({ label: `template ${t.id}`, values: t.values });
    for (const p of t.presets ?? []) {
      out.push({ label: `template ${t.id} preset ${p.id}`, values: { ...t.values, ...p.values } });
    }
  }
  return out;
}

test('every example, template and preset seed encodes with no hook error', { skip: SKIP }, async () => {
  const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));
  const list = seeds();
  assert.ok(list.length >= 4 + 2 + 6, 'the seed sweep found nothing to check');

  for (const { label, values } of list) {
    for (const key of Object.keys(values)) {
      assert.ok(ids.has(key), `${label} seeds "${key}", which is not an input`);
    }
    const { read, html } = await mount(values);
    assert.equal(read('bcError'), '', `${label}: ${read('bcError')}`);
    assert.ok(read('bcModules').length > 0, `${label} encoded nothing`);
    assert.ok(html.includes('bc-wrap') && html.includes('bc-svg'), `${label} did not render`);
    if (values.symbology && values.symbology !== 'auto') {
      assert.equal(read('bcSymbology'), values.symbology, `${label} did not reach its symbology`);
    }
  }
});

test('the render never depends on script, a network fetch or a bare colour', { skip: SKIP }, async () => {
  const template = await readFile(join(PKG, 'template.html'), 'utf8');
  const css = await readFile(join(PKG, 'styles.css'), 'utf8');
  const { html } = await mount();

  assert.ok(!/<script|on[a-z]+\s*=/i.test(template), 'the sheet must render with no script');
  // The SVG namespace is a name, not a fetch, so it is the one URL allowed.
  const NS = /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g;
  for (const [what, src] of [['template', template], ['styles', css], ['render', html]] as const) {
    assert.ok(!/https?:\/\/|@import|url\(/i.test(src.replace(NS, '')), `${what} must not reach off-device`);
  }
  // Every brand var in the stylesheet carries a literal fallback, so a brand
  // with no tokens still paints.
  for (const decl of css.match(/var\(--[a-z-]+[^)]*\)/g) ?? []) {
    assert.match(decl, /var\(--[a-z-]+,\s*(#[0-9a-f]{3,8}|rgba?\(|'[^']+')/,
      `${decl} has no literal fallback for a brand with no tokens`);
  }
  // The human-readable line is the brand mono face, with a standalone stack
  // inside the SVG for a file opened with no stylesheet.
  assert.match(css, /font-family: var\(--font-mono,/);
  assert.match(html, /font-family="ui-monospace, Menlo, Consolas, monospace"/);
});
