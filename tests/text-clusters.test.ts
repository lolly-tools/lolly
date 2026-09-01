// SPDX-License-Identifier: MPL-2.0
/**
 * host.text.toPath `clusters` (plans/175 WP-D) - the per-cluster breakdown behind the
 * shaped-glyph letter tier, proven against a real font through the Node-shell text API
 * (the faithful port of the web bridge; the accumulation code is mirrored line for line).
 *
 * Run with: npm test. Skips when the Outfit platform face is not on disk.
 *
 * What has to hold:
 *   - Off by default: no `clusters` key, merged `d` unchanged (byte-identity).
 *   - One cluster per grapheme for plain Latin; concatenating the pieces in order
 *     reproduces the merged path exactly, so nothing is lost or duplicated.
 *   - A ligature is ONE cluster spanning its letters (the "one character" rule) - and
 *     turning ligatures off (`liga=0`) splits it back, which pins that the merge is
 *     the font's ligature and not an off-by-one.
 *   - A combining mark stays with its base; `x` is monotonic and `advance` sums to the
 *     run's advanceWidth; hostile-ish inputs (blank text) yield an empty list.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { glyphSvgMarkup } from '../shells/web/src/views/glyph-split-mount.ts';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTFIT_URL = '/fonts/Outfit[wght].ttf';
const SKIP = existsSync(join(REPO_ROOT, 'shells/web/public/fonts/Outfit[wght].ttf'))
  ? false : 'Outfit platform face not on disk (shells/web submodule not checked out?)';

const api = createNodeTextAPI({ repoRoot: REPO_ROOT });
const base = { fontUrl: OUTFIT_URL, fontSize: 48 };

test('clusters are off by default and the merged path is byte-identical either way', { skip: SKIP }, async () => {
  const plain = await api.toPath({ ...base, text: 'Type' });
  assert.ok(!('clusters' in plain), 'no clusters key unless asked');
  const withC = await api.toPath({ ...base, text: 'Type', clusters: true });
  assert.equal(withC.d, plain.d, 'asking for clusters changes nothing about the merged path');
  assert.equal(withC.advanceWidth, plain.advanceWidth);
});

test('plain Latin: one cluster per letter, pieces reassemble the merged path exactly', { skip: SKIP }, async () => {
  const r = await api.toPath({ ...base, text: 'Type', clusters: true });
  const c = r.clusters!;
  assert.equal(c.length, 4);
  assert.deepEqual(c.map((k) => [k.start, k.end]), [[0, 1], [1, 2], [2, 3], [3, 4]]);
  assert.equal(c.map((k) => k.d).join(''), r.d, 'the pieces ARE the path, in order');
  for (let i = 1; i < c.length; i++) assert.ok(c[i]!.x > c[i - 1]!.x, 'pen x is monotonic');
  assert.equal(c[0]!.x, 0);
  const sum = c.reduce((a, k) => a + k.advance, 0);
  assert.ok(Math.abs(sum - r.advanceWidth) < 0.05, `advances sum to the run (${sum} vs ${r.advanceWidth})`);
});

test('a ligature is ONE cluster spanning its letters; liga=0 splits it back', { skip: SKIP }, async () => {
  const on = await api.toPath({ ...base, text: 'fi', clusters: true });
  const off = await api.toPath({ ...base, text: 'fi', clusters: true, features: ['liga=0', 'clig=0'] });
  assert.equal(off.clusters!.length, 2, 'with ligatures off, two letters are two clusters');
  assert.equal(on.clusters!.reduce((n, k) => n + (k.end - k.start), 0), 2, 'every code unit is covered exactly once');
  // Whether Outfit ligates "fi" is the font's call; what is pinned is that IF it does,
  // the ligature travels as one piece over both letters rather than a phantom empty unit.
  if (on.clusters!.length === 1) assert.deepEqual([on.clusters![0]!.start, on.clusters![0]!.end], [0, 2]);
  else assert.equal(on.clusters!.length, 2);
});

test('a combining mark stays with its base cluster', { skip: SKIP }, async () => {
  const r = await api.toPath({ ...base, text: 'éa', clusters: true }); // e + COMBINING ACUTE, a
  if (r.notdef) return; // face lacks U+0301 - nothing to prove here
  assert.equal(r.clusters!.length, 2, 'base+mark is one cluster, then a');
  assert.deepEqual([r.clusters![0]!.start, r.clusters![0]!.end], [0, 2]);
});

test('spaces produce no drawn cluster piece, and a blank run yields an empty list', { skip: SKIP }, async () => {
  const r = await api.toPath({ ...base, text: 'a b', clusters: true });
  assert.equal(r.clusters!.length, 3, 'the space is still a cluster (it advances the pen)');
  assert.equal(r.clusters![1]!.d, '', 'but draws nothing');
  const blank = await api.toPath({ ...base, text: '   ', clusters: true });
  assert.deepEqual(blank.clusters, []);
});

// ── the enhancer's pure half ────────────────────────────────────────────────

test('glyphSvgMarkup emits one lly-u group per DRAWN cluster, fill currentColor, baseline translate', () => {
  const svg = glyphSvgMarkup({
    clusters: [
      { start: 0, end: 1, d: 'M0 0L1 1Z', x: 0, advance: 10 },
      { start: 1, end: 2, d: '', x: 10, advance: 5 },            // a space - no unit
      { start: 2, end: 4, d: 'M20 0L21 1Z', x: 15, advance: 12 }, // a ligature spanning two
    ],
    advance: 27.4, lineHeight: 57.6, baselineY: 44.123,
  });
  assert.equal([...svg.matchAll(/class="lly-u"/g)].length, 2, 'the space is not a unit');
  assert.match(svg, /data-cl="2-4"/, 'a ligature group names the letters it covers');
  assert.match(svg, /fill="currentColor"/);
  assert.match(svg, /transform-box:fill-box;transform-origin:center/);
  assert.match(svg, /<g transform="translate\(0 44\.12\)">/, 'baseline rounded to 2dp');
  assert.match(svg, /width="28" height="58" viewBox="0 0 28 58"/, 'box ceils to whole px');
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /overflow:visible/);
});
