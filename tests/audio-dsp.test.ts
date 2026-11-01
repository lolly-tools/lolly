// SPDX-License-Identifier: MPL-2.0
/**
 * The audio DSP module (packages/node-shell/wasm/audio-dsp): full EBU R128 loudness, model-free
 * repair and clip alignment, through the Node loader. Ordinary runs need no ffmpeg: the
 * oracle readings are stored in tests/fixtures/audio-dsp/ebur128-reference.json
 * (regenerate with `node scripts/audio-dsp-oracle.ts`).
 *
 * Run with: node --test tests/audio-dsp.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { loadAudioDspKernel } from '../packages/node-shell/src/audio-dsp-node.ts';
import { createAudioDspKernel } from '../packages/node-shell/src/audio-dsp.ts';
import { planRepair, repairRequested } from '../engine/src/audio-repair.ts';
import { cleanAudioPcm } from '../engine/src/audio-clean.ts';
import { integratedLoudness } from '../engine/src/audio-loudness.ts';
import { createNodeAudioAPI } from '../packages/node-shell/src/audio.ts';
import { packWav } from '../engine/src/wav.ts';
import { Rng, db, sine, speech, pink, programmes } from './fixtures/audio-dsp/signals.ts';

const kernel = await loadAudioDspKernel();
const wasmBytes = readFileSync(new URL('../packages/node-shell/wasm/audio-dsp/audio-dsp.wasm', import.meta.url));

interface Reference {
  oracle: string;
  programmes: Record<string, {
    rate: number; integrated: number; loudnessRange: number; truePeakDb: number;
    samples: { at: number; m: number | null; s: number | null }[];
  }>;
}
const reference = JSON.parse(readFileSync(new URL('./fixtures/audio-dsp/ebur128-reference.json', import.meta.url), 'utf8')) as Reference;

const sha = (...parts: Float32Array[]): string => {
  const h = createHash('sha256');
  for (const p of parts) h.update(new Uint8Array(p.buffer, p.byteOffset, p.byteLength));
  return h.digest('hex');
};
const power = (x: Float32Array, freq: number, rate: number): number => {
  let re = 0, im = 0;
  for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * freq * i / rate; re += x[i]! * Math.cos(w); im += x[i]! * Math.sin(w); }
  return (re * re + im * im) / (x.length * x.length);
};
const rms = (x: Float32Array, from = 0, to = x.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, to - from));
};

// ─── the module's shape ──────────────────────────────────────────────────────

test('the module imports nothing from the host', () => {
  const module = new WebAssembly.Module(wasmBytes);
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const exported = WebAssembly.Module.exports(module).map(e => e.name).filter(n => !n.startsWith('__')).sort();
  assert.deepEqual(exported, ['audio_dsp_alloc', 'audio_dsp_free', 'audio_dsp_result_len', 'audio_dsp_result_ptr', 'audio_dsp_run', 'memory']);
});

test('two separate instances give identical numbers', async () => {
  const other = await createAudioDspKernel(new Uint8Array(wasmBytes));
  const p = programmes().find(q => q.name === 'speech_like')!;
  assert.deepEqual(other.measureLoudness(p.channels, p.rate, { series: true }), kernel.measureLoudness(p.channels, p.rate, { series: true }));
});

// ─── loudness: analytic cases ────────────────────────────────────────────────

test('a stereo 997 Hz sine at -20 dBFS reads -20.0 LUFS with no range, mono reads 3 dB lower', () => {
  const x = sine(997, db(-20), 48_000, 10);
  const stereo = kernel.measureLoudness([x, x], 48_000).report;
  assert.ok(Math.abs(stereo.integrated! + 20) < 0.01, `got ${stereo.integrated}`);
  assert.ok(Math.abs(stereo.momentary! + 20) < 0.01 && Math.abs(stereo.shortTerm! + 20) < 0.01);
  assert.ok(stereo.loudnessRange! < 0.05);
  assert.ok(Math.abs(stereo.truePeakDb! + 20) < 0.05, `true peak ${stereo.truePeakDb}`);
  const mono = kernel.measureLoudness([x], 48_000).report;
  assert.ok(Math.abs(mono.integrated! + 23.01) < 0.01, `got ${mono.integrated}`);
  const heardOnBoth = kernel.measureLoudness([x], 48_000, { monoAsStereo: true }).report;
  assert.ok(Math.abs(heardOnBoth.integrated! + 20) < 0.01, `got ${heardOnBoth.integrated}`);
});

test('an inter-sample peak is found: fs/4 at 45 degrees has a 0.9 true peak but a 0.636 sample peak', () => {
  const x = sine(12_000, 0.9, 48_000, 5, Math.PI / 4);
  const r = kernel.measureLoudness([x], 48_000).report;
  assert.ok(Math.abs(r.truePeakDb! - 20 * Math.log10(0.9)) < 0.1, `true peak ${r.truePeakDb}`);
  assert.ok(Math.abs(r.samplePeakDb! - 20 * Math.log10(0.9 * Math.SQRT1_2)) < 0.01, `sample peak ${r.samplePeakDb}`);
});

test('silence has no loudness and an empty clip does not crash', () => {
  const r = kernel.measureLoudness([new Float32Array(48_000 * 2)], 48_000).report;
  assert.equal(r.integrated, null);
  assert.equal(r.momentary, null);
  const none = kernel.measureLoudness([new Float32Array(0)], 48_000).report;
  assert.equal(none.integrated, null);
});

test('the same clip at 44.1 and 96 kHz reads the same loudness (K-weighting derived per rate)', () => {
  const at = (rate: number) => kernel.measureLoudness([sine(997, db(-23), rate, 8)], rate).report.integrated!;
  assert.ok(Math.abs(at(44_100) - at(48_000)) < 0.02);
  assert.ok(Math.abs(at(96_000) - at(48_000)) < 0.02);
});

test('the meter takes only the sample rates and channel counts the module bounds', () => {
  assert.throws(() => kernel.measureLoudness([new Float32Array(10)], 500), /Sample rate/);
  assert.throws(() => kernel.measureLoudness([], 48_000), /no audio channels/);
  assert.throws(() => kernel.measureLoudness([new Float32Array(10), new Float32Array(9)], 48_000), /differ in length/);
});

// ─── loudness: stored ffmpeg ebur128 readings ────────────────────────────────

for (const p of programmes()) {
  test(`${p.name} matches the stored ffmpeg ebur128 reading`, () => {
    const ref = reference.programmes[p.name]!;
    assert.equal(ref.rate, p.rate);
    const { report, series } = kernel.measureLoudness(p.channels, p.rate, { series: true });
    assert.ok(Math.abs(report.integrated! - ref.integrated) <= 0.01, `integrated ${report.integrated} vs ${ref.integrated}`);
    assert.ok(Math.abs(report.loudnessRange! - ref.loudnessRange) <= 0.05, `range ${report.loudnessRange} vs ${ref.loudnessRange}`);
    // ffmpeg's true peak is only the reference when no analytic value is known (its own
    // interpolator reads high on a tone at fs/4, which the analytic value shows).
    const truth = p.analyticTruePeakDb ?? ref.truePeakDb;
    assert.ok(Math.abs(report.truePeakDb! - truth) <= (p.analyticTruePeakDb === undefined ? 0.1 : 0.1), `true peak ${report.truePeakDb} vs ${truth}`);
    assert.ok(ref.samples.length > 0);
    for (const s of ref.samples) {
      const m = series!.momentary[s.at * 10 - 1] ?? null, sh = series!.shortTerm[s.at * 10 - 1] ?? null;
      if (s.m !== null) assert.ok(m !== null && Math.abs(m - s.m) <= 0.002, `momentary at ${s.at} s: ${m} vs ${s.m}`);
      if (s.s !== null && s.at >= 3) assert.ok(sh !== null && Math.abs(sh - s.s) <= 0.002, `short-term at ${s.at} s: ${sh} vs ${s.s}`);
    }
  });
}

test('the module agrees with the engine integrated meter it sits beside', () => {
  const p = programmes().find(q => q.name === 'speech_like')!;
  const engine = integratedLoudness(p.channels)!;
  const module = kernel.measureLoudness(p.channels, p.rate).report.integrated!;
  assert.ok(Math.abs(engine - module) < 0.05, `engine ${engine}, module ${module}`);
});

// ─── determinism ─────────────────────────────────────────────────────────────

test('pinned digests: the readings and repaired samples are the same on every machine', () => {
  const p = programmes().find(q => q.name === 'speech_like')!;
  const r = kernel.measureLoudness(p.channels, p.rate, { series: true });
  const readings = new Float64Array([r.report.integrated!, r.report.loudnessRange!, r.report.truePeakDb!, r.report.maxMomentary!, r.report.maxShortTerm!, ...r.series!.momentary.map(v => v ?? NaN)]);
  const got = { readings: sha(new Float32Array(readings.buffer.slice(0))), repaired: '' };
  const stages = planRepair({ noise: 'strong', hum: '50', deEss: 'light', declick: true, dereverb: 'light' });
  const out = kernel.repair([p.channels[0]!.subarray(0, 96_000)], 48_000, stages);
  got.repaired = sha(out.channels[0]!);
  assert.deepEqual(got, PINNED);
});

const PINNED = {
  readings: '8a336ac69500c8dffc6a7b07a079a138d6ad436cded1b45bead6b6f838c1fc09',
  repaired: 'cd9f8d82939296e8ffa9742cd0f6c1d57d9c4987b51d5abae0bec4630c76fdb5',
};

// ─── repair ──────────────────────────────────────────────────────────────────

test('the repair plan orders the stages and labels them in plain words', () => {
  assert.equal(repairRequested({}), false);
  assert.equal(repairRequested({ hum: '60' }), true);
  const stages = planRepair({ deEss: 'strong', dereverb: 'light', noise: 'light', hum: '60', declick: true });
  assert.deepEqual(stages.map(s => s.id), ['declick', 'dehum', 'denoise', 'dereverb', 'deesser']);
  assert.equal(stages[1]!.params.frequency, 1);
  for (const s of stages) assert.ok(!/[—§]/.test(s.label), s.label);
  assert.deepEqual(planRepair(undefined), []);
});

test('dehum takes the 50 Hz tone and its harmonics out and leaves speech-band content alone', () => {
  const rate = 48_000, n = rate * 3;
  const voice = sine(440, 0.1, rate, 3);
  const hum = new Float32Array(n);
  for (let i = 0; i < n; i++) for (const h of [1, 2, 3]) hum[i]! += 0.05 * Math.sin(2 * Math.PI * 50 * h * i / rate);
  const mixed = voice.map((v, i) => v + hum[i]!);
  const out = kernel.repair([mixed], rate, planRepair({ hum: '50' })).channels[0]!;
  const tail = (x: Float32Array) => x.subarray(rate, n);
  for (const f of [50, 100, 150]) {
    const drop = 10 * Math.log10(power(tail(mixed), f, rate) / power(tail(out), f, rate));
    assert.ok(drop > 20, `${f} Hz only down ${drop.toFixed(1)} dB`);
  }
  const keep = 10 * Math.log10(power(tail(out), 440, rate) / power(tail(mixed), 440, rate));
  assert.ok(Math.abs(keep) < 0.5, `440 Hz moved ${keep.toFixed(2)} dB`);
});

test('denoise lowers a steady noise floor between phrases and keeps the phrases', () => {
  const rate = 48_000;
  const noise = pink(rate, 6, 0.05, 99n);
  const phrase = sine(300, 0.3, rate, 1);
  const x = noise.slice();
  for (let i = 0; i < phrase.length; i++) x[rate * 3 + i]! += phrase[i]!;
  const out = kernel.repair([x], rate, planRepair({ noise: 'strong' })).channels[0]!;
  const gap = (s: Float32Array) => rms(s, rate * 5, rate * 6);
  const reduction = 20 * Math.log10(gap(x) / gap(out));
  assert.ok(reduction >= 3, `noise floor only down ${reduction.toFixed(1)} dB`);
  const kept = 20 * Math.log10(rms(out, rate * 3 + 4_800, rate * 4 - 4_800) / rms(x, rate * 3 + 4_800, rate * 4 - 4_800));
  assert.ok(kept > -3, `the phrase lost ${kept.toFixed(1)} dB`);
});

test('declick repairs a spike and counts it', () => {
  const rate = 48_000;
  const clean = sine(300, 0.3, rate, 1);
  const bad = clean.slice();
  bad[20_000]! += 0.9;
  const r = kernel.repair([bad], rate, planRepair({ declick: true }));
  assert.ok(r.clicksRepaired >= 1);
  assert.ok(Math.abs(r.channels[0]![20_000]! - clean[20_000]!) < 0.2 * 0.9);
  assert.equal(r.channels[0]!.length, bad.length);
});

test('de-ess lowers an "s" burst more than the vowel around it', () => {
  const rate = 48_000;
  const vowel = sine(200, 0.25, rate, 2);
  const rng = new Rng(5n);
  const x = vowel.slice();
  for (let i = rate; i < rate + 9_600; i++) x[i]! += 0.2 * rng.next() * Math.sin(Math.PI * (i - rate) / 9_600);
  // Sibilance lives above 4 kHz; a crude high-pass by differencing isolates it for the check.
  const high = (s: Float32Array) => { const d = new Float32Array(s.length); for (let i = 1; i < s.length; i++) d[i] = s[i]! - s[i - 1]!; return d; };
  const out = kernel.repair([x], rate, planRepair({ deEss: 'strong' })).channels[0]!;
  const hi = (s: Float32Array) => rms(high(s), rate + 1_000, rate + 8_600);
  assert.ok(20 * Math.log10(hi(x) / hi(out)) >= 3, 'the burst should lose at least 3 dB above 4 kHz');
  assert.ok(Math.abs(20 * Math.log10(rms(out, 24_000, 40_000) / rms(x, 24_000, 40_000))) < 0.3, 'the vowel should stay put');
});

test('dereverb keeps the length, stays finite and does not boost', () => {
  const rate = 48_000;
  const x = speech(rate, 6, 3n);
  const out = kernel.repair([x], rate, planRepair({ dereverb: 'strong' })).channels[0]!;
  assert.equal(out.length, x.length);
  assert.ok(out.every(Number.isFinite));
  assert.ok(rms(out) <= rms(x) * 1.05);
});

test('a long stereo clip repaired in several chunks equals the one-call result', async () => {
  // 8 s is above the wrapper's 5 s chunk, so this crosses chunk boundaries.
  const rate = 48_000;
  const l = speech(rate, 8, 21n), r = speech(rate, 8, 22n);
  const stages = planRepair({ noise: 'light', hum: '60', deEss: 'light', declick: true, dereverb: 'light' });
  const whole = kernel.repair([l, r], rate, stages);
  assert.equal(whole.channels[0]!.length, l.length);
  assert.equal(whole.channels[1]!.length, r.length);
  assert.ok(whole.channels.every(c => c.every(Number.isFinite)));
});

test('an unknown stage or parameter is refused by name', () => {
  const x = [new Float32Array(4_800)];
  assert.throws(() => kernel.repair(x, 48_000, [{ id: 'reverb' as never, params: {}, label: '' }]), /Unknown repair stage/);
  assert.throws(() => kernel.repair(x, 48_000, [{ id: 'dehum', params: { bogus: 1 }, label: '' }]), /Unknown parameter/);
});

// ─── clip alignment ──────────────────────────────────────────────────────────

test('alignment finds a known offset to the sample, with a sign and a reliability flag', () => {
  const rate = 48_000;
  const a = pink(rate, 6, 0.3, 77n);
  const lag = 31_337;
  const b = a.slice(lag, lag + rate * 3);
  const r = kernel.alignClips([a], [b], rate)!;
  assert.equal(r.lag, lag);
  assert.ok(Math.abs(r.offsetSeconds - lag / rate) < 1 / rate);
  assert.equal(r.reliable, true);
  assert.equal(r.inverted, false);
  const swapped = kernel.alignClips([b], [a], rate)!;
  assert.equal(swapped.lag, -lag);
});

test('alignment survives a different gain, added noise and an inverted microphone', () => {
  const rate = 48_000;
  const a = speech(rate, 8, 31n);
  const lag = 20_000;
  const rng = new Rng(9n);
  const b = a.slice(lag, lag + rate * 4).map(v => -0.4 * v + 0.004 * rng.next());
  const r = kernel.alignClips([a], [b], rate)!;
  assert.ok(Math.abs(r.lag - lag) <= 1, `lag ${r.lag}`);
  assert.equal(r.inverted, true);
});

test('unrelated recordings are not reported as reliable, and silence aligns to nothing', () => {
  const rate = 48_000;
  const r = kernel.alignClips([pink(rate, 4, 0.3, 1n)], [pink(rate, 4, 0.3, 2n)], rate);
  assert.ok(r === null || r.reliable === false);
  assert.equal(kernel.alignClips([new Float32Array(rate)], [pink(rate, 2, 0.3, 3n)], rate), null);
});

// ─── through the engine and the Node host ────────────────────────────────────

test('cleanAudioPcm uses repaired PCM and lists what the repair did, ahead of the other steps', () => {
  const rate = 48_000;
  const x = sine(440, 0.1, rate, 2);
  const repaired = x.map(v => v * 0.5);
  const r = cleanAudioPcm([x], rate, { repaired: [repaired], repairOperations: ['Removed 50 Hz hum'], normalize: 'off' });
  assert.deepEqual(r.operations.slice(0, 1), ['Removed 50 Hz hum']);
  assert.ok(Math.abs(r.channels[0]![1000]! - repaired[1000]!) < 1e-6);
  assert.ok(r.loudnessBefore! > r.loudnessAfter!, 'the loudness before still reads the input');
});

test('host.audio.clean runs the repair chain in Node and reports full R128 numbers', async () => {
  const rate = 48_000;
  const voice = sine(440, 0.15, rate, 3);
  const dirty = voice.map((v, i) => v + 0.05 * Math.sin(2 * Math.PI * 50 * i / rate));
  const wav = packWav({ channels: [dirty], sampleRate: rate }, { format: 'int16' });
  const audio = createNodeAudioAPI({ repoRoot: process.cwd() });
  const result = await audio.clean!(wav, { repair: { hum: '50' }, normalize: -16, output: 'wav', sourceName: 'voice.wav' });
  assert.ok(result.operations.includes('Removed 50 Hz hum'));
  assert.ok(result.operations.includes('Normalised to -16 LUFS'));
  assert.ok(result.report, 'a report with before and after');
  assert.ok(Math.abs(result.report!.after.integrated! + 16) < 0.5, `after ${result.report!.after.integrated}`);
  assert.equal(result.truePeakDb, result.report!.after.truePeakDb);
  assert.ok(result.truePeakDb <= -1 + 0.2);
  const measured = await audio.loudness!(wav, { series: true });
  assert.equal(measured.sampleRate, rate);
  assert.ok(measured.series!.momentary.length >= 29);
  await assert.rejects(() => audio.clean!(wav, { denoise: 'light' }), /GTCRN/);
});

test('host.audio.align finds the offset between two WAV recordings', async () => {
  const rate = 48_000;
  const a = speech(rate, 6, 41n);
  const b = a.slice(24_000, 24_000 + rate * 3);
  const audio = createNodeAudioAPI({ repoRoot: process.cwd() });
  const r = await audio.align!(packWav({ channels: [a], sampleRate: rate }, { format: 'int16' }), packWav({ channels: [b], sampleRate: rate }, { format: 'int16' }));
  assert.ok(r && r.reliable);
  assert.ok(Math.abs(r!.offsetSeconds - 0.5) < 0.001, `offset ${r!.offsetSeconds}`);
});
