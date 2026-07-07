/**
 * audio-coach-core contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in.
 *
 * Exercises the PURE coaching logic that turns a live `AudioLevel` into a
 * `Coaching` verdict (tone / warning / recording-tip cue). The logic lives in a
 * DOM-free core module (shells/web/src/lib/audio-coach-core.ts) precisely so it can
 * be imported here without pulling in the DOM HUD (`mountCoachHud`) or `announce`.
 *
 * Thresholds under test (see audio-coach-core.ts):
 *   normal band  = [quiet 0.05, loud 0.32]   (default target)
 *   NOISY_FLOOR_DBFS = -50   (noiseFloor above this = a noticeable room)
 *   HUM_RATIO        = 0.25  (hum ≥ this = electrical hum)
 *   HISS_FLATNESS    = 0.45  (hiss ≥ this, AND noisy = broadband hiss)
 *   SPEAKING_SNR_DB  = 12    (snr > this = they're talking)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coachAudio } from '../shells/web/src/lib/audio-coach-core.ts';
import type { AudioLevel } from '../engine/src/bridge/host-v1.ts';

// Build a minimal AudioLevel. Required fields default to a benign, quiet-ish
// mid-level; each test overrides only what it's probing. Optional spectral fields
// (noiseFloor/snr/hum/hiss) are omitted unless a test sets them.
function level(over: Partial<AudioLevel> = {}): AudioLevel {
  return {
    rms: 0.15, peak: 0.3, dbfs: -12, clipping: false, t: 0,
    ...over,
  };
}

// ─── level coaching: clipping / too loud / too quiet ──────────────────────────

test('clipping → tone hot + level cue (in either phase)', () => {
  const c = coachAudio(level({ clipping: true, peak: 1 }));
  assert.equal(c.tone, 'hot');
  assert.equal(c.cue, 'level');
  assert.match(c.warning, /clipping/i);
});

test('rms above the normal loud bound → tone hot + level cue', () => {
  // normal loud bound is 0.32; 0.4 is over it, not clipping.
  const c = coachAudio(level({ rms: 0.4, clipping: false }));
  assert.equal(c.tone, 'hot');
  assert.equal(c.cue, 'level');
  assert.notEqual(c.warning, '');
});

test('too quiet in phase record → tone low + distance cue', () => {
  // normal quiet bound is 0.05; 0.02 is under it. No snr → speaking = rms > quiet = false.
  const c = coachAudio(level({ rms: 0.02 }), { phase: 'record' });
  assert.equal(c.tone, 'low');
  assert.equal(c.cue, 'distance');
  assert.match(c.warning, /quiet/i);
});

// ─── room judgement during the sound-check (phase 'check') ────────────────────

test('silent noisy room in phase check → room cue + noisy warning', () => {
  // Quiet mic (no speech), a floor above -50 dBFS = a noticeable room.
  const c = coachAudio(level({ rms: 0.01, noiseFloor: -40, snr: 2 }), { phase: 'check' });
  assert.equal(c.tone, 'low');
  assert.equal(c.cue, 'room');
  assert.match(c.warning, /noisy room/i);
});

test('silent room with mains hum in phase check → room cue + hum warning', () => {
  const c = coachAudio(
    level({ rms: 0.01, noiseFloor: -40, snr: 2, hum: 0.4 }),
    { phase: 'check' },
  );
  assert.equal(c.cue, 'room');
  assert.match(c.warning, /hum/i);
});

test('silent room with broadband hiss in phase check → wind cue + hiss warning', () => {
  // hiss ≥ 0.45 AND a noisy floor (> -50) → hissy. No hum so it takes the hiss branch.
  const c = coachAudio(
    level({ rms: 0.01, noiseFloor: -40, snr: 2, hiss: 0.6 }),
    { phase: 'check' },
  );
  assert.equal(c.cue, 'wind');
  assert.match(c.warning, /hiss/i);
});

test('the SAME noisy room in phase record does NOT warn', () => {
  // Identical noisy floor, but during the take: room noise is a pre-record concern
  // (and the record session suppresses it), so it must not warn on the level alone.
  const noisy = { rms: 0.15, noiseFloor: -40, snr: 20 };
  const check = coachAudio(level(noisy), { phase: 'check' });
  const record = coachAudio(level(noisy), { phase: 'record' });
  // In record, an in-band level with a good snr → nothing to say.
  assert.equal(record.warning, '');
  assert.equal(record.tone, 'ok');
  assert.equal(record.cue, null);
  // Sanity: the check phase over a good speaking level suppresses room too (next test),
  // so cross-check that the noisy floor is only actionable when genuinely silent.
  assert.equal(check.cue, 'project');
});

test('speaking (snr above 12) suppresses room warnings in phase check', () => {
  // Same noisy floor, but snr 20 > 12 → they're talking. The room branch is gated on
  // !speaking, so no hum/hiss/noisy warning; a clean speaking level → nothing to say.
  const c = coachAudio(
    level({ rms: 0.15, noiseFloor: -40, snr: 20, hum: 0.4, hiss: 0.6 }),
    { phase: 'check' },
  );
  assert.equal(c.warning, '');
  assert.equal(c.tone, 'ok');
  // Speaking over a noisy room during the check nudges 'project', never a room warning.
  assert.equal(c.cue, 'project');
});

// ─── steady drone vs modulated speech (v1.20 `steady`) ────────────────────────

test('a steady mid-level drone in phase check → fan cue (not "speaking")', () => {
  // steady ≥ 0.6 at an audible level = a constant source (fan/AC/hiss). Even with a high
  // snr (a min-hold floor keeps it high for a constant tone) it must NOT read as speaking.
  const c = coachAudio(level({ rms: 0.15, steady: 0.8, snr: 20, noiseFloor: -40 }), { phase: 'check' });
  assert.equal(c.cue, 'fan');
  assert.equal(c.tone, 'low');
  assert.match(c.warning, /steady|fan|noise/i);
});

test('the SAME level but modulated (low steady) reads as speaking, not a drone', () => {
  // Identical loud-ish level + snr, but steady 0.1 = modulated (speech) → not droning.
  const c = coachAudio(level({ rms: 0.15, steady: 0.1, snr: 20, noiseFloor: -40 }), { phase: 'check' });
  assert.notEqual(c.cue, 'fan');
  assert.equal(c.cue, 'project'); // speaking over a noisy floor during the check
});

test('a steady signal below the audible level is not flagged as a drone', () => {
  // rms 0.02 < quiet 0.05 → not audible enough to be a drone, even at steady 0.9.
  const c = coachAudio(level({ rms: 0.02, steady: 0.9, snr: 2, noiseFloor: -70 }), { phase: 'check' });
  assert.notEqual(c.cue, 'fan');
});

test('steady absent → no droning; snr-based speaking still holds', () => {
  // No steady field → the droning guard is false → falls back to snr-based speaking.
  const c = coachAudio(level({ rms: 0.15, snr: 20, noiseFloor: -40 }), { phase: 'check' });
  assert.notEqual(c.cue, 'fan');
  assert.equal(c.cue, 'project');
});

// ─── robustness: optional spectral fields absent ──────────────────────────────

test('an AudioLevel missing all optional spectral fields does not throw', () => {
  // No noiseFloor/snr/hum/hiss at all — the guards must treat each as absent.
  const bare: AudioLevel = { rms: 0.15, peak: 0.3, dbfs: -12, clipping: false, t: 0 };
  assert.doesNotThrow(() => coachAudio(bare, { phase: 'check' }));
  const c = coachAudio(bare, { phase: 'check' });
  // In-band level, no spectral data → nothing to flag.
  assert.equal(c.warning, '');
  assert.equal(c.tone, 'ok');
  assert.equal(c.cue, null);
});

test('silence with no signal reads −∞ dB and does not throw', () => {
  const c = coachAudio(level({ rms: 0, peak: 0, dbfs: -Infinity }), { phase: 'record' });
  assert.match(c.dbText, /∞/);
  assert.equal(c.barPct, 0);
});
