import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderZzfxm, zzfxG, zzfxM, zzfxR, type ZzfxSong } from '../engine/src/zzfxm.ts';

// A tiny, self-contained song: one soft sine instrument, one pattern of four
// ascending notes, played once. Enough to exercise the whole render path.
const SONG: ZzfxSong = {
  instruments: [[1, 0, 220, 0, 0.1, 0.3]], // volume, randomness, freq, attack, sustain, release
  patterns: [[[0, 0, 12, 15, 17, 19]]], // [instrument, panning, ...notes]
  sequence: [0],
  bpm: 120,
  title: 'test-scale',
};

test('zzfxG generates a non-empty mono sample buffer', () => {
  const buf = zzfxG(1, 0, 220, 0, 0.1, 0.2);
  assert.ok(Array.isArray(buf));
  assert.ok(buf.length > 1000, `expected a substantial buffer, got ${buf.length}`);
  assert.ok(buf.every((s) => Number.isFinite(s)), 'all samples finite');
  assert.ok(Math.max(...buf.map(Math.abs)) > 0, 'buffer is not silent');
});

test('zzfxG with randomness=0 is deterministic', () => {
  const a = zzfxG(1, 0, 330, 0, 0.1, 0.2);
  const b = zzfxG(1, 0, 330, 0, 0.1, 0.2);
  assert.deepEqual(a, b);
});

test('zzfxM renders matching-length stereo channels', () => {
  const [l, r] = zzfxM(SONG.instruments, SONG.patterns, SONG.sequence, SONG.bpm);
  assert.ok(l.length > 0 && r.length > 0, 'both channels have samples');
  assert.equal(l.length, r.length, 'stereo channels are the same length');
});

test('renderZzfxm returns Float32 stereo PCM at zzfxR', () => {
  const pcm = renderZzfxm(SONG);
  assert.ok(pcm.left instanceof Float32Array);
  assert.ok(pcm.right instanceof Float32Array);
  assert.equal(pcm.left.length, pcm.right.length);
  assert.equal(pcm.sampleRate, zzfxR);
  assert.ok(pcm.left.length > zzfxR * 0.4, 'a few notes span a meaningful duration');
  assert.ok(pcm.left.every((s) => Number.isFinite(s)), 'no NaN/Inf leaked into PCM');
  const peak = pcm.left.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  assert.ok(peak > 0.001, `rendered audio should be audible, peak=${peak}`);
  assert.ok(peak <= 1.5, `peak within sane range, got ${peak}`);
});

test('renderZzfxm defaults bpm to 125 when omitted', () => {
  const { bpm, ...noBpm } = SONG;
  void bpm;
  const pcm = renderZzfxm(noBpm);
  assert.ok(pcm.left.length > 0);
});
