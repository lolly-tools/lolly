// SPDX-License-Identifier: MPL-2.0
//
// Audiogram still: the poster frame is real SVG, not a canvas snapshot.
//
// plans/69 section 16 called the audiogram raster "canvas by implementation, not
// necessity", and plans/147 E11 is the conversion. hooks.js now emits the whole
// still as an <svg class="ag-ph"> built from the SAME packed bytes template.html
// unpacks for the animation, so the vector still and the animated canvas cannot
// disagree about what the audio is doing.
//
// That "same numbers" claim is the thing worth pinning, so this suite decodes
// agData itself - base64 out, section layout applied, bar heights recomputed with
// the canvas's own maths - and compares the result against the rects hooks.js
// emitted. A drift in either direction (the still stops matching, or the payload
// layout moves under it) fails here rather than in a screenshot nobody re-reads.
//
// Run with:
//   node --import ./tests/css-stub.mjs --test tests/audiogram-still-svg.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { analysePcm } from '../engine/src/audio-analyse.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';
import type { AudioAnalyseOpts } from '../packages/core/src/host-v1.ts';

// audiogram ships in the PUBLIC community pack. Load from the SOURCE pack, not the
// gitignored tools/ profile view, so the suite is profile-independent.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'audiogram', 'tool.json')),
    'community/audiogram/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const HOOKS_SRC = PACK_MOUNTED
  ? readFileSync(join(COMMUNITY, 'audiogram', 'hooks.js'), 'utf8')
  : '';

// The constants hooks.js and template.html share. Repeated here on purpose: a test
// that imported them could not catch one of the two moving.
const BANDS = 48;
const BUCKETS = 160;
const SR = 8000;

interface HookModule {
  onInit: (ctx: unknown) => Promise<Record<string, string>>;
}

/** Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does. */
function compileHooks(): HookModule {
  const factory = new Function(
    'host',
    `${HOOKS_SRC}; return { onInit: typeof onInit !== 'undefined' ? onInit : null };`,
  ) as (host: unknown) => HookModule;
  return factory(null);
}

/** A tone with periodic bursts, so the spectrum has something to say. */
function pcm(seconds: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const burst = Math.sin(2 * Math.PI * 0.7 * t) > 0.6 ? 1 : 0.2;
    out[i] = 0.7 * burst * Math.sin(2 * Math.PI * 180 * t);
  }
  return out;
}

function fakeHost(channel: Float32Array): object {
  return {
    log: () => {},
    audio: {
      isAvailable: () => true,
      analyse: async (_src: unknown, opts: AudioAnalyseOpts) => analysePcm([channel], SR, opts),
    },
  };
}

function ctxFor(host: object, style: string, extra: Array<{ id: string; value: unknown }> = []) {
  return {
    host,
    model: [
      { id: 'audio', value: { id: 'clip', url: 'asset:clip' } },
      { id: 'style', value: style },
      { id: 'start', value: 0 },
      { id: 'accent', value: '#5b8def' },
      // Beats off, so the still's kick() and this file's expectation are both zero
      // and the comparison is about geometry rather than about beat detection.
      { id: 'beat', value: false },
      ...extra,
    ],
  };
}

// ── Independent decode of the payload ────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function unb64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let at = 0;
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean.charAt(i));
    bits += 6;
    if (bits >= 8) { bits -= 8; out[at++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, at);
}

/** The payload split the way template.html's unpack() splits it. */
function unpack(agData: string, meta: { count: number; scope: number }) {
  const raw = unb64(agData);
  const { count } = meta;
  let off = 0;
  const take = (n: number) => { const s = raw.subarray(off, off + n); off += n; return s; };
  const rms = take(count);
  take(count); take(count); take(count); take(count); take(count);
  const mag = take(count * BANDS);
  const over = take(BUCKETS);
  return { raw, rms, mag, over };
}

/** The canvas's `band(f, b, n)` - the MAX over the source bins, 0..1. */
function bandOf(mag: Uint8Array, f: number, b: number, n: number): number {
  const lo = Math.floor((b / n) * BANDS);
  const hi = Math.max(lo + 1, Math.floor(((b + 1) / n) * BANDS));
  let m = 0;
  for (let i = lo; i < hi && i < BANDS; i++) { const v = mag[f * BANDS + i]!; if (v > m) m = v; }
  return m / 255;
}

/** The poster frame: loudest in the middle 80%, off the QUANTISED rms track. */
function posterFrame(rms: Uint8Array, count: number): number {
  const lo = Math.floor(count * 0.1);
  const hi = Math.ceil(count * 0.9);
  let best = lo;
  let bv = -1;
  for (let i = lo; i < hi && i < count; i++) if (rms[i]! > bv) { bv = rms[i]!; best = i; }
  return best;
}

/** Every `<rect>` in the still, as numbers. */
function rects(svg: string): Array<{ x: number; y: number; w: number; h: number }> {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const m of svg.matchAll(/<rect\b([^>]*)\/>/g)) {
    const attr = (k: string) => {
      const a = new RegExp(`\\b${k}="([^"]*)"`).exec(m[1]!);
      return a ? Number(a[1]) : Number.NaN;
    };
    out.push({ x: attr('x'), y: attr('y'), w: attr('width'), h: attr('height') });
  }
  return out;
}

/** One decimal, the precision hooks.js emits at. */
const r1 = (v: number) => Math.round(v * 10) / 10;

// ── The pin ──────────────────────────────────────────────────────────────────

test('the still is SVG, and its bars are the analysis the canvas draws', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(6)), 'bars'));
  const meta = JSON.parse(out.agMeta!) as { count: number; scope: number; real: boolean };
  assert.equal(meta.real, true, 'the fake host analysed real audio');

  const svg = out.agStill!;
  assert.match(svg, /^<svg class="ag-ph" viewBox="0 0 1000 1000" preserveAspectRatio="none"/);
  assert.ok(!svg.includes('<canvas'), 'the still carries no canvas');

  const { rms, mag } = unpack(out.agData!, meta);
  const f = posterFrame(rms, meta.count);

  // The canvas's drawBars over a 1000x1000 box, with no beat kick.
  const N = 40;
  const W = 1000;
  const H = 1000;
  const slot = W / N;
  const gap = slot * 0.42;
  const bw = slot - gap;
  const want = [];
  for (let i = 0; i < N; i++) {
    const v = Math.min(1, bandOf(mag, f, i, N));
    const h = Math.max(H * 0.015, v * H * 0.9);
    want.push({ x: r1(i * slot + gap / 2), y: r1((H - h) / 2), w: r1(bw), h: r1(h) });
  }

  const got = rects(svg);
  assert.equal(got.length, N, 'one rect per bar');
  assert.deepEqual(got, want, 'the still bars are the same numbers the canvas would draw');
  // Not a flat card dressed up as data: a real clip has loud and quiet bands.
  assert.ok(new Set(want.map((b) => b.h)).size > 3, 'the bars vary - the analysis reached the still');
});

test('mirror bars draw both halves, the lower one faint', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(6)), 'mirror'));
  const svg = out.agStill!;
  const got = rects(svg);
  assert.equal(got.length, 80, 'two rects per bar');
  assert.equal((svg.match(/fill-opacity="0.45"/g) ?? []).length, 40, 'the lower half is the faint one');
  // Every pair meets on the centre line.
  for (let i = 0; i < 40; i++) {
    const top = got[i * 2]!;
    const bottom = got[i * 2 + 1]!;
    assert.equal(r1(top.y + top.h), 500, 'the upper bar ends on the centre line');
    assert.equal(bottom.y, 500, 'the lower bar starts there');
    assert.equal(top.h, bottom.h, 'the two halves are the same height');
  }
});

test('every style emits a still, and the round ones are fitted not stretched', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  const host = fakeHost(pcm(6));
  // `milkdrop` has no vector equivalent and falls through to bars, exactly as the
  // canvas does where WebGL is unavailable - this host has no host.viz at all.
  const STRETCH = ['bars', 'mirror', 'spectrum', 'wave', 'scope', 'ridge', 'dots', 'milkdrop'];
  const FITTED = ['ring', 'blob'];
  for (const style of [...STRETCH, ...FITTED]) {
    const out = await hooks.onInit(ctxFor(host, style));
    const svg = out.agStill!;
    assert.ok(svg.startsWith('<svg class="ag-ph"'), `${style}: a still was emitted`);
    assert.ok(svg.endsWith('</svg>'), `${style}: the still is closed`);
    assert.ok(svg.length > 200, `${style}: the still has geometry in it`);
    const want = FITTED.includes(style) ? 'xMidYMid meet' : 'none';
    assert.ok(svg.includes(`preserveAspectRatio="${want}"`), `${style}: fitted with ${want}`);
    // Gradient ids are salted, so two audiograms composed into one document cannot
    // collide - and every url(#…) the body references must be defined in the still.
    for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(svg.includes(`id="${m[1]}"`), `${style}: ${m[1]} is defined in the still`);
    }
  }
});

test('a colour that could break out of an attribute never reaches the markup', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  const out = await hooks.onInit(
    ctxFor(fakeHost(pcm(4)), 'bars', [{ id: 'accent', value: '#f00" onload="alert(1)' }]),
  );
  const svg = out.agStill!;
  assert.ok(!svg.includes('onload'), 'the injected attribute did not survive');
  assert.ok(!/"\s+on\w+=/.test(svg), 'no event handler attribute was formed');
  // Whitelist, so the value is replaced outright rather than filed down.
  assert.ok(svg.includes('#5b8def'), 'an unrecognisable colour falls back to the default');
});

test('a brand var() colour reaches the still', { skip: SKIP }, async () => {
  // The whitelist is the shared safeColor region (community/_shared/math.js), so the
  // documented brand-inheritance path - var(--brand-primary, #hex) on a colour input -
  // survives instead of being replaced by the tool's own default.
  const hooks = compileHooks();
  const out = await hooks.onInit(
    ctxFor(fakeHost(pcm(4)), 'bars', [{ id: 'accent', value: 'var(--brand-primary, #ff6a00)' }]),
  );
  assert.ok(out.agStill!.includes('var(--brand-primary, #ff6a00)'), 'the brand var was kept');
});

test('the ridge fade is the canvas ramp, not a rounded-off staircase', { skip: SKIP }, async () => {
  // fill-opacity is 0..1, so emitting it through the COORDINATE formatter (one
  // decimal in a 1000-unit box) quantised the 18-row fade into eight bands.
  const hooks = compileHooks();
  const out = await hooks.onInit(ctxFor(fakeHost(pcm(6)), 'ridge'));
  const got = [...out.agStill!.matchAll(/fill-opacity="([^"]*)"/g)].map((m) => Number(m[1]));
  const ROWS = 18;
  assert.equal(got.length, ROWS, 'one row per ridge line');
  // Back to front, the canvas's own `0.9 - depth * 0.75`.
  const want = [];
  for (let r = ROWS - 1; r >= 0; r--) want.push(Math.round((0.9 - (r / ROWS) * 0.75) * 1000) / 1000);
  assert.deepEqual(got, want, 'every row carries the opacity the canvas would set');
  assert.equal(new Set(got).size, ROWS, 'no two rows collapse onto one value');
});

test('two clips in one document do not share a gradient or clip id', { skip: SKIP }, async () => {
  // The print-sheet / host.compose case: two episodes of one podcast share a style
  // and a brand accent, so the salt has to come off the audio. Duplicate ids in one
  // document resolve to the FIRST definition, which put card one's playhead clip on
  // card two.
  const hooks = compileHooks();
  const a = await hooks.onInit(ctxFor(fakeHost(pcm(6)), 'wave'));
  const b = await hooks.onInit(ctxFor(fakeHost(pcm(9)), 'wave'));
  const ids = (svg: string) => [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const idsA = ids(a.agStill!);
  const idsB = ids(b.agStill!);
  assert.ok(idsA.length > 1, 'the wave still defines a gradient and a clip path');
  for (const id of idsA) assert.ok(!idsB.includes(id), `${id} is not reused by the other clip`);
  // And the thing the collision corrupted really does differ between the two.
  const clipW = (svg: string) => /<clipPath id="[^"]*"><rect [^>]*width="([^"]*)"/.exec(svg)?.[1];
  assert.notEqual(clipW(a.agStill!), clipW(b.agStill!), 'the two playheads sit at different places');
});

test('the placeholder track still draws a real envelope', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  // No host.audio at all: the deterministic placeholder path.
  const out = await hooks.onInit(ctxFor({ log: () => {} }, 'wave'));
  const meta = JSON.parse(out.agMeta!) as { count: number; scope: number; real: boolean };
  assert.equal(meta.real, false);
  const svg = out.agStill!;
  const { over } = unpack(out.agData!, meta);
  // The wave still traces the overview: its first point is the first bucket.
  const first = /^M0 (-?[\d.]+)/.exec(svg.slice(svg.indexOf('<path')).replace(/^[^d]*d="/, ''));
  assert.ok(first, 'the wave still opens with a moveTo');
  assert.equal(Number(first![1]), r1(500 - (over[0]! / 255) * 1000 * 0.42));
});

// ── The whole tool still mounts ──────────────────────────────────────────────

const tool: any = SKIP ? null : await loadTool('audiogram', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));

test('every example hydrates with the still in place and no hook error', { skip: SKIP }, async () => {
  for (const ex of tool.manifest.examples ?? []) {
    const logs: string[] = [];
    const host = baseHost({ log: (level: string, msg: string) => { if (level === 'error') logs.push(msg); } });
    const rt = await createRuntime(tool, host, ex.values);
    const html = rt.getHydrated() as string;
    assert.deepEqual(logs, [], `${ex.label}: no hook error`);
    assert.ok(html.includes('class="ag-ph"'), `${ex.label}: the still is in the markup`);
    // Raw, not escaped: the template uses a triple stache, so a &lt;svg means the
    // still was emitted through the escaping path and would render as text.
    assert.ok(!html.includes('&lt;svg class=&quot;ag-ph&quot;'), `${ex.label}: the still is raw markup`);
    assert.ok(html.includes('<canvas id="ag-wave"'), `${ex.label}: the motion canvas is still there`);
  }
});
