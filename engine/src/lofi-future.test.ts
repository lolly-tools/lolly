// SPDX-License-Identifier: MPL-2.0
/**
 * How a future-bass chord moves, and how a drop's chords vary (lofi-future.ts).
 *
 * Run directly:  node --test engine/src/lofi-future.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, type LofiBar, type LofiNote } from './lofi-compose.ts';
import { futureBuildEnd, futureDropBar, futureMod, futurePlan, gateOpens, readFuture, FUTURE_BEND, FUTURE_GATES, FUTURE_RATES } from './lofi-future.ts';

function fingerprint(bars: unknown): number {
  const j = JSON.stringify(bars);
  let h = 2166136261;
  for (let i = 0; i < j.length; i++) { h ^= j.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

test('every mod the composer wrote before means what it meant: the wub in swings a beat, plus 16 for a bend', () => {
  for (const rate of [0, 1, 2, 3, 4, 8]) {
    assert.deepEqual(readFuture(rate), { rate, bend: false, dive: false, swell: false, gate: 0 });
    assert.deepEqual(readFuture(rate + FUTURE_BEND), { rate, bend: true, dive: false, swell: false, gate: 0 });
  }
  // The new rate codes: a dotted eighth, quarter-note triplets and sixteenth-note triplets.
  assert.equal(FUTURE_RATES[5], 4 / 3);
  assert.equal(FUTURE_RATES[6], 1.5);
  assert.equal(FUTURE_RATES[7], 6);
});

test('a movement written into a mod reads back the same', () => {
  for (const rate of [0, 3, 5, 7]) for (const gate of [0, 1, 4, 7]) for (const bend of [false, true]) for (const dive of [false, true]) for (const swell of [false, true]) {
    const m = readFuture(futureMod({ rate, gate, bend, dive, swell }));
    assert.deepEqual(m, { rate: FUTURE_RATES[rate], gate, bend, dive, swell });
  }
});

test('a gate opens inside the chord, in its rhythm, and keeps repeating while the chord is held', () => {
  assert.deepEqual(gateOpens(0, 2), [[0, 2]], 'no gate: the chord is open throughout');
  // Three-three-two, twice a bar.
  assert.deepEqual(gateOpens(1, 4).map(([b]) => b), [0, 0.75, 1.5, 2, 2.75, 3.5]);
  for (let g = 1; g < FUTURE_GATES.length; g++) {
    for (const dur of [0.5, 1.96, 3.9]) {
      const opens = gateOpens(g, dur);
      assert.ok(opens.length > 0, `gate ${g}: opens at least once`);
      for (const [b, len] of opens) assert.ok(b >= 0 && len > 0 && b + len <= dur + 1e-9, `gate ${g} over ${dur}: [${b}, ${len}] inside the chord`);
    }
  }
});

test('a tune draws its drops\' plan from its own stream: the same seed, the same plan', () => {
  assert.deepEqual(futurePlan(42), futurePlan(42));
  const plans = new Set(Array.from({ length: 40 }, (_, s) => JSON.stringify({ ...futurePlan(s), seed: 0 })));
  assert.ok(plans.size > 10, `plans vary from tune to tune (${plans.size} of 40)`);
});

const sb = (step: number): number => step / 4;
function chord(beat: number, dur: number, mod = 0): LofiNote[] {
  return [57, 60, 64, 67].map(midi => ({ voice: 'keys', midi, beat, dur, vel: 0.6, ...(mod ? { mod } : {}) }));
}
const A = [...chord(0, 0.71), ...chord(0.75, 0.71), ...chord(1.5, 0.96), ...chord(2.5, 0.46), ...chord(3, 0.96)];
const C = [...chord(0, 1.96), ...chord(2, 1.96)];

test('a drop bar varies its chords and keeps them inside the bar, on the same voicing', () => {
  const plan = futurePlan(7);
  for (let i = 0; i < 16; i++) {
    const bar = futureDropBar(A, C, plan, { i, bars: 16, sb });
    assert.ok(bar.length > 0, `bar ${i}: chords`);
    for (const n of bar) {
      assert.ok([57, 60, 64, 67].includes(n.midi), `bar ${i}: the voicing`);
      assert.ok(n.beat >= 0 && n.beat + n.dur <= 4.0001, `bar ${i}: a chord at ${n.beat} for ${n.dur} stays in the bar`);
      assert.ok(n.vel > 0 && n.vel <= 1);
    }
    // Every chord is the whole voicing.
    const beats = new Map<number, number>();
    for (const n of bar) beats.set(n.beat, (beats.get(n.beat) ?? 0) + 1);
    for (const [beat, count] of beats) assert.equal(count, 4, `bar ${i}, beat ${beat}: the whole chord`);
  }
  // The third bar of each four plays the tune's third figure.
  assert.deepEqual([...new Set(futureDropBar(A, C, plan, { i: 2, bars: 16, sb }).map(n => n.beat))], [0, 2]);
  // The drop's last bar ends on a dive held to the bar's end.
  const last = futureDropBar(A, C, plan, { i: 15, bars: 16, sb });
  const end = last[last.length - 1]!;
  assert.ok(readFuture(end.mod ?? 0).dive, 'the last chord dives');
  assert.ok(end.beat + end.dur > 3.9, 'and is held to the end of the bar');
});

test('the fourth bar of each four turns: a stutter, a gated chord or a triplet run over its end', () => {
  for (const turn of ['stutter', 'gate', 'triplet'] as const) {
    const plan = { ...futurePlan(3), turn };
    const bar = futureDropBar(A, C, plan, { i: 3, bars: 16, sb });
    const late = bar.filter(n => n.beat >= 2.5);
    if (turn === 'stutter') assert.equal(new Set(late.filter(n => n.beat >= 3).map(n => n.beat)).size, 8, 'eight thirty-seconds over the last beat');
    if (turn === 'triplet') assert.equal(new Set(late.map(n => n.beat)).size, 4, 'four triplets');
    if (turn === 'gate') assert.ok(late.length === 0 && bar.some(n => readFuture(n.mod ?? 0).gate === 4), 'a chord chopped in sixteenths');
  }
});

test('a build swells into the drop when the tune swells in, and keeps its breath when it does not', () => {
  const build = chord(0, 3.4, 8);
  const swelling = futureBuildEnd(build, { ...futurePlan(1), swellIn: true }, sb);
  const swell = swelling.filter(n => readFuture(n.mod ?? 0).swell);
  assert.equal(swell.length, 4, 'a swell on the whole chord');
  assert.ok(Math.abs(swell[0]!.beat + swell[0]!.dur - 4) < 1e-9, 'ending on the drop\'s downbeat');
  assert.deepEqual(futureBuildEnd(build, { ...futurePlan(1), swellIn: false }, sb), build);
});

test('Sherbert\'s future chords vary through a drop, and every other note composes as it did', () => {
  // Without its keys, each tune composes as it did before the chords varied: the variations
  // come from the chords' own stream. The console's FM effects (lofi-console.ts) are left out
  // too; they draw from their own stream, but a spin or a moment takes the place of the coin or
  // jump it overlaps, so seeds 1, 2, 7 and 2024 were pinned again when the two met (2026-11-15).
  const before: Record<number, number> = { 1: 2267950884, 2: 1816301300, 3: 321757180, 7: 2898653115, 2024: 44921894 };
  for (const [seed, want] of Object.entries(before)) {
    const bars = composeLofiTune(Number(seed), 'sherbert');
    assert.equal(fingerprint(bars.map(b => ({ ...b, notes: b.notes.filter(n => n.voice !== 'keys' && n.voice !== 'fm') }))), want, `sherbert ${seed}: every note but the keys`);
  }
  let gated = 0, dives = 0, turns = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const bars: LofiBar[] = composeLofiTune(seed, 'sherbert');
    for (const b of bars) {
      if (b.section !== 'drop' || (b.voices?.keys ?? b.tune.style.keys) !== 'future') continue;
      const moves = b.notes.filter(n => n.voice === 'keys').map(n => readFuture(n.mod ?? 0));
      if (moves.some(m => m.gate)) gated++;
      if (moves.some(m => m.dive)) dives++;
      if (b.notes.filter(n => n.voice === 'keys' && n.beat >= 3).length >= 16) turns++;
    }
  }
  assert.ok(gated > 0 && dives > 0 && turns > 0, `gates (${gated}), dives (${dives}) and stutters (${turns}) in the drops`);
});
