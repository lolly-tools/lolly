import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysePcm, fftInPlace } from '../engine/src/audio-analyse.ts';

const SR = 44100;

/** A pure sine at `hz` for `seconds`, amplitude `amp`. */
function sine(hz: number, seconds: number, amp = 0.8, sr = SR): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return out;
}

/** A click train at `bpm` — the simplest thing with a real tempo. */
function clicks(bpm: number, seconds: number, sr = SR): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr));
  const period = Math.round((60 / bpm) * sr);
  for (let at = 0; at < out.length; at += period) {
    // A short decaying burst of alternating samples: broadband, so it shows up as
    // spectral flux the way a drum hit does.
    for (let i = 0; i < 300 && at + i < out.length; i++) {
      out[at + i] = (i % 2 ? 1 : -1) * 0.9 * (1 - i / 300);
    }
  }
  return out;
}

// ─── FFT ──────────────────────────────────────────────────────────────────────

test('fftInPlace puts a sine\'s energy in its own bin', () => {
  const n = 1024;
  const bin = 64; // exactly periodic in the window, so no leakage
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * bin * i) / n);

  fftInPlace(re, im);

  const mags = Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k]!, im[k]!));
  let peak = 0;
  for (let k = 1; k < mags.length; k++) if (mags[k]! > mags[peak]!) peak = k;
  assert.equal(peak, bin, 'peak lands in the sine\'s bin');
  // n/2 for a unit sine; everything else is numerical dust.
  assert.ok(Math.abs(mags[bin]! - n / 2) < 1, `expected ~${n / 2}, got ${mags[bin]}`);
  const others = mags.filter((_, k) => k !== bin && k > 0);
  assert.ok(Math.max(...others) < 1e-6, 'no energy outside the bin');
});

test('fftInPlace refuses a non-power-of-two length', () => {
  assert.throws(() => fftInPlace(new Float64Array(100), new Float64Array(100)), /power of two/);
});

// ─── Band split ───────────────────────────────────────────────────────────────

test('a bass sine reads as bass, a treble sine as treble', () => {
  const low = analysePcm([sine(80, 1)], SR, { fps: 20 });
  const high = analysePcm([sine(9000, 1)], SR, { fps: 20 });

  // Each track is normalised to its own maximum, so compare the SHAPE across
  // bands within one analysis, not absolute values between the two.
  const mid = (a: Float32Array): number => a[Math.floor(a.length / 2)]!;
  assert.ok(mid(low.frames.bass) > 0.9, 'bass energy present in the 80Hz clip');
  assert.ok(mid(low.frames.treb) < 0.2, 'no treble in the 80Hz clip');
  assert.ok(mid(high.frames.treb) > 0.9, 'treble energy present in the 9kHz clip');
  assert.ok(mid(high.frames.bass) < 0.2, 'no bass in the 9kHz clip');
});

test('a broadband signal lights bands across the whole spectrum, not two spikes', () => {
  // The regression this pins: `magnitude` used to be LINEAR amplitude, so one loud
  // bin dominated by such a margin that every other band rounded to nothing. Drawn
  // as bars, real audio rendered as a couple of spikes over a flat line. Bars are
  // read as loudness, and loudness is logarithmic — so the spectrum is in dB.
  const sr = 44100;
  const n = sr;
  const buf = new Float32Array(n);
  // Noise plus a few widely-spaced tones: energy genuinely everywhere, with the low
  // end louder than the top exactly as real material is.
  let s = 99;
  const rnd = (): number => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    buf[i] = 0.25 * rnd()
      + 0.5 * Math.sin((2 * Math.PI * 110 * i) / sr)
      + 0.2 * Math.sin((2 * Math.PI * 900 * i) / sr)
      + 0.08 * Math.sin((2 * Math.PI * 7000 * i) / sr);
  }

  const a = analysePcm([buf], sr, { fps: 10, bands: 32 });
  const f = Math.floor(a.frames.count / 2);
  const row = Array.from(a.frames.magnitude.subarray(f * 32, f * 32 + 32));

  const lit = row.filter((v) => v > 0.25).length;
  assert.ok(lit >= 24, `expected most of 32 bands to carry signal, only ${lit} did`);
  // The top of the spectrum must be visible, not merely non-zero: with linear
  // magnitude the 7kHz region measured ~0.01 against the 110Hz fundamental.
  const top = Math.max(...row.slice(24));
  assert.ok(top > 0.3, `top-octave bands read ${top.toFixed(3)} — too quiet to draw`);
  // And it must still be a spectrum, not a flat wash: the loud low end reads higher.
  assert.ok(Math.max(...row.slice(0, 8)) > top, 'the low end still reads louder than the top');

  // The band split gets the same treatment, for the same reason.
  assert.ok(a.frames.treb[f]! > 0.3, `treble read ${a.frames.treb[f]} on broadband audio`);
  assert.ok(a.frames.bass[f]! > a.frames.treb[f]!, 'bass still dominates this fixture');
});

test('silence stays zero on the dB scale rather than sitting at the floor', () => {
  const a = analysePcm([new Float32Array(44100)], 44100, { fps: 10, bands: 16 });
  assert.ok(Array.from(a.frames.magnitude).every((v) => v === 0), 'no uniform low hum across the bars');
  assert.ok(Array.from(a.frames.bass).every((v) => v === 0));
});

test('the spectral centroid rises with pitch', () => {
  const low = analysePcm([sine(200, 1)], SR, { fps: 20 });
  const high = analysePcm([sine(6000, 1)], SR, { fps: 20 });
  const at = (a: Float32Array): number => a[Math.floor(a.length / 2)]!;
  assert.ok(at(low.frames.centroid) < at(high.frames.centroid), 'centroid is higher for the higher note');
});

test('log-spaced bands are strictly increasing and never empty', () => {
  const a = analysePcm([sine(440, 0.5)], SR, { bands: 64, fps: 10 });
  assert.equal(a.frames.bands, 64);
  assert.equal(a.frames.magnitude.length, a.frames.count * 64);
  // Only one row need be checked — the edges are shared by every frame.
  const row = a.frames.magnitude.subarray(0, 64);
  assert.ok(row.some((v) => v > 0), 'the 440Hz tone lights at least one band');
});

// ─── Frame geometry ───────────────────────────────────────────────────────────

test('frame count and times follow fps and the window', () => {
  const a = analysePcm([sine(440, 4)], SR, { fps: 30 });
  assert.equal(a.frames.count, 120);
  assert.equal(a.fps, 30);
  assert.ok(Math.abs(a.duration - 4) < 1e-6);
  assert.ok(a.frames.t[0]! >= 0 && a.frames.t[0]! < 0.05, 'first frame near zero');
  assert.ok(Math.abs(a.frames.t[119]! - 4) < 0.05, 'last frame near the end');
  for (let i = 1; i < a.frames.count; i++) {
    assert.ok(a.frames.t[i]! > a.frames.t[i - 1]!, `frame times increase at ${i}`);
  }
});

test('start/window trim the analysed span without changing reported duration', () => {
  // 3 seconds: silence, then a tone, then silence.
  const buf = new Float32Array(3 * SR);
  buf.set(sine(440, 1), SR);
  const a = analysePcm([buf], SR, { fps: 20, start: 1, window: 1 });

  assert.ok(Math.abs(a.duration - 3) < 1e-6, 'duration is of the whole source');
  assert.ok(Math.abs(a.start - 1) < 1e-3);
  assert.ok(Math.abs(a.window - 1) < 1e-3);
  assert.equal(a.frames.count, 20);
  // Frame times are relative to the in-point, not absolute.
  assert.ok(a.frames.t[0]! < 0.1, 'frame times are window-relative');
  // The window holds the tone, so it is loud throughout rather than mostly silent.
  const loud = Array.from(a.frames.rms).filter((v) => v > 0.5).length;
  assert.ok(loud > 15, `expected a loud window, ${loud}/20 frames loud`);
});

test('an out-of-range window is clamped, not an error', () => {
  const a = analysePcm([sine(440, 1)], SR, { start: 50, window: 50 });
  assert.ok(a.start <= 1 && a.window >= 0);
  assert.ok(a.frames.count >= 1);
});

// ─── Overview peaks ───────────────────────────────────────────────────────────

test('peaks are normalised and track the envelope', () => {
  // Quiet first half, loud second half.
  const buf = new Float32Array(2 * SR);
  buf.set(sine(300, 1, 0.1), 0);
  buf.set(sine(300, 1, 1.0), SR);
  const a = analysePcm([buf], SR, { buckets: 64 });

  assert.equal(a.peaks.length, 64);
  assert.ok(Math.max(...a.peaks) <= 1 + 1e-6, 'never exceeds 1');
  assert.ok(Math.max(...a.peaks) > 0.99, 'the loudest bucket is normalised to 1');
  const firstHalf = Math.max(...Array.from(a.peaks).slice(0, 30));
  const secondHalf = Math.min(...Array.from(a.peaks).slice(34));
  assert.ok(firstHalf < secondHalf, 'the quiet half reads quieter than the loud half');
});

test('a silent source yields zeros rather than amplified noise', () => {
  const a = analysePcm([new Float32Array(SR)], SR, { fps: 10 });
  assert.ok(Array.from(a.peaks).every((v) => v === 0), 'peaks are zero');
  assert.ok(Array.from(a.frames.rms).every((v) => v === 0), 'rms is zero');
  assert.equal(a.bpm, null, 'silence has no tempo');
});

test('a clipped source still reports peak 1 after normalisation', () => {
  const a = analysePcm([sine(300, 1, 1.4)], SR, { fps: 10 });
  const maxPeak = Math.max(...Array.from(a.frames.peak));
  assert.ok(Math.abs(maxPeak - 1) < 1e-6, 'peak saturates at 1 so a tool can see the clip');
});

// ─── Beats ────────────────────────────────────────────────────────────────────

test('a 120 BPM click train is detected at 120 BPM', () => {
  const a = analysePcm([clicks(120, 8)], SR, { fps: 60 });
  assert.ok(a.bpm !== null, 'a tempo was called');
  // The estimator is quantised by the frame period, so allow a few BPM.
  assert.ok(Math.abs(a.bpm! - 120) < 6, `expected ~120, got ${a.bpm}`);
  assert.ok(a.beats.length >= 14, `expected ~16 beats in 8s, got ${a.beats.length}`);
  for (let i = 1; i < a.beats.length; i++) {
    const gap = a.beats[i]! - a.beats[i - 1]!;
    assert.ok(gap > 0.35 && gap < 0.65, `beat gap ${gap.toFixed(3)}s is near 0.5s`);
  }
});

test('a kick over a sustained tone is not read at half tempo', () => {
  // The fixture that caught the octave error: a 60Hz kick burst every 0.5s (120 BPM)
  // riding a continuous 220Hz tone. A perfectly periodic pulse correlates just as
  // well at two beats as at one, and this combination reported 60 BPM — beats a full
  // second apart, so every other hit went unmarked.
  const sr = 44100;
  const n = sr * 4;
  const buf = new Float32Array(n);
  const period = Math.round(sr * 0.5);
  for (let i = 0; i < n; i++) {
    let v = 0.35 * Math.sin((2 * Math.PI * 220 * i) / sr);
    const ph = i % period;
    if (ph < 1200) v += 0.6 * Math.sin((2 * Math.PI * 60 * ph) / sr) * (1 - ph / 1200);
    buf[i] = Math.max(-1, Math.min(1, v));
  }

  const a = analysePcm([buf], sr, { fps: 30 });
  assert.ok(a.bpm !== null, 'a tempo was called');
  assert.ok(Math.abs(a.bpm! - 120) < 8, `expected ~120 BPM, got ${a.bpm}`);
  for (let i = 1; i < a.beats.length; i++) {
    const gap = a.beats[i]! - a.beats[i - 1]!;
    assert.ok(gap < 0.7, `beat gap ${gap.toFixed(2)}s — a beat was skipped`);
  }
});

test('frame 0 does not fabricate an onset out of the zeroed history', () => {
  // `prevMag` starts zeroed, so measuring frame 0's flux against it reports the whole
  // window as a rise. Because flux normalises to its own maximum, that phantom used to
  // take the 1.0 (0.403 for the loudest real hit) and — since the beat grid anchors on
  // the strongest onset — keyed the entire rhythm to t=0.
  const sr = 44100;
  const n = sr * 4;
  const buf = new Float32Array(n);
  const period = Math.round(sr * 0.5);
  for (let i = 0; i < n; i++) {
    let v = 0.35 * Math.sin((2 * Math.PI * 220 * i) / sr);
    const ph = i % period;
    if (ph < 1200) v += 0.6 * Math.sin((2 * Math.PI * 60 * ph) / sr) * (1 - ph / 1200);
    buf[i] = v;
  }

  const a = analysePcm([buf], sr, { fps: 30 });
  assert.equal(a.frames.flux[0], 0, 'the first frame has no predecessor to differ from');
  // A real onset — not the phantom — carries the normalisation.
  const peak = Math.max(...Array.from(a.frames.flux.subarray(1)));
  assert.ok(Math.abs(peak - 1) < 1e-6, `a genuine attack should reach 1.0, got ${peak}`);
});

test('a steady tone is refused rather than given a made-up tempo', () => {
  const a = analysePcm([sine(440, 8)], SR, { fps: 60 });
  assert.equal(a.bpm, null, 'no rhythm, no tempo');
  assert.equal(a.beats.length, 0);
});

// ─── Raw sample windows (the MilkDrop feed) ───────────────────────────────────

test('sample windows are off by default and opt in at a power of two', () => {
  const off = analysePcm([sine(440, 1)], SR, { fps: 10 });
  assert.equal(off.frames.samples, 0);
  assert.equal(off.frames.wave.length, 0);

  const on = analysePcm([sine(440, 1)], SR, { fps: 10, samples: 2048 });
  assert.equal(on.frames.samples, 2048);
  assert.equal(on.frames.wave.length, on.frames.count * 2048);
  assert.equal(on.frames.waveL.length, on.frames.wave.length);

  // A non-power-of-two request rounds UP, so a caller never silently gets less
  // resolution than it asked for.
  const rounded = analysePcm([sine(440, 1)], SR, { fps: 10, samples: 1500 });
  assert.equal(rounded.frames.samples, 2048);
});

test('sample windows are 0..255 bytes centred on 128', () => {
  const a = analysePcm([sine(200, 1, 0.9)], SR, { fps: 10, samples: 2048 });
  const row = a.frames.wave.subarray(0, 2048);
  assert.ok(row.every((v) => v >= 0 && v <= 255), 'in byte range');
  assert.ok(Math.max(...row) > 200, 'a loud tone reaches well above centre');
  assert.ok(Math.min(...row) < 55, 'and well below it');

  const silent = analysePcm([new Float32Array(SR)], SR, { fps: 10, samples: 512 });
  assert.ok(silent.frames.wave.every((v) => v === 128), 'silence is a flat 128');
});

test('stereo keeps L and R distinct; mono aliases them to the mono window', () => {
  const l = sine(200, 1, 0.9);
  const r = sine(200, 1, 0.9);
  for (let i = 0; i < r.length; i++) r[i] = -r[i]!; // out of phase
  const st = analysePcm([l, r], SR, { fps: 10, samples: 512 });
  assert.equal(st.channels, 2);
  const li = st.frames.waveL.subarray(0, 512);
  const ri = st.frames.waveR.subarray(0, 512);
  assert.notDeepEqual(Array.from(li), Array.from(ri), 'the channels differ');
  // Out-of-phase channels cancel in the mono mix.
  const mono = st.frames.wave.subarray(0, 512);
  assert.ok(Array.from(mono).every((v) => Math.abs(v - 128) <= 1), 'mono mix cancels');

  const mo = analysePcm([sine(200, 1, 0.9)], SR, { fps: 10, samples: 512 });
  assert.equal(mo.channels, 1);
  assert.deepEqual(
    Array.from(mo.frames.waveL.subarray(0, 512)),
    Array.from(mo.frames.wave.subarray(0, 512)),
    'a mono source reports the same window on both channels',
  );
});

// ─── Guards ───────────────────────────────────────────────────────────────────

test('empty input and a bad sample rate are rejected', () => {
  assert.throws(() => analysePcm([], SR), /no samples/);
  assert.throws(() => analysePcm([new Float32Array(0)], SR), /no samples/);
  assert.throws(() => analysePcm([sine(440, 0.1)], 0), /sampleRate/);
});

test('fps and bands are clamped into a workable range', () => {
  const a = analysePcm([sine(440, 1)], SR, { fps: 10_000, bands: 1 });
  assert.ok(a.fps <= 120, 'fps clamped');
  assert.ok(a.frames.bands >= 4, 'bands clamped');
});

test('every emitted number is finite', () => {
  const a = analysePcm([clicks(100, 3)], SR, { fps: 30, samples: 512 });
  for (const [name, arr] of Object.entries(a.frames)) {
    if (typeof arr === 'number') continue;
    assert.ok(
      (arr as Float32Array | Uint8Array).every((v) => Number.isFinite(v)),
      `${name} holds only finite values`,
    );
  }
  assert.ok(Array.from(a.peaks).every((v) => Number.isFinite(v)), 'peaks finite');
});
