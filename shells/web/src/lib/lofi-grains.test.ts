// SPDX-License-Identifier: MPL-2.0
/**
 * Botanica's granular pads (lib/lofi-grains.ts): Lolly's own instruments and voices,
 * rendered, cut into grains and played back reordered, reversed and stretched. Pinned: a
 * seed is a pad (the same grains and the same bytes), each cloud plays as it says (a
 * reverse swell mostly backwards, a stretch scanning slowly), the pad keeps its source's
 * loudness, and every source renders.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-grains.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOTANICA_SOURCES } from '../../../../engine/src/lofi-botanica.ts';
import { CLOUDS, grainCloud, grainPlan, renderSource } from './lofi-grains.ts';

const SR = 22050;
const rms = (x: Float32Array): number => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length));

test('every source renders: the instruments\' own models, at a common loudness', () => {
  for (const source of BOTANICA_SOURCES) {
    const s = renderSource(source, 64, SR, 7);
    assert.ok(s.data.length > SR, `${source}: over a second`);
    assert.ok(s.data.every(Number.isFinite), `${source}: only sound values`);
    const level = rms(s.data.subarray(0, Math.round(1.1 * SR)));
    assert.ok(level > 0.15 && level < 0.25, `${source}: set to about 0.2 RMS (${level.toFixed(3)})`);
  }
  // A note outside an instrument's range is rendered octaves in and played back at the pitch asked for.
  assert.equal(renderSource('flute', 48, SR, 7).ratio, 0.5, 'a flute an octave below its lowest note plays its octave at half speed');
  assert.equal(renderSource('voice', 88, SR, 7).ratio, 2);
});

test('a seed is a pad: the same grains and the same bytes; another seed, another pad', () => {
  const src = renderSource('piano', 60, SR, 3);
  const a = grainPlan(CLOUDS.shimmer, 4, 1.8, 11), b = grainPlan(CLOUDS.shimmer, 4, 1.8, 11);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, grainPlan(CLOUDS.shimmer, 4, 1.8, 12));
  const x = grainCloud(src, SR, 4, a), y = grainCloud(src, SR, 4, b);
  assert.ok(x[0].every((v, i) => v === y[0][i]) && x[1].every((v, i) => v === y[1][i]));
});

test('each cloud plays as it says', () => {
  const plan = (c: keyof typeof CLOUDS): ReturnType<typeof grainPlan> => grainPlan(CLOUDS[c], 20, 1.8, 5);
  const share = (c: keyof typeof CLOUDS): number => plan(c).filter(g => g.reverse).length / plan(c).length;
  assert.ok(share('reverse') > 0.6, `a reverse swell is mostly backwards (${share('reverse').toFixed(2)})`);
  assert.ok(share('stretch') < 0.3, 'a stretch mostly forwards');
  // The shimmer sounds an octave up as well as at the note; the scatter spreads across the speakers.
  assert.ok(plan('shimmer').some(g => Math.abs(g.ratio - 2) < 0.02) && plan('shimmer').some(g => Math.abs(g.ratio - 1) < 0.02));
  const pans = plan('scatter').map(g => g.pan);
  assert.ok(Math.min(...pans) < 0.1 && Math.max(...pans) > 0.9, 'the scatter reaches both sides');
  // A stretch reads through the note twenty times slower than it was played: over 20 s, a second of source.
  const reads = plan('stretch').map(g => g.from);
  assert.ok(Math.max(...reads) - Math.min(...reads) < 1.6, 'a stretch stays within the note\'s sounding part');
  assert.ok(plan('stretch').length >= 20 * CLOUDS.stretch.density * 0.6, 'as dense as it says');
});

test('a pad keeps its source\'s loudness however dense, fades in and out, and is stereo', () => {
  const src = renderSource('voice', 67, SR, 9);
  for (const cloud of ['shimmer', 'reverse', 'stretch'] as const) {
    const [l, r] = grainCloud(src, SR, 6, grainPlan(CLOUDS[cloud], 6, src.data.length / SR, 2), 0.5);
    const body = rms(l.subarray(SR, 5 * SR));
    assert.ok(body > 0.05 && body < 0.5, `${cloud}: ${body.toFixed(3)} against the source's 0.2`);
    assert.ok(Math.abs(l[0]!) < 1e-6 && Math.abs(l[l.length - 1]!) < 1e-3, `${cloud}: faded at its ends`);
    assert.ok(!l.every((v, i) => v === r[i]), `${cloud}: the two sides differ`);
  }
});
