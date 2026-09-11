// SPDX-License-Identifier: MPL-2.0
/**
 * Ambience synthesis (lib/ambience-dsp.ts) - the beds behind the player's
 * Atmosphere section. Pure numbers in, PCM out, so this suite tests the real
 * module with no Web Audio stub anywhere.
 *
 * What's worth pinning, in order: nothing that reaches an AudioBuffer may be NaN
 * or over full scale; the loop point must not click or dip; the three noise
 * colours have to actually differ in the direction their names claim; and a bake
 * must be reproducible, because a "why does rain sound different today" bug would
 * be miserable to chase.
 *
 * Runs at 16 kHz (not 48) - every property here is sample-rate-independent, and a
 * third of the samples keeps the whole file well under a second.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeAmbience, ambienceBytes, AMBIENCE_KINDS, AMBIENCE_SECONDS } from './ambience-dsp.ts';

const SR = 16000;

/** Root-mean-square over a window - the level measure used throughout. */
function rms(a: Float32Array, from = 0, to = a.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += a[i]! * a[i]!;
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** Zero crossings per sample: a cheap proxy for "how much high-frequency energy",
 *  which is exactly the axis white / pink / brown are named along. */
function zeroCrossRate(a: Float32Array): number {
  let n = 0;
  for (let i = 1; i < a.length; i++) if ((a[i]! >= 0) !== (a[i - 1]! >= 0)) n++;
  return n / a.length;
}

test('every bed is finite, in range, and the length its loop advertises', () => {
  for (const kind of AMBIENCE_KINDS) {
    const chans = bakeAmbience(kind, SR);
    assert.equal(chans.length, 2, `${kind}: stereo`);
    for (const c of chans) {
      assert.equal(c.length, Math.round(AMBIENCE_SECONDS[kind] * SR), `${kind}: loop length`);
      let peak = 0;
      for (let i = 0; i < c.length; i++) {
        assert.ok(Number.isFinite(c[i]!), `${kind}: sample ${i} is not finite`);
        peak = Math.max(peak, Math.abs(c[i]!));
      }
      assert.ok(peak <= 1, `${kind}: peak ${peak} exceeds full scale`);
      // A bed that normalised to silence would "work" and be useless.
      assert.ok(rms(c) > 0.02, `${kind}: too quiet to hear (rms ${rms(c)})`);
    }
  }
});

test('the two channels are decorrelated - a mono bed in stereo clothing is not stereo', () => {
  // Measured as the MEDIAN of per-window correlations, not one figure over the whole
  // buffer. Singular events (a train's horn, a roll of thunder) are deliberately
  // coherent in both ears - one horn is one horn, and making it independent per
  // channel smears it into two. Those moments are genuinely correlated and should
  // be; what must not be correlated is the bed underneath, which is most of the
  // windows and therefore the median.
  const win = Math.round(0.25 * SR);
  for (const kind of AMBIENCE_KINDS) {
    const [l, r] = bakeAmbience(kind, SR) as [Float32Array, Float32Array];
    const corrs: number[] = [];
    for (let i = 0; i + win <= l.length; i += win) {
      let dot = 0;
      for (let j = i; j < i + win; j++) dot += l[j]! * r[j]!;
      const denom = rms(l, i, i + win) * rms(r, i, i + win);
      if (denom > 0) corrs.push(Math.abs(dot / win / denom));
    }
    corrs.sort((a, b) => a - b);
    const median = corrs[Math.floor(corrs.length / 2)]!;
    assert.ok(median < 0.35, `${kind}: channels correlate at ${median.toFixed(2)}`);
  }
});

test('the loop seam neither clicks nor dips', () => {
  const win = Math.round(0.05 * SR);
  for (const kind of AMBIENCE_KINDS) {
    for (const c of bakeAmbience(kind, SR)) {
      // A click would show up as a step between the last sample and the first - 
      // compare it against the typical sample-to-sample step of the bed itself.
      let steps = 0;
      for (let i = 1; i < c.length; i++) steps += Math.abs(c[i]! - c[i - 1]!);
      const meanStep = steps / (c.length - 1);
      const seamStep = Math.abs(c[0]! - c[c.length - 1]!);
      assert.ok(seamStep < meanStep * 12, `${kind}: seam step ${seamStep} vs mean ${meanStep}`);
      // And an equal-power crossfade keeps the level up across the join; a naive
      // linear fade of uncorrelated noise would leave a hole there. Measured
      // against the bed's own QUIET windows rather than its average: the sparse
      // beds (keyboard, birds, crickets) are mostly gaps by design, so a hushed
      // 50 ms at the seam is only a defect if it is hushed compared with the
      // quietest ordinary moment.
      // The interior windows are the yardstick - the head and tail are what's on
      // trial, so they don't get to set the range they're judged against.
      const windows: number[] = [];
      for (let i = win; i + win * 2 <= c.length; i += win) windows.push(rms(c, i, i + win));
      windows.sort((x, y) => x - y);
      const floor = windows[Math.floor(windows.length * 0.1)]!;
      const ceiling = windows.at(-1)!;
      const head = rms(c, 0, win);
      const tail = rms(c, c.length - win, c.length);
      for (const [name, v] of [['head', head], ['tail', tail]] as const) {
        assert.ok(v > floor * 0.6, `${kind}: ${name} level ${v} dips below the bed's quiet floor ${floor}`);
        // A crossfade that summed instead of crossfading would put a level at the
        // seam that occurs nowhere else in the bed. A loud EVENT landing there is
        // fine - it just has to be no louder than events elsewhere get.
        assert.ok(v < ceiling * 1.5, `${kind}: ${name} level ${v} spikes past anything in the bed itself (${ceiling})`);
      }
    }
  }
});

test('the noise colours are actually coloured - white brighter than pink, pink than brown', () => {
  const white = zeroCrossRate(bakeAmbience('white', SR)[0]!);
  const pink = zeroCrossRate(bakeAmbience('pink', SR)[0]!);
  const brown = zeroCrossRate(bakeAmbience('brown', SR)[0]!);
  assert.ok(white > pink, `white ${white} should cross more often than pink ${pink}`);
  assert.ok(pink > brown, `pink ${pink} should cross more often than brown ${brown}`);
});

test('the scenes sit where their names put them - rain bright, waves deep', () => {
  const rain = zeroCrossRate(bakeAmbience('rain', SR)[0]!);
  const waves = zeroCrossRate(bakeAmbience('waves', SR)[0]!);
  const fire = zeroCrossRate(bakeAmbience('fire', SR)[0]!);
  assert.ok(rain > 0.1, `rain should be a bright hiss, got ${rain}`);
  assert.ok(waves < rain, `waves ${waves} should be deeper than rain ${rain}`);
  assert.ok(fire < rain, `fire ${fire} should be deeper than rain ${rain}`);
});

test('modulated beds breathe, flat noise does not', () => {
  // Compare the loudest and quietest half-second of a bed: a swell shows up as a
  // wide spread, and it is the whole difference between "ocean" and "hiss".
  const spread = (kind: Parameters<typeof bakeAmbience>[0]): number => {
    const c = bakeAmbience(kind, SR)[0]!;
    const win = Math.round(0.5 * SR);
    let lo = Infinity, hi = 0;
    for (let i = 0; i + win <= c.length; i += win) {
      const v = rms(c, i, i + win);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return hi / lo;
  };
  assert.ok(spread('waves') > 2, 'ocean waves should swell');
  assert.ok(spread('wind') > 1.5, 'wind should gust');
  assert.ok(spread('pink') < 1.4, 'pink noise should be steady');
});

test('event beds put their events IN FRONT of the bed, not under it', () => {
  // The failure this pins is a real one, reported by ear: café with no audible
  // crockery, a train with no clacks, a stream with no blops. In every case the
  // events were there but the continuous bed was loud enough to swallow them, and
  // RMS normalisation then set the level from the bed. Measured as the ratio of the
  // loudest short window to the MEDIAN one - "how far the foreground rises above
  // the background" - which is what an ear is actually judging.
  const punch = (kind: Parameters<typeof bakeAmbience>[0]): number => {
    const c = bakeAmbience(kind, SR)[0]!;
    const win = Math.round(0.03 * SR);
    const w: number[] = [];
    for (let i = 0; i + win <= c.length; i += win) w.push(rms(c, i, i + win));
    w.sort((a, b) => a - b);
    return w.at(-1)! / w[Math.floor(w.length / 2)]!;
  };
  for (const kind of ['chimes', 'city', 'train', 'stream', 'keyboard', 'fire'] as const) {
    assert.ok(punch(kind) > 3, `${kind}: peaks only reach ${punch(kind).toFixed(1)}× the median - its events are buried in the bed`);
  }
  // The counter-check: a flat bed has no foreground, and must not sprout one.
  assert.ok(punch('pink') < 2, 'pink noise should have no events at all');
});

test('a bake is reproducible, and a different seed gives a different bed', () => {
  const a = bakeAmbience('rain', SR, 1234)[0]!;
  const b = bakeAmbience('rain', SR, 1234)[0]!;
  assert.deepEqual([...a.subarray(0, 512)], [...b.subarray(0, 512)], 'same seed must bake the same samples');
  const c = bakeAmbience('rain', SR, 4321)[0]!;
  let same = 0;
  for (let i = 0; i < 512; i++) if (a[i] === c[i]) same++;
  assert.ok(same < 64, 'a different seed should produce a different bed');
});

test('the advertised byte cost matches what a bake actually allocates', () => {
  for (const kind of AMBIENCE_KINDS) {
    const chans = bakeAmbience(kind, SR);
    const actual = chans.reduce((n, c) => n + c.length * 4, 0);
    assert.equal(ambienceBytes(kind, SR), actual, `${kind}: byte estimate`);
  }
});
