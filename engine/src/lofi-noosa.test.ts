// SPDX-License-Identifier: MPL-2.0
/**
 * Noosacore's composer (lofi-noosa.ts) and the wave notes it writes (lofi-waves-notes.ts).
 *
 * Run directly:  node --test engine/src/lofi-noosa.test.ts
 *
 * What is pinned:
 *  - a seed is a tune, its tempo laid back, its running order the shore, the groove, the
 *    swell, the lull and the band leaving;
 *  - the bass carries it: it plays through every groove and swell bar, busier than the keys;
 *  - the surf guitar plays only in odd moments: one to three licks a tune, a bar or two each;
 *  - the sea is always there: the shore's roar under every four bars, waves at irregular gaps,
 *    and a set wave breaking on the first beat of each swell;
 *  - the magpie sings in most tunes, the kookaburra in few;
 *  - a didgeridoo, where there is one, drones under the quiet sections and toots only over
 *    a full swell, in its one rhythm figure;
 *  - a wave note's `mod` reads back, and a wave series is the same whatever stretch is asked for;
 *  - the coast's birds: a whipbird pair in some intros or lulls, lorikeets now and then, both rarer
 *    than the magpie, and their notes' `mod`s read back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, lofiSectionName, LOFI_MOODS, type LofiBar } from './lofi-compose.ts';
import { noosaPlan } from './lofi-noosa.ts';
import { DIDGE_BREATH, DIDGE_DRONE, DIDGE_SWEEP, DIDGE_WA, readBird } from './lofi-straya.ts';
import { readWave, swellBeats, waveMod, waveSeries, WAVE_SWELL } from './lofi-waves-notes.ts';
import { lorikeetMod, readLorikeet, readWhipbird, whipbirdMod } from './lofi-coast-birds.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761 + 5) >>> 0);
const tune = (seed: number): LofiBar[] => composeLofiTune(seed, 'noosa');

test('a seed is a tune: laid back, opening on the shore, a groove, a swell, a lull and the band leaving', () => {
  assert.ok(LOFI_MOODS.includes('noosa'));
  assert.deepEqual(tune(7), tune(7));
  for (const seed of SEEDS) {
    const bars = tune(seed);
    const t = bars[0]!.tune;
    assert.equal(t.mood, 'noosa');
    assert.ok(t.bpm >= 80 && t.bpm <= 102, `${seed}: ${t.bpm} bpm`);
    const order = bars.map(b => b.section).filter((s, i, a) => s !== a[i - 1]);
    assert.equal(order[0], 'intro');
    assert.ok(order.includes('verse') && order.includes('drop') && order.includes('break'), `${seed}: ${order.join(' ')}`);
    assert.equal(order.filter(s => s === 'drop').length, 2, `${seed}: two swells`);
    assert.deepEqual(order.slice(-2), ['outro', 'rest']);
    assert.ok(!bars[0]!.notes.some(n => n.voice === 'bass' || n.voice === 'kick'), `${seed}: the shore alone at the top`);
    for (const b of bars) for (const n of b.notes) {
      assert.ok(Number.isFinite(n.beat) && n.beat >= 0 && n.beat < 4, `${seed} bar ${b.index}: ${n.voice} at ${n.beat}`);
      assert.ok(n.vel > 0 && n.vel <= 1 && Number.isFinite(n.dur) && n.dur >= 0, `${seed} bar ${b.index}: ${n.voice} ${n.vel} ${n.dur}`);
    }
  }
  assert.equal(lofiSectionName('noosa', 'drop'), 'swell');
  assert.equal(lofiSectionName('noosa', 'break'), 'lull');
});

test('the bass carries the tune: through every groove and swell bar, busier than the keys', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = tune(seed);
    const grooves = bars.filter(b => b.section === 'verse' || b.section === 'drop');
    assert.ok(grooves.every(b => b.notes.some(n => n.voice === 'bass')), `${seed}: the bass in every groove bar`);
    const count = (v: string): number => bars.reduce((s, b) => s + b.notes.filter(n => n.voice === v).length, 0);
    assert.ok(count('bass') > count('lead') * 10, `${seed}: bass ${count('bass')}, lead ${count('lead')}`);
    const loud = (v: string): number => { const ns = grooves.flatMap(b => b.notes.filter(n => n.voice === v)); return ns.reduce((s, n) => s + n.vel, 0) / Math.max(1, ns.length); };
    assert.ok(loud('bass') > loud('keys') + 0.2, `${seed}: the bass played harder than the keys (${loud('bass').toFixed(2)} against ${loud('keys').toFixed(2)})`);
    const drops = bars.filter(b => b.section === 'drop');
    const busy = drops.reduce((s, b) => s + b.notes.filter(n => n.voice === 'bass').length, 0) / drops.length;
    assert.ok(busy >= 4, `${seed}: a rolling line, ${busy.toFixed(1)} notes a bar in a swell`);
  }
});

test('the surf guitar plays only in odd moments: one to three licks, a bar or two each', () => {
  for (const seed of SEEDS) {
    const bars = tune(seed);
    const plan = noosaPlan(seed);
    const withLead = bars.filter(b => b.notes.some(n => n.voice === 'lead')).map(b => b.index);
    assert.ok(plan.licks.length >= 1 && plan.licks.length <= 3, `${seed}: ${plan.licks.length} licks`);
    assert.ok(withLead.length >= 1 && withLead.length <= 6, `${seed}: the guitar in ${withLead.length} bars`);
    for (const i of withLead) assert.ok(plan.licks.some(l => i === l || i === l + 1), `${seed}: bar ${i} is a lick's`);
    assert.equal(bars[0]!.tune.style.lead, 'surf', `${seed}: the lead is the surf guitar`);
  }
});

test('the sea: the shore under every four bars, waves at irregular gaps, a set wave on each swell\'s first beat, the breeze in the she-oaks', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = tune(seed);
    const bpm = bars[0]!.tune.bpm;
    const waves = bars.flatMap(b => b.notes.filter(n => n.voice === 'wave').map(n => ({ n, b, w: readWave(n.mod ?? 0) })));
    for (let i = 0; i < bars.length - 1; i += 4) assert.ok(waves.some(x => x.w.kind === 'shore' && x.b.index === i), `${seed}: the shore at bar ${i}`);
    const crashes = waves.filter(x => x.w.kind === 'break').map(x => x.b.index * 4 + x.n.beat + swellBeats(x.w.size, bpm)).sort((a, z) => a - z);
    const gaps = crashes.slice(1).map((c, i) => ((c - crashes[i]!) * 60) / bpm);
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length);
    const river = noosaPlan(seed).place === 'river';
    assert.ok(mean > 4 && mean < 12, `${seed}: a wave every ${mean.toFixed(1)} s (${noosaPlan(seed).place})`);
    if (river) assert.ok(waves.every(x => x.w.kind !== 'break' || x.w.size <= 2), `${seed}: only small waves lap at the river mouth`);
    assert.ok(sd / mean > 0.15, `${seed}: never evenly (spread ${(sd / mean).toFixed(2)})`);
    const swells = bars.filter((b, i) => b.section === 'drop' && bars[i - 1]?.section !== 'drop').map(b => b.index * 4);
    const set = river ? 2 : 3;
    for (const at of swells) assert.ok(waves.some(x => x.w.kind === 'break' && x.w.size === set && Math.abs(x.b.index * 4 + x.n.beat + swellBeats(set, bpm) - at) < 0.01), `${seed}: a set wave breaks on beat ${at}`);
    assert.equal(waves.some(x => x.w.kind === 'dunes'), noosaPlan(seed).breeze, `${seed}: the she-oaks sing when the plan has a breeze`);
  }
});

test('the magpie sings in most tunes, the kookaburra in few, and a didgeridoo drones, tooting only over a full band', () => {
  let magpies = 0, kookaburras = 0, didges = 0;
  const allowed = new Set([DIDGE_DRONE, DIDGE_WA, DIDGE_SWEEP, DIDGE_BREATH]);
  for (const seed of SEEDS) {
    const bars = tune(seed);
    const notes = bars.flatMap(b => b.notes.map(n => ({ n, b })));
    if (notes.some(x => x.n.voice === 'magpie')) magpies++;
    if (notes.some(x => x.n.voice === 'kookaburra')) kookaburras++;
    for (const { b } of notes.filter(x => x.n.voice === 'magpie' && readBird(x.n.mod ?? 0).featured)) assert.ok(b.index === 1 || b.section === 'break', `${seed}: a featured magpie at an airy moment (bar ${b.index}, ${b.section})`);
    const didge = notes.filter(x => x.n.voice === 'didge');
    if (didge.length) didges++;
    assert.equal(didge.length > 0, noosaPlan(seed).didge, `${seed}: the didgeridoo as planned`);
    const figure = noosaPlan(seed).yidaki;
    for (const { n, b } of didge) {
      if (b.index === figure) {
        // The one rhythm figure, over the second swell: its toot only where the band is full and loud.
        assert.equal(b.section, 'drop', `${seed}: the figure plays over a swell`);
        assert.ok(b.notes.some(x => x.voice === 'bass') && b.notes.some(x => x.voice === 'kick'), `${seed}: the band is playing under the toot`);
        continue;
      }
      assert.ok(allowed.has(n.mod ?? 0), `${seed}: only the drone's shapes (${n.mod})`);
      assert.ok(b.section === 'intro' || b.section === 'break' || b.section === 'outro', `${seed}: under a quiet section (${b.section})`);
    }
  }
  assert.ok(magpies >= SEEDS.length * 0.7, `the magpie in ${magpies} of ${SEEDS.length}`);
  assert.ok(kookaburras >= 1 && kookaburras <= SEEDS.length * 0.35, `the kookaburra in ${kookaburras} of ${SEEDS.length}`);
  assert.ok(didges >= 3 && didges <= SEEDS.length * 0.7, `a didgeridoo in ${didges} of ${SEEDS.length}`);
});

test('a wave note reads back, and a series is the same whatever stretch is asked for', () => {
  for (const kind of ['break', 'shore', 'dunes'] as const) for (let d = 0; d < 4; d++) for (let s = 0; s < 4; s++) {
    assert.deepEqual(readWave(waveMod(kind, d, s, 12345)), { kind, distance: d, size: s, take: 12345 });
  }
  const whole = waveSeries(99, 0, 300, { period: 8 });
  const part = waveSeries(99, 100, 200, { period: 8 });
  assert.deepEqual(part, whole.filter(w => w.at >= 100 && w.at < 200));
  const gaps = whole.slice(1).map((w, i) => w.at - whole[i]!.at);
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const cv = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length) / mean;
  assert.ok(mean > 6.5 && mean < 9.5 && cv > 0.15 && cv < 0.45, `gaps ${mean.toFixed(2)} s, spread ${cv.toFixed(2)}`);
  assert.ok(new Set(whole.map(w => w.size)).size >= 3, 'small, medium and big waves, in sets');
  assert.equal(swellBeats(2, 120), WAVE_SWELL[2] * 2);
});

test('the coast\'s birds: a whipbird pair in some tunes\' intro or lull, lorikeets now and then, both rarer than the magpie', () => {
  let whip = 0, lori = 0, magpie = 0;
  for (const seed of SEEDS) {
    const bars = tune(seed);
    const plan = noosaPlan(seed);
    const whips = bars.filter(b => b.notes.some(n => n.voice === 'whipbird'));
    const loris = bars.filter(b => b.notes.some(n => n.voice === 'lorikeet'));
    if (whips.length) whip++;
    if (loris.length) lori++;
    if (bars.some(b => b.notes.some(n => n.voice === 'magpie'))) magpie++;
    assert.deepEqual(whips.map(b => b.index), plan.whipbird, `${seed}: the pair calls where the plan says`);
    for (const b of whips) assert.ok(b.section === 'intro' || b.section === 'break', `${seed}: the pair calls in an intro or a lull, not a ${b.section}`);
    if (whips.length) assert.ok(whips.length === 2, `${seed}: the pair calls twice`);
    for (const b of loris) {
      const n = b.notes.find(x => x.voice === 'lorikeet')!;
      const kind = readLorikeet(n.mod ?? 0).kind;
      assert.ok(kind === 'flypast' ? b.section === 'verse' || b.section === 'drop' : kind === 'chatter' && b.section === 'break', `${seed}: ${kind} in a ${b.section}`);
    }
    for (const b of whips) for (const n of b.notes.filter(x => x.voice === 'whipbird')) assert.ok(readWhipbird(n.mod ?? 0).distance >= 1, `${seed}: the pair is in the trees`);
  }
  assert.ok(whip >= 4 && whip < magpie, `a whipbird pair in ${whip} of ${SEEDS.length}, the magpie in ${magpie}`);
  assert.ok(lori >= 3 && lori < magpie, `lorikeets in ${lori} of ${SEEDS.length}`);
  for (const kind of ['screech', 'chatter', 'flypast'] as const) for (const birds of [1, 4, 8]) assert.deepEqual(readLorikeet(lorikeetMod(kind, birds, 77)), { kind, birds, take: 77 });
  for (const answered of [true, false]) for (const d of [0, 1, 2]) assert.deepEqual(readWhipbird(whipbirdMod(answered, d, 99)), { answered, distance: d, take: 99 });
});
