// SPDX-License-Identifier: MPL-2.0
/**
 * Surf rock's guitars (lib/lofi-surf.ts): the twin amp's tone as fitted, tremolo picking's
 * pace, the glissando's slide fret by fret, and the performer fingering the surf parts.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-surf.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickStep, slideRates, TWIN } from './lofi-surf.ts';
import { perform } from './lofi-perform.ts';
import { composeLofiTune, ELECTRIC_FRET, ELECTRIC_PALM, SURF_GLISS, SURF_TREMOLO } from '../../../../engine/src/lofi-compose.ts';

/** A Web Audio biquad's magnitude (dB) at `f`, by the spec's formulas (a low- or high-pass's Q in dB). */
function biquadDb([type, hz, q, db]: readonly [BiquadFilterType, number, number, number], f: number, sr = 44100): number {
  const w0 = (2 * Math.PI * hz) / sr, A = 10 ** (db / 40), cw = Math.cos(w0), sw = Math.sin(w0);
  const aQ = sw / (2 * q), aQdB = sw / (2 * 10 ** (q / 20)), aS = (sw / 2) * Math.SQRT2;
  let b: number[], a: number[];
  if (type === 'lowpass') { b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + aQdB, -2 * cw, 1 - aQdB]; }
  else if (type === 'highpass') { b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + aQdB, -2 * cw, 1 - aQdB]; }
  else if (type === 'peaking') { b = [1 + aQ * A, -2 * cw, 1 - aQ * A]; a = [1 + aQ / A, -2 * cw, 1 - aQ / A]; }
  else if (type === 'lowshelf') {
    const s = 2 * Math.sqrt(A) * aS;
    b = [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s)];
    a = [(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s];
  } else throw new Error(type);
  const w = (2 * Math.PI * f) / sr;
  const mag = (c: number[]): number => Math.hypot(c[0]! + c[1]! * Math.cos(w) + c[2]! * Math.cos(2 * w), -(c[1]! * Math.sin(w) + c[2]! * Math.sin(2 * w)));
  return 20 * Math.log10(mag(b) / mag(a));
}
const amp = (f: number): number => TWIN.filters.reduce((s, b) => s + biquadDb(b, f), 0) - TWIN.filters.reduce((s, b) => s + biquadDb(b, 1000), 0);

test('the twin\'s tone as fitted: the mids scooped at 1.1 kHz, its presence lifting 4 kHz, its top falling away past 6 kHz', () => {
  assert.ok(amp(1100) < amp(700) && amp(1100) < amp(1650), 'the scoop sits at 1.1 kHz');
  assert.ok(amp(4000) > 8 && amp(4000) < 15, `presence ${amp(4000).toFixed(1)} dB at 4 kHz`);
  assert.ok(amp(8000) < amp(4000) - 15, 'the speakers are falling by 8 kHz');
  assert.ok(amp(60) < amp(200) - 3, 'the open back gives little under 90 Hz');
});

test('tremolo picking keeps time: a sixteenth at surf\'s tempos, 10 to 12 picks a second, where recorded surf leads pick', () => {
  for (const bpm of [148, 160, 182]) {
    const rate = 1 / pickStep(60 / bpm);
    assert.ok(rate >= 9.8 && rate <= 12.2, `${bpm} bpm: ${rate.toFixed(1)} a second`);
    assert.ok(Math.abs(rate - bpm / 15) < 1e-9, 'a sixteenth');
  }
  assert.ok(Math.abs(1 / pickStep(60 / 120) - 12) < 1e-9, 'slower tempos pick in sixteenth triplets');
});

test('a glissando slides down fret by fret: each fret held a moment, never back up', () => {
  const r = slideRates(0, 12);
  assert.equal(r[0], 1);
  assert.ok(Math.abs(r[r.length - 1]! - 0.5) < 0.01, 'an octave down at the end');
  for (let i = 1; i < r.length; i++) assert.ok(r[i]! <= r[i - 1]! + 1e-12, 'never back up');
  const flat = r.slice(1).filter((v, i) => v === r[i]).length;
  assert.ok(flat > r.length / 3, `the finger rests on each fret (${flat} of ${r.length} steps)`);
});

test('the performer fingers the surf parts: the lead keeps its tremolo picking and glissandi on a fret, the rhythm guitar strums its strokes', () => {
  let leads = 0, marked = 0, strokes = 0;
  for (const seed of [3, 11, 29]) {
    const bars = composeLofiTune(seed, 'surf', { keys: 'surf', lead: 'surf' });
    for (const bar of bars) {
      const played = perform(bar, 60 / bar.tune.bpm, 'surf', 'surf');
      for (const n of played) {
        if (n.voice === 'lead') {
          leads++;
          const written = bar.notes.find(w => w.voice === 'lead' && Math.abs(w.beat - n.beat) < 0.01 && w.midi === n.midi);
          if (written?.mod) { marked++; assert.equal((n.mod ?? 0) % ELECTRIC_FRET, written.mod, 'the articulation kept'); }
          assert.ok((n.mod ?? 0) >= ELECTRIC_FRET || n.midi < 65, 'fingered on a fret');
          assert.ok(((n.mod ?? 0) % ELECTRIC_FRET & 3) === 0, 'a surf lead is never bent or slid by the performer');
        }
        if (n.voice === 'keys' && bar.section === 'verse') {
          strokes++;
          assert.ok(((n.mod ?? 0) % ELECTRIC_FRET & ~(ELECTRIC_PALM | 2)) === 0, 'palm-muted or choked');
        }
      }
    }
  }
  assert.ok(leads > 100 && marked > 20 && strokes > 100, `${leads} lead notes, ${marked} marked, ${strokes} verse strokes`);
  assert.ok(SURF_TREMOLO !== SURF_GLISS);
});
