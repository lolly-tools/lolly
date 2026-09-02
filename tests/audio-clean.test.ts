// SPDX-License-Identifier: MPL-2.0
/**
 * The voice-cleanup driver (plans/101 P6, plans/165's deferred tier): the REAL
 * vendored GTCRN wasm runs here in node. Model behaviour on synthetic signals
 * is only partly predictable, so the proofs are the honest ones: stationary
 * noise is strongly suppressed (what any denoiser must do), the length contract
 * holds, re-runs are byte-identical, and the vendored file matches its
 * documented checksum. Speech quality is the listening pass's territory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { cleanPcm } from '../shells/web/src/lib/audio-clean-core.ts';

const RATE = 48_000;

function noise(n: number, amp: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = amp * ((s / 0xffffffff) * 2 - 1);
  }
  return out;
}

const rms = (x: Float32Array, from = 0): number => {
  let s = 0;
  for (let i = from; i < x.length; i++) s += (x[i] as number) * (x[i] as number);
  return Math.sqrt(s / Math.max(1, x.length - from));
};

test('the vendored file matches its documented checksum (the patch pin)', () => {
  const bytes = readFileSync(new URL('../shells/web/src/vendor/gtcrn/gtcrn-core.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'd7a9b779510e8328374591ea901ad4d4c2784d1fe98bc38ead05e4039f2983ff',
    'gtcrn-core.mjs drifted - re-vendor per the README and update BOTH pins');
});

test('stationary noise is strongly suppressed, and the length contract holds', async () => {
  const inp = noise(RATE, 0.2, 7);
  const [out] = await cleanPcm([inp]);
  assert.equal(out!.length, inp.length, 'output length equals input length');
  // Skip the first 200 ms (model warm-up); a denoiser must crush pure noise.
  const suppression = 20 * Math.log10(rms(out!, Math.round(RATE * 0.2)) / rms(inp));
  assert.ok(suppression < -20, `expected >20 dB of suppression, got ${(-suppression).toFixed(1)}`);
  for (const v of out!) assert.ok(!Number.isNaN(v), 'NaN in output');
});

test('re-runs are byte-identical (fresh instances, same bytes)', async () => {
  const inp = noise(RATE / 2, 0.15, 3);
  const sha = (chs: Float32Array[]): string => {
    const h = createHash('sha256');
    for (const c of chs) h.update(Buffer.from(c.buffer, c.byteOffset, c.byteLength));
    return h.digest('hex');
  };
  assert.equal(sha(await cleanPcm([inp, inp])), sha(await cleanPcm([inp, inp])), 'not deterministic');
});

test('a wrong rate is refused, never mis-processed', async () => {
  await assert.rejects(() => cleanPcm([new Float32Array(100)], 44_100), /48000/);
});
