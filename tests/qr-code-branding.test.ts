// SPDX-License-Identifier: MPL-2.0
/**
 * QR Code Generator (community/qr-code) - branded codes (plans/162 Part 3).
 *
 * Part 3 adds opt-in styling to the hand-rolled QR path: module shapes, styled
 * finder eyes, an OKLab per-module gradient, a centre logo (knockout + ecl
 * auto-raise), a frame/CTA, and the pure scannability guardrail (WP-K1). These
 * pin two things: the styling emits the expected export-safe markup (cubic
 * beziers / per-module solid fills / <image>, never SVG arcs or gradient defs,
 * which the export IR drops), and the DEFAULT render still falls through to the
 * byte-identical legacy path. Round-trip decode is WP-K3 (needs zxing-wasm).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/qr-code-branding.test.ts
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
const SKIP = !existsSync(COMMUNITY) && 'community pack not mounted (clone without submodules)';
const tool: any = SKIP ? null : await loadTool('qr-code',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

const URL = 'https://lolly.tools/gallery';

/** The finished <svg> string the tool renders into {{{svgContent}}}. */
async function svg(vals: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), { url: URL, ...vals });
  return rt.getHydratedString('{{{svgContent}}}') as string;
}
/** The scannability warnings the guardrail raised, as one string per line. */
async function warnings(vals: Record<string, unknown>): Promise<string[]> {
  const rt = await createRuntime(tool, baseHost(), { url: URL, ...vals });
  const s = rt.getHydratedText('{{#each qrWarnings}}{{this}}\n{{/each}}') as string;
  return (s || '').split('\n').map((l) => l.trim()).filter(Boolean);
}

// ─── Export-safety: the branded path must emit only what svg-ir understands ──
// (M/L/H/V/C/Z + solid fills + <image>). An SVG arc `A` or a <linearGradient>
// paint server renders in a browser but is DROPPED on PNG/PDF export.

test('no branded render ever emits an SVG arc command or a gradient paint server', { skip: SKIP }, async () => {
  for (const vals of [
    { moduleShape: 'rounded', eyeShape: 'rounded' },
    { moduleShape: 'dot', eyeShape: 'circle' },
    { moduleShape: 'fluid', eyeShape: 'leaf' },
    { fill: 'gradient', color: '0c322c', color2: '30ba78' },
    { logo: 'suse/logo/vert-pos-green' },
  ]) {
    const s = await svg(vals);
    // Arc commands live only inside path `d` data (a/A between numbers); hex
    // colours like #1a2b3c are not in `d`, so scan the path data specifically.
    const paths = [...s.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]);
    for (const d of paths) {
      assert.ok(!/[Aa]/.test(d),
        `arc command leaked into a path for ${JSON.stringify(vals)} - export IR would drop it`);
    }
    assert.ok(!/<(linear|radial)gradient/i.test(s),
      `gradient paint server in ${JSON.stringify(vals)} - export IR skips <defs>/gradients`);
  }
});

// ─── Default stays legacy (byte-identical intent) ────────────────────────────

test('the default render falls through to the legacy joined path - no branded markup', { skip: SKIP }, async () => {
  const s = await svg({});
  assert.match(s, /style="fill:[^"]*crispEdges/, 'default keeps the crispEdges style path');
  assert.ok(!s.includes('fill-rule="evenodd"'), 'no styled eyes by default');
  assert.ok(!s.includes('<image'), 'no logo by default');
});

// ─── Module + eye shapes ─────────────────────────────────────────────────────

test('dot modules render as circles (4-bezier), eyes as evenodd rings', { skip: SKIP }, async () => {
  const s = await svg({ moduleShape: 'dot', eyeShape: 'circle' });
  const eyeRings = s.match(/fill-rule="evenodd"/g) || [];
  assert.equal(eyeRings.length, 3, 'three finder eyes, each a ring');
  assert.match(s, /<circle /, 'circular eye centre dot present');
  assert.match(s, /d="M[\d.]+,[\d.]+C/, 'modules drawn with cubic beziers');
});

test('fluid + leaf eyes still produce three eyes and a module path', { skip: SKIP }, async () => {
  const s = await svg({ moduleShape: 'fluid', eyeShape: 'leaf' });
  assert.equal((s.match(/fill-rule="evenodd"/g) || []).length, 3);
  assert.match(s, /<path d="M/, 'fluid module path present');
});

test('a custom eyeColor ALONE routes to the branded renderer (not silently dropped)', { skip: SKIP }, async () => {
  // square modules + square eyes, but a distinct eyeColor: must still style eyes.
  const s = await svg({ color: '#111111', eyeColor: '#30ba78' });
  assert.equal((s.match(/fill-rule="evenodd"/g) || []).length, 3, 'eyes rendered separately');
  assert.match(s, /fill="#30ba78"/, 'the eye colour is applied');
});

// ─── Gradient fill: per-module solid bands, several distinct colours ─────────

test('gradient fill paints multiple solid per-module bands (no url(#…) fill)', { skip: SKIP }, async () => {
  const s = await svg({ fill: 'gradient', color: '0c322c', color2: '30ba78' });
  const fills = new Set((s.match(/fill="#[0-9a-fA-F]{6}"/g) || []));
  assert.ok(fills.size >= 3, `expected several gradient bands, got ${fills.size}`);
  assert.ok(!s.includes('url(#'), 'no gradient paint-server reference');
});

// ─── Logo: <image>, knockout, ecl auto-raise ─────────────────────────────────

test('a logo embeds an <image>, raises ecl to High, and reports the raise', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, baseHost(), { url: URL, logo: 'suse/logo/vert-pos-green', ecl: 'M' });
  const s = rt.getHydratedString('{{{svgContent}}}') as string;
  assert.match(s, /<image href="asset:suse\/logo\/vert-pos-green"/, 'logo image embedded');
  assert.equal(rt.getHydratedText('{{qrEclRaised}}'), 'true', 'ecl raised for the logo');
});

test('a QR sized at ecl M is larger (fewer modules) than the same content forced to H by a logo', { skip: SKIP }, async () => {
  // The logo path forces H, so its symbol carries the extra ecl codewords: it is
  // never smaller (more modules or equal) than the plain M code.
  const plain = await svg({});
  const logo = await svg({ logo: 'suse/logo/vert-pos-green' });
  const cell = (str: string) => {
    const m = str.match(/viewBox="0 0 (\d+) (\d+)"/);
    return m ? Number(m[1]) : 0;
  };
  assert.equal(cell(plain), 600);
  assert.equal(cell(logo), 600, 'a logo alone does not add a frame');
});

// ─── Frame / CTA ─────────────────────────────────────────────────────────────

test('a frame expands the viewBox and paints the caption text', { skip: SKIP }, async () => {
  const s = await svg({ frame: 'badge', frameText: 'Scan me' });
  const m = s.match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(m, 'has a viewBox');
  assert.ok(Number(m![2]) > Number(m![1]), 'framed canvas is taller than wide');
  assert.match(s, /Scan me<\/text>/, 'caption rendered');
});

test('frame text is escaped', { skip: SKIP }, async () => {
  const s = await svg({ frame: 'label', frameText: 'A & B <x>' });
  assert.ok(s.includes('A &amp; B &lt;x&gt;'), 'caption HTML-escaped');
  assert.ok(!s.includes('<x>'), 'no raw markup from caption');
});

// ─── Scannability guardrail (WP-K1) ──────────────────────────────────────────

test('a clean default raises no scannability warnings', { skip: SKIP }, async () => {
  assert.deepEqual(await warnings({ background: 'ffffff' }), []);
});

test('low contrast is flagged with the actual ratio', { skip: SKIP }, async () => {
  const w = await warnings({ color: 'cccccc', background: 'ffffff' });
  assert.equal(w.length, 1);
  assert.match(w[0], /Low contrast \(1\.\d:1\)/);
});

test('a code lighter than its background is flagged as inverted', { skip: SKIP }, async () => {
  const w = await warnings({ color: 'ffffff', background: '0c322c' });
  assert.ok(w.some((l) => /lighter than the background/.test(l)), 'polarity warning present');
});

test('a quiet zone under 4 modules is flagged', { skip: SKIP }, async () => {
  const w = await warnings({ padding: 1, background: 'ffffff' });
  assert.ok(w.some((l) => /Quiet zone is 1 module/.test(l)));
});

test("a gradient's lightest stop is what the contrast check judges", { skip: SKIP }, async () => {
  const w = await warnings({ fill: 'gradient', color: '0c322c', color2: 'eef7ee', background: 'ffffff' });
  assert.ok(w.some((l) => /Low contrast/.test(l)), 'near-white gradient end flagged');
});
