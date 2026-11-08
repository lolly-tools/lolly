// SPDX-License-Identifier: MPL-2.0
/**
 * The sound shape's promises, checked against the node graph each cue builds.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/sfx-voices.test.ts
 *
 * Node has no Web Audio, so a fake context records every node and every automation call.
 * What is pinned:
 *  - every cue name in sfx.ts has a voice, and nothing else does;
 *  - the mix: the centre is the chimes alone, each end is its own material alone, and in
 *    between two neighbours crossfade at equal power;
 *  - Bouba never starts a sound at full level (no hard edge: every envelope rises from
 *    silence over at least 4 ms) and never lets noise through above 2.6 kHz (no ticks,
 *    scratches or hiss);
 *  - Kiki never glides (no pitch moves more than 2% within a note, so no bloops) and
 *    plays nothing under 200 Hz (no bass);
 *  - the bass "bwah" is drawn in the Bouba pass and nowhere else.
 *
 * Loudness is balanced by ear and by measurement in a real browser (an OfflineAudioContext
 * render of every cue at each end, K-weighted, against the chimes); MATERIAL_TRIM in
 * sfx-voices.ts holds the result. That needs Chromium, so it is not repeated here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SFX_NAMES } from './sfx.ts';
import {
  VOICES, THEME_VOICES, BOUBA_BASS, materialMix, renderShaped,
  renderGalleryBell, renderCatalogHorn, renderProjectsWind,
} from './sfx-voices.ts';
import type { Render } from './sfx-voices.ts';

type Event = [kind: 'set' | 'lin' | 'exp' | 'target', value: number, time: number];

class FakeParam {
  value = 0;
  events: Event[] = [];
  setValueAtTime(v: number, t: number): this { this.events.push(['set', v, t]); return this; }
  linearRampToValueAtTime(v: number, t: number): this { this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number): this {
    assert.ok(v > 0, `an exponential ramp to ${v} would throw in a browser`);
    this.events.push(['exp', v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number): this { this.events.push(['target', v, t]); return this; }
}

class FakeNode {
  outs: unknown[] = [];
  connect<T>(n: T): T { this.outs.push(n); return n; }
  disconnect(): void { /* no-op */ }
}
class FakeOsc extends FakeNode {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  detune = new FakeParam();
  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeFilter extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
  gain = new FakeParam();
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}

class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;   // small, so the shared noise buffers are cheap to fill
  oscs: FakeOsc[] = [];
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  sources: FakeSource[] = [];
  createOscillator(): FakeOsc { const n = new FakeOsc(); this.oscs.push(n); return n; }
  createGain(): FakeGain { const n = new FakeGain(); this.gains.push(n); return n; }
  createBiquadFilter(): FakeFilter { const n = new FakeFilter(); this.filters.push(n); return n; }
  createBufferSource(): FakeSource { const n = new FakeSource(); this.sources.push(n); return n; }
  createBuffer(_ch: number, n: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(n);
    return { getChannelData: () => data };
  }
}

/** Every cue the app can play: the named cues, the theme chimes and the three arrivals. */
const ALL: Array<[string, Render, Render?]> = [
  ...SFX_NAMES.map((n): [string, Render, Render?] => [n, VOICES[n], BOUBA_BASS[n]]),
  ...Object.entries(THEME_VOICES).map(([n, r]): [string, Render] => [`theme:${n}`, r]),
  ['arrival:gallery', renderGalleryBell],
  ['arrival:catalog', renderCatalogHorn],
  ['arrival:projects', renderProjectsWind],
];

function draw(render: Render, shape: number, bass?: Render): FakeCtx {
  const ctx = new FakeCtx();
  const out = ctx.createGain();
  renderShaped(render, ctx as unknown as AudioContext, out as unknown as AudioNode, shape, bass);
  return ctx;
}

test('every cue name has a voice, and every voice has a name', () => {
  assert.deepEqual(Object.keys(VOICES).sort(), [...SFX_NAMES].sort());
  for (const name of Object.keys(BOUBA_BASS)) assert.ok((SFX_NAMES as readonly string[]).includes(name), `bass for unknown cue ${name}`);
});

test('the mix: chimes at the centre, one material at each end, equal power between', () => {
  assert.deepEqual(materialMix(0.5), [['chime', 1]]);
  assert.deepEqual(materialMix(0).map(([m]) => m), ['bouba']);
  assert.deepEqual(materialMix(1).map(([m]) => m), ['kiki']);
  assert.deepEqual(materialMix(Number.NaN), [['chime', 1]], 'a corrupt stored shape plays the chimes');
  for (const shape of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
    const mix = materialMix(shape);
    assert.equal(mix.length, 2, `two materials at ${shape}`);
    assert.equal(mix[1]![0], shape < 0.5 ? 'bouba' : 'kiki');
    const power = mix.reduce((sum, [, w]) => sum + w * w, 0);
    assert.ok(Math.abs(power - 1) < 1e-9, `equal power at ${shape}: ${power}`);
  }
});

test('Bouba: every sound rises from silence, and no noise gets through above 2.6 kHz', () => {
  for (const [name, render, bass] of ALL) {
    const ctx = draw(render, 0, bass);
    for (const g of ctx.gains) {
      const first = g.gain.events[0];
      if (!first) continue;   // a fixed level (a mix or layer gain), not an envelope
      if (g.outs.some(o => o instanceof FakeParam)) continue;   // a modulation depth (vibrato, wobble), not a level
      assert.equal(first[0], 'set', `${name}: an envelope starts with a set`);
      assert.ok(first[1] <= 0.001, `${name}: an envelope starts at ${first[1]}, a hard edge`);
      const rise = g.gain.events.find(e => e[0] !== 'set' && e[1] > 0.001);
      if (rise) assert.ok(rise[2] - first[2] >= 0.004, `${name}: an onset of ${((rise[2] - first[2]) * 1000).toFixed(1)} ms`);
    }
    for (const f of ctx.filters) {
      for (const [, hz] of f.frequency.events) assert.ok(hz <= 2600, `${name}: a ${f.type} filter at ${Math.round(hz)} Hz`);
    }
  }
});

test('Kiki: no note glides, and nothing plays under 200 Hz', () => {
  for (const [name, render, bass] of ALL) {
    const ctx = draw(render, 1, bass);
    assert.ok(ctx.oscs.length + ctx.sources.length > 0, `${name} makes a sound at Kiki`);
    for (const o of ctx.oscs) {
      const hz = o.frequency.events.map(e => e[1]);
      for (const f of hz) assert.ok(f >= 200, `${name}: a ${Math.round(f)} Hz oscillator`);
      for (let i = 1; i < hz.length; i++) {
        const ratio = hz[i]! / hz[i - 1]!;
        assert.ok(ratio > 0.98 && ratio < 1.02, `${name}: a note glides by ${ratio.toFixed(3)}`);
      }
    }
  }
});

test('the bwah plays in the Bouba pass only', () => {
  const sawsAt = (shape: number): number =>
    draw(VOICES.save, shape, BOUBA_BASS.save).oscs.filter(o => o.type === 'sawtooth').length;
  assert.ok(sawsAt(0) > 0, 'Bouba: the bwah sounds');
  assert.equal(sawsAt(0.5), 0, 'the chimes: no bwah');
  assert.equal(sawsAt(1), 0, 'Kiki: no bwah');
});

test('the centre is the chimes exactly: the cue draws straight into the output', () => {
  for (const [name, render, bass] of ALL) {
    const direct = new FakeCtx();
    render(direct as unknown as AudioContext, direct.createGain() as unknown as AudioNode);
    const shaped = draw(render, 0.5, bass);
    assert.equal(shaped.oscs.length, direct.oscs.length, `${name}: same oscillators`);
    assert.equal(shaped.gains.length, direct.gains.length, `${name}: same gains, and no mix gain`);
    assert.deepEqual(shaped.oscs.map(o => o.type), direct.oscs.map(o => o.type), `${name}: same waveforms`);
  }
});
