// SPDX-License-Identifier: MPL-2.0
/**
 * The chopped breaks (lofi-break-chop.ts) and the jungle genre (lofi-jungle.ts).
 *
 * Run directly:  node --test engine/src/lofi-break-chop.test.ts
 *
 * What is pinned:
 *  - a seed reproduces its take, its plan and every bar of slices;
 *  - a slice note's `mod` reads back as written;
 *  - the takes are a funk drummer's (the kick on one, the backbeat on two and four, ghost
 *    notes between), and each tune's drummer plays their own;
 *  - every slice sits on the grid (a sixteenth plus the drummer's own push or drag, or
 *    exactly on a sixty-fourth for the producer's rolls), inside its bar, and plays until
 *    the next takes over;
 *  - a build's roll ends on the bar line, and the drop starts on the break's kick;
 *  - between the edits the groove loops, so a first drop never turns to mush, and a second
 *    drop edits more than the first;
 *  - jungle's tempo, running order, sub, siren and shouts, and the other styles' samplers:
 *    jungle pitched up, hip-hop not, trip-hop slowed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakTake, chopBar, chopPlan, chopsOf, isSliceNote, readSlice, sliceMod, SLICE_GESTURES, type ChopAt } from './lofi-break-chop.ts';
import { composeLofiTune, LOFI_SHOUTS, type LofiBar } from './lofi-compose.ts';
import { JUNGLE_SIRENS } from './lofi-jungle.ts';

const SEEDS = Array.from({ length: 10 }, (_, i) => (i * 2654435761 + 7) >>> 0);
const at = (section: ChopAt['section'], inSection: number, bars: number, more: Partial<ChopAt> = {}): ChopAt => ({ section, inSection, bars, lastOfBuild: section === 'build' && inSection === bars - 1, alt: false, ringOut: false, level: 1, sb: s => s / 4, ...more });

test('a seed reproduces its take, its plan and its slices', () => {
  for (const seed of SEEDS.slice(0, 4)) {
    assert.deepEqual(breakTake(seed, 'jungle', 168), breakTake(seed, 'jungle', 168));
    const a = chopPlan(seed, 'jungle', 168)!, b = chopPlan(seed, 'jungle', 168)!;
    for (let i = 0; i < 16; i++) assert.deepEqual(chopBar(a, at('drop', i, 16)), chopBar(b, at('drop', i, 16)), `${seed} bar ${i}`);
    assert.deepEqual(composeLofiTune(seed, 'jungle'), composeLofiTune(seed, 'jungle'));
  }
});

test('a slice note reads back as it was written', () => {
  for (const slice of [0, 17, 63]) for (const semis of [-16, -12, 0, 7, 15]) for (const gesture of SLICE_GESTURES) {
    assert.deepEqual(readSlice(sliceMod(slice, semis, gesture)), { slice, semis, gesture });
  }
  assert.equal(readSlice(undefined), null);
  assert.equal(readSlice(96), null, 'an old note-written break is not a slice');
  assert.ok(isSliceNote({ voice: 'snare', beat: 0, dur: 0.25, midi: 0, vel: 0.9, mod: sliceMod(4) }));
  assert.ok(!isSliceNote({ voice: 'keys', beat: 0, dur: 0.25, midi: 60, vel: 0.9, mod: sliceMod(4) }));
});

test('the takes are a funk drummer\'s, and each tune\'s drummer plays their own', () => {
  const ghostSets = new Set<string>();
  for (const seed of SEEDS) {
    const take = breakTake(seed, 'jungle', 168);
    for (const bar of [0, 16, 32, 48]) {
      assert.ok(take.hits.some(h => h.step === bar && h.drum === 'kick'), `${seed}: the kick on one of bar ${bar / 16}`);
      for (const back of [4, 12]) assert.ok(take.hits.some(h => h.step === bar + back && h.drum === 'snare' && h.vel > 0.85), `${seed}: the backbeat at ${bar + back}`);
    }
    const ghosts = take.hits.filter(h => h.drum === 'ghost');
    assert.ok(ghosts.every(h => h.step % 4 !== 0 && h.vel < 0.35), `${seed}: ghost notes are soft and off the beat`);
    ghostSets.add(ghosts.map(h => h.step).join(','));
    // The backbeat sits on the beat or a hair behind it, as the recorded drummers' does.
    const backbeats = take.hits.filter(h => h.drum === 'snare' && h.step % 16 === 4);
    const late = backbeats.reduce((s, h) => s + h.late, 0) / backbeats.length;
    assert.ok(late > -0.01 && late < 0.025, `${seed}: the backbeat a hair behind the beat (${late.toFixed(4)})`);
    assert.ok(!take.hits.some(h => (h.drum as string) === 'crash'), `${seed}: a take carries no crash of its own`);
  }
  assert.ok(ghostSets.size >= SEEDS.length - 1, `the ghost notes differ from tune to tune (${ghostSets.size} of ${SEEDS.length})`);
});

test('every slice sits on the grid, inside its bar, and plays until the next takes over', () => {
  for (const seed of SEEDS) for (const style of ['jungle', 'breakbeat', 'dnb', 'hiphop', 'triphop'] as const) {
    const plan = chopPlan(seed, style, 140);
    if (!plan) continue;
    for (const [section, bars] of [['drop', 16], ['build', 4], ['intro', 8], ['outro', 8]] as const) {
      for (let i = 0; i < bars; i++) {
        const notes = chopBar(plan, at(section, i, bars, { alt: seed % 2 === 0 }));
        const where = `${style} ${seed} ${section} bar ${i}`;
        for (const [k, n] of notes.entries()) {
          const s = readSlice(n.mod)!;
          assert.ok(n.beat >= 0 && n.beat < 4.06, `${where}: ${n.beat} inside the bar`);
          const sixteenth = Math.round(n.beat * 4) / 4;
          const tight = Math.abs(n.beat * 16 - Math.round(n.beat * 16)) < 1e-6;
          const step = Math.round(n.beat * 4);
          const swing = plan.ownFeel || s.slice % 2 === 0 ? 0 : (plan.take.swing - 0.5) * 0.5;
          const ownFeel = Math.abs(n.beat - sixteenth - plan.take.starts[s.slice]! + swing) < 1e-3 || (step === 0 && n.beat === 0);
          assert.ok(tight || ownFeel, `${where}: slice ${s.slice} at ${n.beat} is on the grid or the drummer's own place`);
          const next = notes[k + 1];
          // Until the next slice takes over, or until a silence the producer cut in before the next: never over the next slice.
          if (next) assert.ok(n.beat + n.dur <= next.beat + 2e-3 && (Math.abs(n.beat + n.dur - next.beat) < 2e-3 || n.dur >= 0.2), `${where}: slice at ${n.beat} (${n.dur}) hands over to the next at ${next.beat}`);
          assert.ok(n.dur > 0, `${where}: a slice lasts`);
        }
      }
    }
  }
});

test('a build\'s roll ends on the bar line, and the drop starts on the break\'s kick', () => {
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'jungle');
    bars.forEach((b, i) => {
      if (b.section !== 'build' || bars[i + 1]?.section !== 'drop') return;
      const roll = b.notes.filter(isSliceNote);
      const last = roll.at(-1)!;
      assert.ok(Math.abs(last.beat + last.dur - 4) < 1e-6, `${seed} bar ${i}: the roll runs to the bar line (${last.beat} + ${last.dur})`);
      const fast = roll.filter(n => n.beat >= 3);
      assert.ok(fast.length >= 16 && fast.every(n => n.dur <= 0.0626), `${seed} bar ${i}: sixty-fourths on the last beat (${fast.length})`);
      assert.ok(readSlice(fast.at(-1)!.mod)!.semis > readSlice(roll[0]!.mod)!.semis, `${seed} bar ${i}: the roll climbs`);
      const first = bars[i + 1]!.notes.filter(isSliceNote)[0]!;
      assert.equal(first.voice, 'kick', `${seed} bar ${i + 1}: the drop opens on a kick`);
      assert.ok(first.beat < 0.05, `${seed} bar ${i + 1}: on the downbeat (${first.beat})`);
    });
  }
});

/** A bar's slices as a string, for telling one bar from another. */
const slicesOf = (b: LofiBar): string => b.notes.filter(isSliceNote).map(n => `${readSlice(n.mod)!.slice}${readSlice(n.mod)!.gesture[0]}${readSlice(n.mod)!.semis}@${Math.round(n.beat * 16)}`).join(' ');

test('between the edits the groove loops, and a second drop edits more than the first', () => {
  let first = 0, second = 0, firstBars = 0, secondBars = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'jungle');
    // Each drop's bars against its own groove: the commonest bar on each side of its two-bar loop.
    const drops: LofiBar[][] = [];
    bars.forEach((b, i) => { if (b.section !== 'drop') return; if (bars[i - 1]?.section !== 'drop') drops.push([]); drops.at(-1)!.push(b); });
    drops.forEach((run, d) => {
      for (const side of [0, 1]) {
        const mine = run.filter((_, i) => i % 2 === side).map(slicesOf);
        const counts = new Map<string, number>();
        for (const m of mine) counts.set(m, (counts.get(m) ?? 0) + 1);
        const groove = [...counts].sort((x, y) => y[1] - x[1])[0]![0];
        const edited = mine.filter(m => m !== groove).length;
        if (d === 0) { first += edited; firstBars += mine.length; } else { second += edited; secondBars += mine.length; }
      }
    });
  }
  const a = first / firstBars, b = second / secondBars;
  assert.ok(a > 0.2 && a < 0.45, `a first drop is edited every four and eight bars, the groove between (${a.toFixed(2)})`);
  assert.ok(b > a + 0.1, `a second drop edits harder (${b.toFixed(2)} against ${a.toFixed(2)})`);
});

test('jungle: its tempo, its running order, the break and the sub arriving together, a siren and wordless shouts', () => {
  const allowed = new Set(['yeah', 'woo', 'oh', 'whoa'].map(w => LOFI_SHOUTS.indexOf(w as typeof LOFI_SHOUTS[number])));
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'jungle');
    const t = bars[0]!.tune;
    assert.ok(t.bpm >= 160 && t.bpm <= 175, `${seed}: ${t.bpm} bpm`);
    const order = bars.map(b => b.section).filter((s, i, a) => s !== a[i - 1]);
    assert.deepEqual(order, ['intro', 'build', 'drop', 'break', 'build', 'drop', 'outro', 'rest'], `${seed}: ${order.join(' > ')}`);
    const drop = bars.findIndex(b => b.section === 'drop');
    assert.ok(bars.slice(0, drop).every(b => !b.notes.some(n => n.voice === 'bass' && n.beat < 4)) || bars.slice(0, drop).some(b => b.layers.includes('bass')), `${seed}: the sub waits for the drop unless the intro is the sub's`);
    for (const b of bars.filter(x => x.section === 'drop')) {
      assert.ok(b.notes.some(isSliceNote) && b.notes.some(n => n.voice === 'bass'), `${seed} bar ${b.index}: the break and the sub in every drop bar`);
      assert.ok(!b.notes.some(n => (n.voice === 'kick' || n.voice === 'snare' || n.voice === 'hat') && !isSliceNote(n)), `${seed} bar ${b.index}: the drums are the break alone`);
    }
    assert.ok(bars[drop]!.notes.some(n => n.voice === 'crash' && n.beat === 0), `${seed}: the drop opens on a crash`);
    // The breakdown: no break, the sub held long, pads.
    for (const b of bars.filter(x => x.section === 'break')) {
      assert.ok(!b.notes.some(isSliceNote), `${seed} bar ${b.index}: the breakdown has no break`);
      assert.ok(b.notes.filter(n => n.voice === 'bass').every(n => n.dur >= 0.9), `${seed} bar ${b.index}: long sub notes`);
    }
    const sirens = bars.flatMap(b => b.notes.filter(n => n.voice === 'siren'));
    assert.ok(sirens.length >= 2 && sirens.length <= 6, `${seed}: a siren at a few moments (${sirens.length})`);
    assert.ok(sirens.every(n => (n.mod ?? 0) < JUNGLE_SIRENS.length), `${seed}: each siren a kind`);
    const shouts = bars.flatMap(b => b.notes.filter(n => n.voice === 'hey'));
    assert.ok(shouts.every(n => allowed.has(n.mod ?? -1)), `${seed}: only wordless or generic shouts (${shouts.map(n => n.mod).join(',')})`);
    // The first drop's bass is long: most of its notes a beat or more (a second drop may roll).
    const bass = bars.slice(0, bars.findIndex(b => b.section === 'break')).flatMap(b => b.notes.filter(n => n.voice === 'bass'));
    const held = bass.filter(n => n.dur >= 0.9).reduce((x, n) => x + n.dur, 0) / bass.reduce((x, n) => x + n.dur, 0);
    assert.ok(held > 0.6, `${seed}: a dub sub, most of its time in long notes (${held.toFixed(2)})`);
  }
});

test('each style\'s sampler: jungle pitched up, drum and bass a little, hip-hop not, trip-hop slowed', () => {
  for (const seed of SEEDS) {
    assert.ok(168 / breakTake(seed, 'jungle', 168).bpm > 1.15, `${seed}: jungle's break sped up`);
    const hip = 90 / breakTake(seed, 'hiphop', 90).bpm;
    assert.ok(hip > 0.9 && hip < 1.03, `${seed}: hip-hop's break at about its own speed (${hip.toFixed(3)})`);
    assert.ok(84 / breakTake(seed, 'triphop', 84).bpm < 0.92, `${seed}: trip-hop's break slowed`);
  }
  // Which tunes chop: every jungle and breakbeat tune, some drum and bass and hip-hop tunes, most trip-hop ones.
  const share = (mood: string): number => Array.from({ length: 300 }, (_, s) => (chopsOf(mood, s, 120) ? 1 : 0) as number).reduce((x, y) => x + y, 0) / 300;
  assert.equal(share('jungle'), 1);
  assert.equal(share('breakbeat'), 1);
  assert.ok(share('dnb') > 0.2 && share('dnb') < 0.5, `drum and bass now and then (${share('dnb')})`);
  assert.ok(share('hiphop') > 0.3 && share('hiphop') < 0.6, `hip-hop some of the time (${share('hiphop')})`);
  assert.ok(share('triphop') > 0.6 && share('triphop') < 0.9, `trip-hop most of the time (${share('triphop')})`);
  assert.equal(chopsOf('rock', 1, 120), null);
});
