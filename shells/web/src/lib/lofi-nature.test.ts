// SPDX-License-Identifier: MPL-2.0
/**
 * Botanica's place (lib/lofi-nature.ts): each sound a model driven by a seed, the same seed
 * the same bytes, and each where recorded nature puts that sound. The numbers in the ranges below
 * are measurements of CC0 field recordings from Freesound (blackbird, robin, wren and song
 * thrush song; wind in trees; a stream; drips; crickets; cicadas; bees), taken with the
 * same measures applied to these models; the models sit inside or close to them.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-nature.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birdPhrase, birdSyllables, drips, gustCurve, insects, leaves, plink, rain, seamless, stream, twig, wind } from './lofi-nature.ts';

const SR = 22050;
const same = (a: Float32Array, b: Float32Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const finite = (x: Float32Array): boolean => x.every(Number.isFinite);
const rms = (x: Float32Array): number => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));

/** The share of a signal's energy between lo and hi (Hz), by a plain DFT over a few frames. */
function bandShare(x: Float32Array, sr: number, lo: number, hi: number): number {
  const n = 1024;
  let inBand = 0, total = 0;
  for (let start = 0; start + n <= x.length; start += Math.floor(x.length / 8)) {
    for (let k = 1; k < n / 2; k += 2) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const w = x[start + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
        re += w * Math.cos((2 * Math.PI * k * i) / n);
        im -= w * Math.sin((2 * Math.PI * k * i) / n);
      }
      const p = re * re + im * im, f = (k * sr) / n;
      total += p;
      if (f >= lo && f < hi) inBand += p;
    }
  }
  return inBand / Math.max(1e-20, total);
}

test('the same seed sings and blows the same bytes; another seed, another take', () => {
  assert.ok(same(birdPhrase(SR, 'robin', 1.5, 9), birdPhrase(SR, 'robin', 1.5, 9)));
  assert.ok(!same(birdPhrase(SR, 'robin', 1.5, 9), birdPhrase(SR, 'robin', 1.5, 10)));
  const a = wind(SR, 2, 4), b = wind(SR, 2, 4);
  assert.ok(same(a[0], b[0]) && same(a[1], b[1]));
  assert.ok(!same(a[0], wind(SR, 2, 5)[0]));
  assert.ok(!same(a[0], a[1]), 'the two sides of a bed are not one signal');
  for (const s of [leaves(SR, 2, 1), stream(SR, 2, 1), drips(SR, 3, 1), rain(SR, 2, 1), insects(SR, 2, 1, 'cricket'), insects(SR, 2, 1, 'cicada'), insects(SR, 2, 1, 'bee')]) {
    assert.ok(finite(s[0]) && finite(s[1]), 'only sound values');
    assert.ok(rms(s[0]) > 1e-4 && Math.max(...s[0].map(Math.abs)) < 4, 'sounding, and not wild');
  }
});

test('songbirds: elements of a few tens of milliseconds, about twelve to eighteen a second, in each species\' measured range', () => {
  // Recorded medians: blackbird 2.2 kHz, robin 4.2, wren 5.2, song thrush 4.2; elements 13 to 48 ms long, 12 to 16 a second.
  const ranges = { blackbird: [1450, 3600], robin: [2600, 8000], wren: [3400, 7700], thrush: [2500, 7500] } as const;
  for (const bird of ['blackbird', 'robin', 'wren', 'thrush'] as const) {
    const els = birdSyllables(bird, 2.2, 31);
    assert.ok(els.length >= 10, `${bird}: a phrase of many elements (${els.length})`);
    const lengths = els.map(e => e.len).sort((x, y) => x - y);
    const median = lengths[lengths.length >> 1]!;
    assert.ok(median >= 0.008 && median <= 0.06, `${bird}: elements ${Math.round(median * 1000)} ms long`);
    const span = els.at(-1)!.at + els.at(-1)!.len - els[0]!.at;
    const rate = (els.length - 1) / span;
    assert.ok(rate >= 7 && rate <= 25, `${bird}: ${rate.toFixed(1)} elements a second`);
    const [lo, hi] = ranges[bird];
    const centres = els.filter(e => e.level > 0.5).map(e => e.f[1]).sort((x, y) => x - y);
    const mid = centres[centres.length >> 1]!;
    assert.ok(mid >= lo && mid <= hi, `${bird}: sings round ${Math.round(mid)} Hz`);
  }
  // A bird's whistle is nearly pure: most of a robin's energy is in its band, little of the energy lower down.
  assert.ok(bandShare(birdPhrase(SR, 'robin', 1.5, 3), SR, 2400, 9000) > 0.9, 'a robin sings high');
  assert.ok(bandShare(birdPhrase(SR, 'dove', 2.4, 3), SR, 300, 1800) > 0.8, 'a wood pigeon coos low');
});

test('wind is dark and gusty, a stream bright and steady, as the recordings are', () => {
  // Recorded: wind in trees centred 0.3 to 1.3 kHz; a brook 2.1 to 3.3 kHz.
  const w = wind(SR, 6, 2)[0], s = stream(SR, 6, 2)[0];
  assert.ok(bandShare(w, SR, 0, 1000) > 0.6, 'wind lives below a kilohertz');
  assert.ok(bandShare(s, SR, 500, 6000) > 0.7, 'running water lives between half a kilohertz and six');
  // The gust: wanders and reverts to its mean, never silent, never past 1.
  const g = gustCurve(SR, SR * 20, 5, 4, 0.5, 0.18);
  const lo = g.reduce((m, v) => Math.min(m, v), 1), hi = g.reduce((m, v) => Math.max(m, v), 0);
  assert.ok(lo > 0.05 && hi <= 1 && hi - lo > 0.3, `the gust moves between ${lo.toFixed(2)} and ${hi.toFixed(2)}`);
});

test('a drip rings a few kilohertz and is gone in about ten milliseconds; crickets chirp near 4.7 kHz', () => {
  const p = plink(44100, 3, 2500);
  let top = 0;
  for (let i = 0; i < p.length; i++) if (Math.abs(p[i]!) > Math.abs(p[top]!)) top = i;
  const at = (ms: number): number => rms(p.subarray(top + Math.round(ms * 44.1), top + Math.round((ms + 2) * 44.1)));
  assert.ok(at(9) < at(0) * 0.2, 'down about 15 dB or more 9 ms after its peak (recorded drips: down 20 dB in 8 to 13 ms)');
  assert.ok(bandShare(p, 44100, 1500, 4500) > 0.6, 'its ring near the pitch asked for');
  const c = insects(SR, 4, 7, 'cricket')[0];
  assert.ok(bandShare(c, SR, 4000, 5500) > 0.85, 'a cricket\'s carrier near 4.7 kHz (recorded 4.78)');
  const t = twig(44100, 4);
  assert.ok(finite(t) && rms(t.subarray(0, 441)) > rms(t.subarray(3000, 3441)) * 4, 'a twig snaps and is done');
});

test('a bed loops without a seam: its tail runs into its head', () => {
  const bed = wind(SR, 4.5, 8);
  const loop = seamless(bed, SR, 0.5);
  assert.equal(loop[0].length, bed[0].length - Math.round(0.5 * SR));
  const tail = loop[0][loop[0].length - 1]!, head = loop[0][0]!;
  // The last sample and the first are neighbours in the original signal's crossfade, so the jump across the seam is small.
  assert.ok(Math.abs(tail - head) < 0.2, `the seam jumps ${Math.abs(tail - head).toFixed(3)}`);
});
