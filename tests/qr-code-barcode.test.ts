// SPDX-License-Identifier: MPL-2.0
/**
 * Linear barcodes, folded into qr-code (plans/147 T7a). The barcode tool was
 * merged into qr-code: its `payload` select gained ean13/ean8/upca/code128, and
 * its EAN/UPC/Code-128 encoders moved into qr-code's hooks (an IIFE). This guards
 * the SHIPPED encoders through the real qr-code tool, so the fold cannot silently
 * regress the reference vectors that community/barcode used to pin.
 *
 * Reference patterns are rebuilt here from the published EAN/UPC and Code-128
 * tables, independent of the tool's own copy, so agreement is evidence, not a
 * shared typo.
 *
 * Run with: node --test tests/qr-code-barcode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'qr-code');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')), 'community/qr-code/tool.json is missing');
}
const tool: any = SKIP ? null : await loadTool('qr-code', fetchFile);

// A barcode is selected by its payload (ean13/ean8/upca/code128), the id the fold
// uses instead of the retired tool's `symbology`.
async function mount(payload: string, value: string) {
  const rt = await createRuntime(tool, baseHost(), { payload, value });
  return { rt, html: rt.getHydrated() as string, read: (name: string) => rt.getHydratedText(`{{${name}}}`) };
}

// ─── Reference encoders (transcribed from the standards) ─────────────────────
const REF_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const REF_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const REF_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const REF_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function refEan13(v: string): string {
  const parity = REF_PARITY[Number(v[0])] as string;
  let out = '101';
  for (let i = 0; i < 6; i++) out += parity[i] === 'L' ? REF_L[Number(v[1 + i])] : REF_G[Number(v[1 + i])];
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
function refCheck(body: string): number {
  let sum = 0;
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w;
  return (10 - (sum % 10)) % 10;
}

// ─── EAN / UPC reference vectors ─────────────────────────────────────────────
test('EAN-13 4006381333931 matches the published pattern tables', { skip: SKIP }, async () => {
  const { read } = await mount('ean13', '4006381333931');
  const modules = read('bcModules');
  assert.equal(read('bcSymbology'), 'ean13');
  assert.equal(read('bcValue'), '4006381333931');
  assert.equal(modules.length, 95, 'an EAN-13 symbol is 95 modules');
  assert.equal(modules, refEan13('4006381333931'));
  assert.equal(modules.slice(0, 3), '101');
  assert.equal(modules.slice(45, 50), '01010');
  assert.equal(modules.slice(92), '101');
  assert.equal(read('bcCheck'), '1');
});

test('UPC-A 036000291452 encodes as the EAN-13 with a leading zero', { skip: SKIP }, async () => {
  const { read } = await mount('upca', '036000291452');
  assert.equal(read('bcModules'), refEan13('0036000291452'));
  assert.equal(read('bcValue'), '036000291452');
  assert.equal(read('bcCheck'), '2');
  assert.equal(refCheck('03600029145'), 2);
});

test('EAN-8 96385074 matches the published pattern tables', { skip: SKIP }, async () => {
  const { read } = await mount('ean8', '96385074');
  const modules = read('bcModules');
  assert.equal(modules.length, 67, 'an EAN-8 symbol is 67 modules');
  assert.equal(modules, refEan8('96385074'));
  assert.equal(read('bcCheck'), '4');
});

test('a body one digit short gets its check digit worked out', { skip: SKIP }, async () => {
  for (const [payload, value, full] of [['ean13', '400638133393', '4006381333931'], ['ean8', '9638507', '96385074'], ['upca', '03600029145', '036000291452']] as const) {
    const { read } = await mount(payload, value);
    assert.equal(read('bcError'), '', `${payload} ${value} was refused`);
    assert.equal(read('bcValue'), full);
  }
});

test('a wrong check digit is refused with the number that would have worked', { skip: SKIP }, async () => {
  const { read, html } = await mount('ean13', '4006381333932');
  assert.match(read('bcError'), /check digit/i);
  assert.equal(read('bcHint'), 'Did you mean 4006381333931?');
  assert.equal(read('bcModules'), '', 'nothing may be encoded from a bad number');
  assert.match(html, /Barcode unavailable/);
});

// ─── Code 128 ────────────────────────────────────────────────────────────────
function toolC128Table(): string[] {
  const src = readFileSync(join(PKG, 'hooks.js'), 'utf8');
  const block = /var C128 = \[([\s\S]*?)\];/.exec(src);
  assert.ok(block, 'the Code 128 width table was not found in qr-code hooks.js');
  return ((block![1] ?? '').match(/'(\d+)'/g) ?? []).map((s) => s.slice(1, -1));
}

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
      assert.equal(bars.reduce((a, b) => a + b, 0) % 2, 0, `symbol ${i} bar widths sum even`);
    }
  });
});

test('Code 128 does not encode whitespace around the value', { skip: SKIP }, async () => {
  const plain = await mount('code128', 'AB12');
  for (const padded of [' AB12', 'AB12 ', '  AB12\n', '\tAB12\r\n']) {
    const { read } = await mount('code128', padded);
    assert.equal(read('bcError'), '', `${JSON.stringify(padded)} was refused`);
    assert.equal(read('bcSymbols'), plain.read('bcSymbols'), `${JSON.stringify(padded)} encoded its padding`);
  }
});

test('a character Code 128 cannot hold is named, with its position', { skip: SKIP }, async () => {
  const { read } = await mount('code128', 'CAFÉ-01');
  assert.match(read('bcError'), /Code 128 cannot hold "É" \(character 4\)/);
  assert.equal(read('bcModules'), '');
});

// ─── The QR path is untouched by the fold ────────────────────────────────────
test('a QR payload still renders a QR, not a barcode', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, baseHost(), { payload: 'url', url: 'https://suse.com' });
  const svg = rt.getHydratedString('{{{svgContent}}}');
  assert.ok(svg.length > 100 && /<(path|rect)/.test(svg), 'QR SVG rendered');
  assert.equal(rt.getHydratedText('{{bcModules}}'), '', 'the barcode extras stay empty for a QR payload');
});
