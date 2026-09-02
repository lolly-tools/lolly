// SPDX-License-Identifier: MPL-2.0
/**
 * Golden PCM proofs for the headless stretcher (plans/165 WP-7): the REAL vendored
 * WASM runs here in node - there is no mock and no browser tier for the math. The
 * numbers held are the spike's own (plans/101 section 5): pitch stable within a
 * fraction of a percent under stretch, +12 st doubles the frequency, byte-identical
 * re-runs, exact output length, zero NaNs. Plus the vendor checksum pin: the
 * patched file must not drift from the README's documented hash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { stretchPcm } from '../shells/web/src/lib/audio-stretch-core.ts';

const RATE = 48_000;

function tone(seconds: number, freq: number, amp = 0.8): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / RATE);
  return out;
}

/** Fundamental estimate by zero-crossing pairs over the settled middle. */
function hzOf(buf: Float32Array): number {
  const mid = buf.subarray(Math.round(buf.length * 0.3), Math.round(buf.length * 0.7));
  let z = 0;
  for (let i = 1; i < mid.length; i++) if (((mid[i - 1] as number) < 0) !== ((mid[i] as number) < 0)) z++;
  return z / (mid.length / RATE) / 2;
}

const sha = (chs: Float32Array[]): string => {
  const h = createHash('sha256');
  for (const c of chs) h.update(Buffer.from(c.buffer, c.byteOffset, c.byteLength));
  return h.digest('hex');
};

test('the vendored file matches its documented checksum (the patch pin)', () => {
  const bytes = readFileSync(new URL('../shells/web/src/vendor/signalsmith-stretch/SignalsmithStretch.mjs', import.meta.url));
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, 'c9080c6978538d324ca16fb3e739160e04682106784b740090ba14f8d9d6842a',
    'SignalsmithStretch.mjs drifted - re-vendor per the README and update BOTH pins');
});

test('speed 1.5x preserves pitch and lands the exact contract length', async () => {
  const inp = tone(2, 440);
  const [out] = await stretchPcm([inp, inp], { speed: 1.5, rate: RATE });
  assert.equal(out!.length, Math.round(inp.length / 1.5), 'output length');
  const hz = hzOf(out!);
  assert.ok(Math.abs(hz - 440) < 4, `pitch drifted: ${hz.toFixed(1)} Hz`);
  for (const v of out!) assert.ok(!Number.isNaN(v), 'NaN in output');
});

test('speed 0.5x preserves pitch (the overshoot case the limiter guards)', async () => {
  const inp = tone(2, 440);
  const [out] = await stretchPcm([inp], { speed: 0.5, rate: RATE });
  assert.equal(out!.length, inp.length * 2, 'output length');
  const hz = hzOf(out!);
  assert.ok(Math.abs(hz - 440) < 4, `pitch drifted: ${hz.toFixed(1)} Hz`);
});

test('+12 semitones at speed 1 doubles the frequency', async () => {
  const inp = tone(2, 440);
  const [out] = await stretchPcm([inp], { speed: 1, semitones: 12, rate: RATE });
  assert.equal(out!.length, inp.length, 'a pure transpose keeps the length');
  const hz = hzOf(out!);
  assert.ok(Math.abs(hz - 880) < 12, `expected ~880 Hz, got ${hz.toFixed(1)}`);
});

test('re-runs are byte-identical (fresh instances, same bytes)', async () => {
  const inp = tone(1, 440);
  const a = await stretchPcm([inp, inp], { speed: 1.5, rate: RATE });
  const b = await stretchPcm([inp, inp], { speed: 1.5, rate: RATE });
  assert.equal(sha(a), sha(b), 'the stretcher is not deterministic');
});

test('speed 1 with no transpose is a verbatim copy', async () => {
  const inp = tone(0.5, 440);
  const [out] = await stretchPcm([inp], { speed: 1, rate: RATE });
  assert.deepEqual(out, inp);
});
