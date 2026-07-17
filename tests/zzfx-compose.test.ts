/**
 * Tests for engine/src/zzfx-compose.ts — the ZzFXM composer moved into the
 * engine from scripts/lib/zzfx-music.ts (1.60.0). Covers: a composed song is
 * renderable (renderZzfxm → non-empty, non-silent, in-range PCM) for every
 * archetype; composition is deterministic; the arrangement honours targetSec;
 * and the scripts/lib shim re-exports the exact same functions so the
 * generator scripts keep working identically. Imports through the engine
 * barrel so the export wiring is exercised too.
 *
 * Run with: node --test tests/zzfx-compose.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  composeSong, PRESETS, SCALES, mulberry32, patternSeconds, renderZzfxm,
} from '../engine/src/index.ts';
import type { SongSpec, Archetype } from '../engine/src/index.ts';
import * as shim from '../scripts/lib/zzfx-music.ts';

const SPEC: SongSpec = {
  archetype: 'melodic',
  seed: 0x1a2b3c,
  bpm: 90,
  scale: 'majorPent',
  roots: [12, 19],
  targetSec: 8,
};

const ARCHETYPES: Archetype[] = [
  'ambient', 'rhythmic', 'melodic', 'drumAndBass', 'jungle', 'classical',
  'spanishGuitar', 'cuban', 'bossaNova', 'whimsical', 'chiptune', 'lofi',
];

test('composeSong from the engine barrel renders to non-empty PCM', () => {
  const song = composeSong(SPEC);
  assert.equal(song.bpm, SPEC.bpm);
  assert.ok(song.patterns.length === SPEC.roots.length, 'one pattern per root');
  assert.ok(song.sequence.length >= song.patterns.length, 'arranged sequence reuses patterns');

  const pcm = renderZzfxm(song);
  assert.ok(pcm.left.length > 0, 'non-empty PCM');
  assert.equal(pcm.left.length, pcm.right.length, 'stereo channels match');
  let peak = 0;
  for (let i = 0; i < pcm.left.length; i++) {
    peak = Math.max(peak, Math.abs(pcm.left[i]!), Math.abs(pcm.right[i]!));
  }
  assert.ok(peak > 0.02, `audible (peak ${peak})`);
  assert.ok(peak <= 1, `not clipping (peak ${peak})`);
});

test('every archetype composes a renderable song', () => {
  for (const archetype of ARCHETYPES) {
    const song = composeSong({ ...SPEC, archetype });
    const pcm = renderZzfxm(song);
    assert.ok(pcm.left.length > 0, `${archetype}: non-empty PCM`);
    let peak = 0;
    for (let i = 0; i < pcm.left.length; i += 7) peak = Math.max(peak, Math.abs(pcm.left[i]!));
    assert.ok(peak > 0.001, `${archetype}: not silent`);
  }
});

test('composeSong is deterministic (byte-stable song data)', () => {
  assert.deepEqual(composeSong(SPEC), composeSong(SPEC));
  assert.notDeepEqual(composeSong(SPEC), composeSong({ ...SPEC, seed: SPEC.seed + 1 }));
});

test('arrangement approximates targetSec via pattern reuse', () => {
  const song = composeSong({ ...SPEC, targetSec: 20 });
  assert.equal(song.bpm, SPEC.bpm); // composeSong always stamps the spec bpm
  const sec = song.sequence.length * patternSeconds(SPEC.bpm);
  // arrange() rounds to whole patterns with a numPatterns*2 floor — allow one pattern of slack.
  assert.ok(Math.abs(sec - 20) <= patternSeconds(SPEC.bpm), `~20s arrangement (got ${sec.toFixed(1)}s)`);
});

test('scripts/lib/zzfx-music.ts is a pure re-export shim of the engine module', () => {
  // Same function identities, not copies — the generator scripts (gen-music.ts)
  // keep producing byte-identical output through either path.
  assert.equal(shim.composeSong, composeSong);
  assert.equal(shim.PRESETS, PRESETS);
  assert.equal(shim.SCALES, SCALES);
  assert.equal(shim.mulberry32, mulberry32);
  assert.equal(shim.patternSeconds, patternSeconds);
});
