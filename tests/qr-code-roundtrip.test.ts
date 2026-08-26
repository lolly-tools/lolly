// SPDX-License-Identifier: MPL-2.0
/**
 * QR Code Generator ↔ host.scan round-trip (plans/162 section 2.6, WP-F + the WP-K3
 * branded axis). The payoff of owning both halves: render a payload through the
 * REAL qr-code tool (engine path), rasterise it, decode it with the same
 * zxing-wasm the CLI ships, and assert the text comes back. A generator
 * regression and a decoder regression are now the same red test - and a branded
 * style that quietly stops scanning is too.
 *
 * Rasterisation is via sharp (librsvg); the export-IR safety of the branded path
 * (no SVG arcs, no gradient paint servers) is pinned separately and structurally
 * in qr-code-branding.test.ts. Skips cleanly where sharp or the community pack
 * is absent.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/qr-code-roundtrip.test.ts
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
import { createNodeScanAPI } from '../packages/node-shell/src/scan.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');

let sharp: import('sharp').SharpConstructor | null = null;
try { sharp = (await import('sharp')).default; } catch { sharp = null; }

const SKIP = !existsSync(COMMUNITY)
  ? 'community pack not mounted'
  : !sharp ? 'sharp not installed (round-trip needs a rasteriser)' : false;

const tool: any = SKIP ? null : await loadTool('qr-code',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));
const scan = createNodeScanAPI();

/** Render vals → svgContent → RGBA (sharp) → the codes host.scan finds.
 * Explicit colours because baseHost does not resolve brand tokens - the default
 * `{color.semantic.text}` would reach the SVG as a literal and render nothing. */
async function roundTrip(vals: Record<string, unknown>) {
  const rt = await createRuntime(tool, baseHost(), { color: '#111111', background: '#ffffff', ...vals });
  let svg = rt.getHydratedString('{{{svgContent}}}') as string;
  svg = svg.replace('width="100%" height="100%"', 'width="900" height="900"');
  const { data, info } = await sharp!(Buffer.from(svg), { density: 240 })
    .flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frame = { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
  return scan.detect(frame);
}
async function decodeText(vals: Record<string, unknown>): Promise<string | null> {
  const hits = await roundTrip(vals);
  return hits[0]?.rawValue ?? null;
}

// ─── Content payloads: the decoded text IS the wire format ───────────────────

test('a URL QR round-trips to its exact URL', { skip: SKIP }, async () => {
  assert.equal(await decodeText({ url: 'https://lolly.tools/gallery?x=1' }), 'https://lolly.tools/gallery?x=1');
});

test('a Wi-Fi QR round-trips to its WIFI: wire format', { skip: SKIP }, async () => {
  const t = await decodeText({ payload: 'wifi', ssid: 'Studio Guest', wifiKey: 'welcome-2026', wifiSecurity: 'WPA' });
  assert.match(t ?? '', /^WIFI:/);
  assert.match(t ?? '', /S:Studio Guest/);
});

test('a text QR round-trips its content', { skip: SKIP }, async () => {
  assert.equal(await decodeText({ payload: 'text', text: 'HELLO WORLD 2026' }), 'HELLO WORLD 2026');
});

// ─── Symbology shapes: same wire, different symbol ───────────────────────────

for (const sym of ['datamatrix', 'aztec', 'pdf417']) {
  test(`a URL as ${sym} round-trips`, { skip: SKIP }, async () => {
    const hits = await roundTrip({ url: 'https://lolly.tools', symbology: sym });
    assert.ok(hits.some((h) => h.rawValue === 'https://lolly.tools'), `${sym} did not decode`);
  });
}

// ─── Barcodes ────────────────────────────────────────────────────────────────

test('an EAN-13 round-trips its digits', { skip: SKIP }, async () => {
  const hits = await roundTrip({ payload: 'ean13', value: '4006381333931' });
  assert.ok(hits.some((h) => h.rawValue === '4006381333931' && h.format === 'ean_13'), 'EAN-13 mismatch');
});

test('a Code 128 round-trips', { skip: SKIP }, async () => {
  const hits = await roundTrip({ payload: 'code128', value: 'INV-2026-001' });
  assert.ok(hits.some((h) => h.rawValue === 'INV-2026-001'), 'Code 128 mismatch');
});

// ─── The WP-K3 branded axis: styling must NOT break scanning ──────────────────

const BRANDED: Array<[string, Record<string, unknown>]> = [
  ['fluid + rounded eyes', { moduleShape: 'fluid', eyeShape: 'rounded' }],
  ['dot + circle eyes', { moduleShape: 'dot', eyeShape: 'circle' }],
  ['rounded + leaf eyes', { moduleShape: 'rounded', eyeShape: 'leaf' }],
  ['linear gradient', { fill: 'gradient', color: '#0c322c', color2: '#30ba78', moduleShape: 'fluid' }],
  ['radial gradient', { fill: 'gradient', color: '#0c322c', color2: '#30ba78', gradientType: 'radial', moduleShape: 'dot' }],
  ['centre logo', { logo: 'suse/logo/vert-pos-green', moduleShape: 'fluid', eyeShape: 'rounded' }],
  ['badge frame', { frame: 'badge', frameText: 'Scan me', moduleShape: 'fluid' }],
];

for (const [label, style] of BRANDED) {
  test(`branded (${label}) still decodes to its URL`, { skip: SKIP }, async () => {
    const url = 'https://lolly.tools/branded';
    const hits = await roundTrip({ url, ...style });
    assert.ok(hits.some((h) => h.rawValue === url), `${label} stopped scanning`);
  });
}
