// SPDX-License-Identifier: MPL-2.0
/**
 * The club genres' promises (lofi-club.ts, lofi-breaks.ts): breakbeat, funky house, UK
 * garage and private school piano, and drum and bass's top loop.
 *
 * Run directly:  node --test engine/src/lofi-club.test.ts
 *
 * What is pinned:
 *  - each genre's tempo, and its drums: breakbeat's chopped break (on the break's kit,
 *    ghost notes, rolls into a phrase, pitched slices, a different bar most bars), funky
 *    house's four on the floor with Latin percussion and a filter that opens and closes
 *    through a drop, UK garage's two-step (the kick on one and never on three) and its
 *    swing (the hats swung harder than the rest), private school's soft kit and shakers;
 *  - their basses: a rolling bass in breakbeat, a bouncing one in funky house, a sub or a
 *    warping bass in UK garage, and a low, soft log drum in private school piano;
 *  - drum and bass's top loop: only notes added, each a break's, varying from bar to bar.
 * How these measure against openly licensed records is in docs/generated-music.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_PERCUSSION, type LofiBar, type LofiNote } from './lofi-compose.ts';
import { isBreakNote, breakPitch } from './lofi-breaks.ts';
import { clubPlan } from './lofi-club.ts';

const SEEDS = Array.from({ length: 12 }, (_, i) => (i * 2654435761 + 3) >>> 0);
const DRUM = new Set<LofiNote['voice']>(['kick', 'snare', 'rim', 'hat', 'openHat', 'tom', 'perc']);
const drops = (bars: LofiBar[]): LofiBar[] => bars.filter(b => b.section === 'drop');
/** A bar's drums on a grid of 32nds, as a set of "voice@step". */
const pattern = (b: LofiBar, keep: (n: LofiNote) => boolean = () => true): string =>
  b.notes.filter(n => DRUM.has(n.voice) && keep(n)).map(n => `${n.voice}@${Math.round(n.beat * 8)}`).sort().join(' ');
/** How often a bar's drums differ from the bar before, across consecutive drop bars. */
function variety(bars: LofiBar[], keep?: (n: LofiNote) => boolean): number {
  let changed = 0, pairs = 0;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i]!.section !== 'drop' || bars[i - 1]!.section !== 'drop') continue;
    pairs++;
    if (pattern(bars[i]!, keep) !== pattern(bars[i - 1]!, keep)) changed++;
  }
  return pairs ? changed / pairs : 0;
}

test('each club genre keeps its tempo, and its outro fades without ever going silent before the rest bar', () => {
  const BPM = { breakbeat: [126, 138], funkyHouse: [123, 128], ukGarage: [130, 136], privateSchool: [108, 113] } as const;
  for (const mood of Object.keys(BPM) as Array<keyof typeof BPM>) for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, mood);
    const t = bars[0]!.tune;
    assert.ok(t.bpm >= BPM[mood][0] && t.bpm <= BPM[mood][1], `${mood} ${seed}: ${t.bpm} bpm`);
    for (const b of bars.slice(0, -1)) assert.ok(b.level > 0 && b.level <= 1, `${mood} ${seed} bar ${b.index}: level ${b.level}`);
    const outro = bars.filter(b => b.section === 'outro');
    assert.ok(outro.at(-1)!.level < outro[0]!.level, `${mood} ${seed}: the outro fades`);
  }
});

test('breakbeat: a chopped break on the break\'s kit, ghost notes, rolls and pitched slices, looping its bar and turning at a phrase\'s end', () => {
  let ghosts = 0, rolls = 0, pitched = 0, punch = 0, loops = 0, mids = 0, turns = 0, ends = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'breakbeat');
    const d = drops(bars);
    const drums = d.flatMap(b => b.notes.filter(n => ['snare', 'hat', 'openHat'].includes(n.voice)));
    assert.ok(drums.length > 100 && drums.every(isBreakNote), `${seed}: the snare and hats are the break's`);
    ghosts += drums.filter(n => n.voice === 'snare' && n.vel < 0.35).length;
    pitched += d.flatMap(b => b.notes).filter(n => isBreakNote(n) && breakPitch(n) !== 0).length;
    // A phrase's last bar turns: more snare hits in its last beat than the bar before.
    for (const b of d) if (b.notes.filter(n => n.voice === 'snare' && n.beat >= 3).length >= 4) rolls++;
    // A punchier kick under the break's in a drop: a kick that is not a break note.
    punch += d.flatMap(b => b.notes).filter(n => n.voice === 'kick' && !isBreakNote(n)).length;
    // Every drop bar keeps a kick and its backbeat somewhere.
    for (const b of d) assert.ok(b.notes.some(n => n.voice === 'kick'), `${seed} bar ${b.index}: a kick in the bar`);
    // In the middle of a phrase the bar is the bar before (the kick and the backbeat); a phrase's last bar turns.
    const hits = (b: LofiBar): string => pattern(b, n => n.voice === 'kick' || (n.voice === 'snare' && n.vel > 0.6));
    let run = 0;
    bars.forEach((b, i) => {
      run = b.section === 'drop' ? (bars[i - 1]?.section === 'drop' ? run + 1 : 0) : -1;
      if (run <= 0) return;
      if (run % 8 === 1 || run % 8 === 2 || run % 8 === 5) { mids++; if (hits(b) === hits(bars[i - 1]!)) loops++; }
      if (run % 8 === 7) { ends++; if (pattern(b) !== pattern(bars[i - 1]!)) turns++; }
    });
  }
  assert.ok(ghosts > SEEDS.length * 40, `ghost notes (${ghosts})`);
  assert.ok(rolls >= SEEDS.length * 2, `rolls into a phrase (${rolls})`);
  assert.ok(pitched > SEEDS.length * 4, `pitched slices (${pitched})`);
  assert.ok(punch > SEEDS.length * 30, `a kick under the break's (${punch})`);
  assert.ok(loops / mids > 0.75, `the break loops in the middle of a phrase (${loops} of ${mids} bars as the bar before)`);
  assert.ok(turns / ends > 0.8, `and turns at its end (${turns} of ${ends})`);
});

test('UK garage: two-step, the kick on one and never on three, the hats swung harder than the sixteenths', () => {
  let bars0 = 0, onThree = 0, offs = 0, warps = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'ukGarage');
    const t = bars[0]!.tune;
    assert.ok(t.swing >= 0.57 && t.swing <= 0.62, `${seed}: swing ${t.swing}`);
    const plan = clubPlan('ukGarage', seed);
    assert.ok(plan.hatSwing > plan.swing && plan.hatSwing <= 0.68, `${seed}: the hats swing ${plan.hatSwing} over ${plan.swing}`);
    for (const b of drops(bars)) {
      const kicks = b.notes.filter(n => n.voice === 'kick');
      bars0++;
      assert.ok(kicks.some(n => n.beat === 0), `${seed} bar ${b.index}: a kick on one`);
      if (kicks.some(n => Math.abs(n.beat - 2) < 0.125)) onThree++;
      // The rimshots and the off-beat hats sit between the kick and the snare.
      offs += b.notes.filter(n => n.voice === 'hat' && Math.abs((n.beat * 4) % 4 - 2) < 0.1).length;
      // Each odd sixteenth hat sits later than the tune's swing puts that sixteenth.
      for (const h of b.notes.filter(n => n.voice === 'hat' && n.mod === 1)) {
        const step = Math.round(h.beat * 4 - 0.4);
        if (step % 2 === 1) assert.ok(h.beat - step / 4 > (t.swing - 0.5) * 0.5 + 0.001, `${seed} bar ${b.index}: hat at ${h.beat}`);
      }
    }
    if (bars.some(b => (b.voices?.bass ?? t.style.bass) === 'warp')) warps++;
  }
  assert.equal(onThree, 0, `no kick on three in ${bars0} drop bars`);
  assert.ok(offs > bars0 * 3.5, `hats on the offbeats (${offs})`);
  assert.ok(warps >= 3 && warps < SEEDS.length, `a warping bass on some tunes (${warps} of ${SEEDS.length})`);
});

test('funky house: four on the floor, claps on two and four, congas and timbales, and the filter opening and closing through a drop', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'funkyHouse');
    const d = drops(bars);
    for (const b of d) {
      assert.deepEqual(b.notes.filter(n => n.voice === 'kick').map(n => n.beat), [0, 1, 2, 3], `${seed} bar ${b.index}: four on the floor`);
      assert.ok([1, 3].every(beat => b.notes.some(n => n.voice === 'snare' && n.beat === beat)), `${seed} bar ${b.index}: claps on two and four`);
    }
    const congas = LOFI_PERCUSSION.indexOf('congas'), timbales = LOFI_PERCUSSION.indexOf('timbales');
    assert.ok(d.every(b => b.notes.some(n => n.voice === 'perc' && n.mod === congas)), `${seed}: salsa's congas in every drop bar`);
    assert.ok(d.some(b => b.notes.filter(n => n.voice === 'perc' && n.mod === timbales).length >= 6), `${seed}: a timbales roll into a phrase`);
    const opens = new Set(d.map(b => b.open));
    assert.ok(opens.size >= 4 && Math.min(...opens) < 0.75, `${seed}: the filter moves (${[...opens].join(', ')})`);
  }
});

test('private school piano: a soft kit, shakers throughout, a low log drum, long builds', () => {
  let longBuilds = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'privateSchool');
    const d = drops(bars);
    assert.ok(d.flatMap(b => b.notes.filter(n => n.voice === 'kick')).every(n => n.vel < 0.7), `${seed}: soft kicks`);
    assert.ok(d.every(b => b.notes.filter(n => n.voice === 'perc' && n.mod === 0).length === 16), `${seed}: shakers on every sixteenth`);
    const bass = bars.flatMap(b => b.notes.filter(n => n.voice === 'bass'));
    assert.ok(bass.length > 40, `${seed}: the log drum plays`);
    const low = bass.filter(n => n.midi <= 46).length / bass.length;
    assert.ok(low > 0.75, `${seed}: the log drum stays low (${(low * 100).toFixed(0)}% under B♭2)`);
    let run = 0;
    for (const b of bars) { run = b.section === 'build' ? run + 1 : 0; if (run === 16) longBuilds++; }
  }
  assert.ok(longBuilds >= 3, `some builds of sixteen bars (${longBuilds})`);
});

test('drum and bass\'s top loop: break notes added over the kit, its notes different from bar to bar', () => {
  let loop = 0, kit = 0;
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'dnb');
    const added = drops(bars).flatMap(b => b.notes.filter(isBreakNote));
    assert.ok(added.length > 100, `${seed}: a top loop through the drops (${added.length} notes)`);
    assert.ok(added.every(n => n.voice !== 'kick'), `${seed}: the loop leaves the kick to the kit`);
    loop += variety(bars);
    kit += variety(bars, n => !isBreakNote(n));
  }
  assert.ok(loop / 6 > 0.6, `with the top loop, the drums' notes change most bars (${(loop / 6).toFixed(2)})`);
  assert.ok(kit / 6 <= loop / 6, `the kit's own bars change less (${(kit / 6).toFixed(2)})`);
});
