// SPDX-License-Identifier: MPL-2.0
/**
 * Extended symbologies via the vendored bwip-js bundle (plans/162). The qr-code
 * tool routes the industrial payloads (ITF-14, UPC-E, Code 39, Codabar, ISBN,
 * GS1 DataBar, GS1 element strings, MaxiCode) and the non-QR 2D shapes of the
 * content payloads (Micro QR, Data Matrix, Aztec, PDF417) through a bundle
 * generated from @bwip-js/generic (itself cross-compiled from BWIPP, the
 * reference implementation these symbologies are usually verified AGAINST).
 * So unlike qr-code-barcode.test.ts, there are no independent reference
 * vectors here: this suite guards the tool's own contract - routing, the
 * forgiving normalizers and their check-digit hints, the extras surface that
 * composing tools read, and that the legacy QR/EAN paths stay untouched.
 *
 * Run with: node --test tests/qr-code-bwip.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
const tool: any = SKIP ? null : await loadTool('qr-code', fetchFile);

async function mount(values: Record<string, any>) {
  const rt = await createRuntime(tool, baseHost(), values);
  return {
    rt,
    svg: rt.getHydratedString('{{{svgContent}}}') as string,
    read: (name: string) => rt.getHydratedText(`{{${name}}}`),
  };
}

// ─── Industrial payloads ─────────────────────────────────────────────────────

test('ITF-14: 13 digits get the check digit worked out', { skip: SKIP }, async () => {
  const { read, svg } = await mount({ payload: 'itf14', value: '1931234567890' });
  assert.equal(read('bcError'), '');
  assert.equal(read('bcSymbology'), 'itf14');
  assert.equal(read('bcValue').length, 14);
  assert.match(svg, /<svg [^>]*viewBox=/);
  assert.match(svg, /<path /);
});

test('ITF-14: a wrong check digit is refused with the number that would have worked', { skip: SKIP }, async () => {
  const good = await mount({ payload: 'itf14', value: '1931234567890' });
  const full = good.read('bcValue');
  const wrong = full.slice(0, 13) + ((Number(full[13]) + 1) % 10);
  const { read, svg } = await mount({ payload: 'itf14', value: wrong });
  assert.match(read('bcError'), /check digit/i);
  assert.equal(read('bcHint'), `Did you mean ${full}?`);
  assert.match(svg, /Code unavailable/);
});

test('UPC-E: 6, 7 and 8 digit forms all encode', { skip: SKIP }, async () => {
  for (const value of ['123456', '0123456', '01234565']) {
    const { read } = await mount({ payload: 'upce', value });
    assert.equal(read('bcError'), '', `${value} was refused`);
    assert.equal(read('bcSymbology'), 'upce');
  }
});

test('Code 39 uppercases, and names a character it cannot hold', { skip: SKIP }, async () => {
  const ok = await mount({ payload: 'code39', value: 'inv-2026-001' });
  assert.equal(ok.read('bcError'), '');
  assert.equal(ok.read('bcValue'), 'INV-2026-001');
  const bad = await mount({ payload: 'code39', value: 'CAFÉ' });
  assert.match(bad.read('bcError'), /Code 39 cannot hold "É" \(character 4\)/);
});

test('Codabar wraps a bare number in the conventional A...A', { skip: SKIP }, async () => {
  const { read } = await mount({ payload: 'codabar', value: '31117013206375' });
  assert.equal(read('bcError'), '');
  assert.equal(read('bcValue'), 'A31117013206375A');
  const kept = await mount({ payload: 'codabar', value: 'b12345c' });
  assert.equal(kept.read('bcValue'), 'B12345C', 'typed start/stop letters are kept');
});

test('ISBN keeps its dashes; a bare number is asked back, not guessed at', { skip: SKIP }, async () => {
  const ok = await mount({ payload: 'isbn', value: '978-1-56581-231-4' });
  assert.equal(ok.read('bcError'), '');
  assert.equal(ok.read('bcSymbology'), 'isbn');
  const bare = await mount({ payload: 'isbn', value: '9781565812314' });
  assert.match(bare.read('bcError'), /dashes/i);
  assert.equal(bare.read('bcHint'), 'Like 978-1-56581-231-4.');
});

test('GS1 DataBar accepts a bare GTIN-13 and works out the check digit', { skip: SKIP }, async () => {
  const { read } = await mount({ payload: 'databar', value: '0952123454321' });
  assert.equal(read('bcError'), '');
  assert.equal(read('bcValue'), '(01)09521234543213');
});

test('GS1 element string renders on both carriers and validates its AIs', { skip: SKIP }, async () => {
  const els = '(01)09521234543213(17)270831(10)LOT42';
  const bars = await mount({ payload: 'gs1', value: els });
  assert.equal(bars.read('bcError'), '');
  assert.equal(bars.read('bcSymbology'), 'gs1-128');
  assert.equal(bars.read('bcValue'), els);
  const square = await mount({ payload: 'gs1', gs1Carrier: 'gs1datamatrix', value: els });
  assert.equal(square.read('bcError'), '');
  assert.equal(square.read('bcSymbology'), 'gs1datamatrix');
  const noParen = await mount({ payload: 'gs1', value: '0109521234543213' });
  assert.match(noParen.read('bcError'), /AI in brackets/);
});

test('GS1: a wrong (01)/(00) check digit gets a Did-you-mean, not a bare Bad checksum', { skip: SKIP }, async () => {
  const { read } = await mount({ payload: 'gs1', value: '(01)09521234543212(10)LOT42' });
  assert.match(read('bcError'), /check digit/i);
  assert.equal(read('bcHint'), 'Did you mean (01)09521234543213(10)LOT42?');
  const sscc = await mount({ payload: 'gs1', value: '(00)095212345678901234' });
  assert.match(sscc.read('bcError'), /check digit/i);
  assert.equal(sscc.read('bcHint'), 'Did you mean (00)095212345678901235?');
});

test('MaxiCode encodes plain text', { skip: SKIP }, async () => {
  const { read, svg } = await mount({ payload: 'maxicode', value: 'hello maxicode' });
  assert.equal(read('bcError'), '');
  assert.equal(read('bcSymbology'), 'maxicode');
  assert.match(svg, /<path /, 'the bullseye and hexagons render as paths');
});

// ─── Content payloads in non-QR shapes ───────────────────────────────────────

test('a Wi-Fi card renders the same wire payload as a Data Matrix', { skip: SKIP }, async () => {
  const values = { payload: 'wifi', ssid: 'Studio Guest', wifiKey: 'welcome-2026', wifiSecurity: 'WPA' };
  const qr = await mount(values);
  const dm = await mount({ ...values, symbology: 'datamatrix' });
  assert.equal(dm.read('bcError'), '');
  assert.equal(dm.read('bcSymbology'), 'datamatrix');
  assert.equal(dm.read('qrKind'), 'wifi');
  assert.equal(dm.read('qrPayload'), qr.read('qrPayload'), 'shape must not change the payload');
  assert.match(dm.read('qrSummary'), /^Data Matrix holding /);
});

test('Aztec and PDF417 shapes render for a link', { skip: SKIP }, async () => {
  for (const symbology of ['aztec', 'pdf417']) {
    const { read, svg } = await mount({ payload: 'url', url: 'https://suse.com', symbology });
    assert.equal(read('bcError'), '', `${symbology} was refused`);
    assert.equal(read('bcSymbology'), symbology);
    assert.match(svg, /<path /);
  }
});

test('Micro QR: too-long content fails with words, and suggests QR', { skip: SKIP }, async () => {
  const { read, svg } = await mount({
    payload: 'text', symbology: 'microqr',
    text: 'This is far too long a string to ever fit inside a Micro QR symbol at any version.',
  });
  assert.match(read('bcError'), /too long for a Micro QR/);
  assert.match(read('bcError'), /switch the shape back to QR/);
  assert.match(svg, /Code unavailable/);
});

test('an empty content payload shows the kind hint, not an encoder error', { skip: SKIP }, async () => {
  const { read } = await mount({ payload: 'wifi', symbology: 'datamatrix', ssid: '' });
  assert.match(read('bcError'), /network name/i);
});

// ─── Presentation and extras contract ────────────────────────────────────────

test('brand colours land as fills, and transparent background drops the rect', { skip: SKIP }, async () => {
  const inked = await mount({ payload: 'itf14', value: '1931234567890', color: '#134e4a', background: '#f0fdfa' });
  assert.match(inked.svg, /#134e4a/);
  assert.match(inked.svg, /#f0fdfa/);
  assert.equal(inked.read('inkHex'), '#134e4a');
  const clear = await mount({ payload: 'itf14', value: '1931234567890', transparentBg: true });
  assert.equal(clear.read('bgHex'), 'transparent');
  assert.ok(!/backgroundcolor|<rect width="100%"/.test(clear.svg), 'no background rect when transparent');
});

test('the bwip SVG carries the presentation attributes the templates expect', { skip: SKIP }, async () => {
  const { svg, read } = await mount({ payload: 'gs1', value: '(00)095212345678901235' });
  assert.match(svg, /class="bc-svg"/);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, new RegExp(`aria-label="${read('bcSummary').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.equal(read('qrSummary'), read('bcSummary'), 'the a11yLabel reads the same line');
});

// ─── The legacy paths are untouched ──────────────────────────────────────────

test('a QR payload still renders through the hand-rolled QR path', { skip: SKIP }, async () => {
  const { read, svg } = await mount({ payload: 'url', url: 'https://suse.com' });
  assert.match(svg, /shape-rendering:crispEdges/, 'the qrcode-svg renderer, not bwip-js');
  assert.equal(read('qrKind'), 'url');
  assert.equal(read('bcModules'), '');
});

test('an EAN-13 still renders through the hand-rolled encoder', { skip: SKIP }, async () => {
  const { read } = await mount({ payload: 'ean13', value: '4006381333931' });
  assert.equal(read('bcModules').length, 95, 'the reference-vector path, not bwip-js');
});
