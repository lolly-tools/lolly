// SPDX-License-Identifier: MPL-2.0
/**
 * Record scratches placed (lofi-scratch.ts).
 *
 * Run directly:  node --test engine/src/lofi-scratch.test.ts
 *
 * What is pinned:
 *  - a scratch note's `mod` reads back as written, and a seed places the same scratches;
 *  - only the genres a DJ scratches in scratch: hip-hop most, R&B rarely, breakbeat and
 *    jungle into their drops, trip-hop slowly, funk, nu-disco and UK garage once at most;
 *  - where: hip-hop's hooks on the turnaround of a chorus's four bars, R&B's into a chorus,
 *    breakbeat's and jungle's rewinds and backspins over the last beats before a drop;
 *  - a scratch keeps clear of the other moments, and a pitched one plays a chord tone;
 *  - scratchSource tells a player the record a tune's scratches use before they come.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_MOODS, type LofiBar } from './lofi-compose.ts';
import { readScratch, scratchMod, scratchSource, SCRATCH_KINDS, SCRATCH_SOURCES, SCRATCH_RATES } from './lofi-scratch.ts';

const SEEDS = Array.from({ length: 16 }, (_, i) => (i * 2654435761 + 11) >>> 0);
const scratchesOf = (bars: LofiBar[]) => bars.flatMap((b, i) => b.notes.filter(n => n.voice === 'scratch').map(n => ({ n, i, b })));

test('a scratch note reads back as written, and a seed places the same scratches', () => {
  for (const kind of SCRATCH_KINDS) for (const source of SCRATCH_SOURCES) for (const rate of SCRATCH_RATES) {
    assert.deepEqual(readScratch(scratchMod({ kind, source, rate })), { kind, source, rate });
  }
  for (const mood of ['hiphop', 'jungle'] as const) assert.deepEqual(composeLofiTune(SEEDS[1]!, mood), composeLofiTune(SEEDS[1]!, mood));
});

test('only the genres a DJ scratches in scratch, each as often as its records do', () => {
  const SCRATCHING = new Set(['hiphop', 'rnb', 'breakbeat', 'jungle', 'triphop', 'funk', 'nudisco', 'ukGarage']);
  for (const mood of LOFI_MOODS) {
    if (SCRATCHING.has(mood)) continue;
    for (const seed of SEEDS.slice(0, 3)) assert.equal(scratchesOf(composeLofiTune(seed, mood)).length, 0, `${mood} ${seed} does not scratch`);
  }
  const tunes = (mood: string): { with: number; most: number } => {
    let withAny = 0, most = 0;
    for (const seed of SEEDS) { const n = scratchesOf(composeLofiTune(seed, mood as never)).length; if (n) withAny++; most = Math.max(most, n); }
    return { with: withAny, most };
  };
  const hip = tunes('hiphop'), rnb = tunes('rnb'), funk = tunes('funk'), trip = tunes('triphop');
  assert.ok(hip.with >= SEEDS.length * 0.6, `most hip-hop tunes scratch (${hip.with})`);
  assert.ok(rnb.with < SEEDS.length * 0.6 && rnb.most <= 2, `R&B rarely, once or twice (${rnb.with}, at most ${rnb.most})`);
  assert.ok(funk.most <= 1, `funk once at most (${funk.most})`);
  assert.ok(trip.most <= 2, `trip-hop once or twice (${trip.most})`);
});

test('where: hip-hop hooks on a chorus turnaround, R&B into a chorus, rewinds and backspins up to a drop', () => {
  let hooks = 0, rewinds = 0;
  for (const seed of SEEDS) {
    for (const { n, i, b } of scratchesOf(composeLofiTune(seed, 'hiphop'))) {
      if (b.section === 'drop' && n.beat === 2) {
        hooks++;
        assert.equal(n.dur, 1.5, `hiphop ${seed} bar ${i}: the hook leaves the last half beat`);
      }
    }
    const rnb = composeLofiTune(seed, 'rnb');
    for (const { n, i } of scratchesOf(rnb)) {
      assert.equal(rnb[i + 1]?.section, 'drop', `rnb ${seed} bar ${i}: into a chorus`);
      assert.ok(['chirp', 'baby'].includes(readScratch(n.mod).kind), `rnb ${seed}: a chirp or a baby scratch`);
    }
    for (const mood of ['breakbeat', 'jungle'] as const) {
      const bars = composeLofiTune(seed, mood);
      for (const { n, i } of scratchesOf(bars)) {
        const kind = readScratch(n.mod).kind;
        if (kind === 'rewind' || kind === 'backspin') {
          rewinds++;
          assert.equal(bars[i + 1]?.section, 'drop', `${mood} ${seed} bar ${i}: a ${kind} into a drop`);
          assert.ok(n.beat + n.dur >= 3 && n.beat + n.dur <= 4, `${mood} ${seed}: up to the drop, or to a shout on its last beat`);
        } else assert.ok(kind === 'stab' || kind === 'chirp', `${mood} ${seed}: stabs and chirps over the edits (${kind})`);
      }
    }
    for (const { n } of scratchesOf(composeLofiTune(seed, 'triphop'))) assert.equal(readScratch(n.mod).rate, 2, `triphop ${seed}: slow strokes`);
  }
  assert.ok(hooks >= 10, `scratched hooks in hip-hop choruses (${hooks})`);
  assert.ok(rewinds > 5, `rewinds and backspins into drops (${rewinds})`);
});

test('a scratch keeps clear of the other moments, a pitched one plays a chord tone, and scratchSource foretells the record', () => {
  const OTHERS = new Set(['hey', 'tag', 'magpie', 'kookaburra', 'fm', 'siren', 'game', 'coin']);
  for (const mood of ['hiphop', 'rnb', 'breakbeat', 'jungle', 'triphop', 'funk', 'nudisco', 'ukGarage'] as const) for (const seed of SEEDS.slice(0, 8)) {
    const bars = composeLofiTune(seed, mood);
    const found = scratchesOf(bars);
    for (const { n, i, b } of found) {
      for (const o of b.notes) if (OTHERS.has(o.voice) && o.beat < n.beat + n.dur && o.beat + Math.max(0.25, o.dur) > n.beat) assert.fail(`${mood} ${seed} bar ${i}: a ${o.voice} under the scratch`);
      const s = readScratch(n.mod);
      if (s.source === 'break') assert.equal(n.midi, 0);
      else assert.ok(b.tones.includes(((n.midi % 12) + 12) % 12), `${mood} ${seed} bar ${i}: ${n.midi} is a tone of ${b.chord}`);
    }
    const chops = bars.some(b => b.notes.some(n => (n.mod ?? 0) >= 1 << 16));
    const told = scratchSource(seed, mood, chops);
    if (found.length) assert.equal(told, readScratch(found[0]!.n.mod).source, `${mood} ${seed}: the record foretold`);
  }
});
