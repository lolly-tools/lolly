// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readType1FontInfo, type1Container } from './font-type1.ts';

const PFA_HEADER = [
  '%!PS-AdobeFont-1.0: ExampleSerif-Bold 001.002',
  '%%Title: ExampleSerif-Bold',
  '/FontInfo 9 dict dup begin',
  '/version (001.002) readonly def',
  '/Notice (Copyright \\(c\\) 2026 (Example) Foundry\\051 ) readonly def',
  '/FullName (Example Serif Bold) readonly def',
  '/FamilyName (Example Serif) readonly def',
  '/Weight (Bold) readonly def',
  'end readonly def',
  '/FontName /ExampleSerif-Bold def',
  'currentfile eexec',
].join('\n');

function pfa(trailer = ''): Uint8Array { return new TextEncoder().encode(`${PFA_HEADER}\n${trailer}`); }
function pfb(text: string): Uint8Array {
  const ascii = new TextEncoder().encode(text), binary = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  const out = new Uint8Array(6 + ascii.length + 6 + binary.length + 2), view = new DataView(out.buffer);
  out.set([0x80, 0x01]); view.setUint32(2, ascii.length, true); out.set(ascii, 6);
  const at = 6 + ascii.length; out.set([0x80, 0x02], at); view.setUint32(at + 2, binary.length, true); out.set(binary, at + 6);
  out.set([0x80, 0x03], out.length - 2);
  return out;
}

test('PFA and PFB containers are recognised by their headers, not by extension', () => {
  assert.equal(type1Container(pfa()), 'pfa');
  assert.equal(type1Container(pfb(PFA_HEADER)), 'pfb');
  assert.equal(type1Container(new TextEncoder().encode('%!FontType1-1.0: Example 001')), 'pfa');
  assert.equal(type1Container(new TextEncoder().encode('%!PS-Adobe-3.0 EPSF-3.0')), null);
  assert.equal(type1Container(new Uint8Array([0x80, 0x01, 4, 0, 0, 0, 0x41, 0x42, 0x43, 0x44])), null);
  assert.equal(readType1FontInfo(new TextEncoder().encode('OTTO')), null);
});

test('the cleartext header gives the font names, weight, version and notice', () => {
  const expected = { fontName: 'ExampleSerif-Bold', familyName: 'Example Serif', fullName: 'Example Serif Bold', weight: 'Bold', version: '001.002', notice: 'Copyright (c) 2026 (Example) Foundry)' };
  assert.deepEqual(readType1FontInfo(pfa()), { container: 'pfa', ...expected });
  assert.deepEqual(readType1FontInfo(pfb(PFA_HEADER)), { container: 'pfb', ...expected });
});

test('nothing after eexec is read, and a missing FontName falls back to the header line', () => {
  const info = readType1FontInfo(pfa('/Weight (Hidden) def\n'))!;
  assert.equal(info.weight, 'Bold');
  const bare = readType1FontInfo(new TextEncoder().encode('%!PS-AdobeFont-1.0: Bare-Regular 001\ncurrentfile eexec\n/FamilyName (Hidden) def'))!;
  assert.equal(bare.fontName, 'Bare-Regular'); assert.equal(bare.familyName, '');
});
