// SPDX-License-Identifier: MPL-2.0
/**
 * Where the console's FM effects go (lofi-console.ts).
 *
 * Run directly:  node --test engine/src/lofi-console.test.ts
 *
 * What is pinned:
 *  - an `fm` note's `mod` reads back as it was written;
 *  - only Sugar, chiptune and Sherbert play them, and K-pop and synthwave borrow one moment
 *    now and then; every other style's tune is left exactly as it was;
 *  - at most one moment for each drop, in the bar before it, never the same one twice in a
 *    tune, starting by beat 3, and never in a bar that already has a bird, a producer's tag,
 *    a shouted phrase or a vocal stutter; the console's own sounds give way where it plays;
 *  - shots go off the beat, where no lead note starts, inside a drop (or Sherbert's breakdown),
 *    at least four bars apart and a few a tune;
 *  - the same seed places the same effects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_MOODS, type LofiBar, type LofiMood } from './lofi-compose.ts';
import { fmMod, readFm, withConsoleFx, LOFI_FM_FX, LOFI_FM_MOMENTS } from './lofi-console.ts';

const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 2654435761 + 31) >>> 0);
const GAMES = ['sugar', 'chiptune', 'sherbert'] as const;
const fmOf = (bar: LofiBar) => bar.notes.filter(n => n.voice === 'fm').map(n => ({ n, fm: readFm(n.mod ?? 0) }));
const isMoment = (kind: string): boolean => (LOFI_FM_MOMENTS as readonly string[]).includes(kind);
const SHOTS = new Set(['pew', 'beam', 'charged']);

test('an fm note\'s mod reads back as it was written', () => {
  for (const kind of LOFI_FM_FX) for (const count of [1, 2, 3, 4]) for (const side of [-1, 1] as const) for (const third of [3, 4, 5] as const) for (const fifth of [6, 7, 8] as const) {
    const fm = readFm(fmMod({ kind, count, side, third, fifth, whoosh: count % 2 === 0, figure: count % 3 }));
    assert.deepEqual(fm, { kind, count, side, third, fifth, whoosh: count % 2 === 0, figure: count % 3 });
  }
});

test('only the game styles play them, K-pop and synthwave borrow a moment, and every other style is left as it was', () => {
  for (const mood of LOFI_MOODS) {
    const bars = composeLofiTune(2024, mood);
    if (GAMES.includes(mood as typeof GAMES[number]) || mood === 'kpop' || mood === 'synthwave') continue;
    assert.ok(!bars.some(b => b.notes.some(n => n.voice === 'fm')), `${mood}: no console FM`);
    assert.equal(withConsoleFx(bars, 2024, mood), bars, `${mood}: the same bars back`);
  }
});

test('one moment at most before each drop, a different one each time, in its own bar', () => {
  for (const mood of GAMES) {
    let tunes = 0;
    for (const seed of SEEDS) {
      const bars = composeLofiTune(seed, mood);
      const kinds: string[] = [];
      bars.forEach((b, i) => {
        const moments = fmOf(b).filter(x => isMoment(x.fm.kind));
        if (!moments.length) return;
        const where = `${mood} ${seed} bar ${i}`;
        assert.equal(moments.length, 1, `${where}: one moment`);
        assert.equal(bars[i + 1]?.section, 'drop', `${where}: the bar before a drop`);
        assert.notEqual(b.section, 'drop', `${where}: not inside one`);
        const { n, fm } = moments[0]!;
        assert.ok(n.beat <= 3, `${where}: starts by beat 3 (${n.beat}), leaving the breath before the drop`);
        assert.ok(!b.notes.some(x => (x.voice === 'game' || x.voice === 'coin') && x.beat >= n.beat - 0.5), `${where}: the console's own sounds give way`);
        assert.ok(!b.notes.some(x => x.voice === 'magpie' || x.voice === 'kookaburra' || x.voice === 'tag'), `${where}: a bird or the tag is that drop's moment`);
        assert.ok(!b.notes.some(x => x.voice === 'hey' && (x.mod ?? 0) % 16 >= 9), `${where}: so is a shouted phrase`);
        kinds.push(fm.kind);
      });
      assert.equal(new Set(kinds).size, kinds.length, `${mood} ${seed}: no moment twice (${kinds.join(', ')})`);
      if (kinds.length) tunes++;
    }
    // Sherbert's builds mostly end on its own chopped stutter (two tunes in three), a magpie
    // or the tag, which are those drops' moments, so only about one drop in nine gets one.
    assert.ok(tunes >= (mood === 'sherbert' ? 1 : 34), `${mood}: most tunes have a moment (${tunes} of ${SEEDS.length})`);
  }
});

test('a vocal stutter at the end of a build is that drop\'s moment', () => {
  let stutters = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'sherbert');
    bars.forEach((b, i) => {
      if (bars[i + 1]?.section !== 'drop' || b.section === 'drop') return;
      if (b.notes.filter(n => n.voice === 'lead' && n.beat >= 3 && n.dur <= 0.15).length < 4) return;
      stutters++;
      assert.ok(!fmOf(b).some(x => isMoment(x.fm.kind)), `sherbert ${seed} bar ${i}: no moment over the stutter`);
    });
  }
  assert.ok(stutters > 10, `stutters seen (${stutters})`);
});

test('shots go off the beat where no lead note starts, inside a drop, four bars apart, a few a tune', () => {
  for (const mood of GAMES) {
    let shots = 0, beams = 0;
    for (const seed of SEEDS) {
      const bars = composeLofiTune(seed, mood);
      let last = -99, count = 0;
      bars.forEach((b, i) => {
        for (const { n, fm } of fmOf(b)) {
          if (!SHOTS.has(fm.kind)) continue;
          const where = `${mood} ${seed} bar ${i} ${fm.kind}`;
          assert.ok(b.section === 'drop' || (mood === 'sherbert' && b.section === 'break'), `${where}: in a drop (${b.section})`);
          assert.ok(Math.abs(n.beat * 2 - Math.round(n.beat * 2)) < 1e-9 && Math.abs(n.beat - Math.round(n.beat)) > 0.25, `${where}: off the beat (${n.beat})`);
          const starts = b.notes.filter(x => x.voice === 'lead').map(x => x.beat);
          assert.ok(!starts.some(x => x > n.beat - 0.25 && x < n.beat + 0.75), `${where}: no lead note starts on the shot (${starts.join(' ')} against ${n.beat})`);
          assert.ok(i - last >= 4, `${where}: four bars after the last (${last})`);
          last = i;
          count++;
          if (fm.kind === 'beam') beams++;
        }
      });
      assert.ok(count <= (mood === 'sherbert' ? 2 : 4), `${mood} ${seed}: a few shots (${count})`);
      shots += count;
    }
    assert.ok(shots >= (mood === 'sherbert' ? 15 : 60), `${mood}: shots through the tunes (${shots} in ${SEEDS.length})`);
    assert.ok(beams >= 5, `${mood}: some of them long beams (${beams})`);
  }
});

test('spins charge up into a build from the bar before it, or into a shot', () => {
  let spins = 0;
  for (const mood of GAMES) for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, mood);
    bars.forEach((b, i) => {
      for (const { n, fm } of fmOf(b)) {
        if (fm.kind !== 'spin') continue;
        spins++;
        const intoBuild = bars[i + 1]?.section === 'build' && b.section !== 'build' && n.beat === 2 && n.dur === 2;
        const intoShot = fmOf(b).some(x => x.fm.kind === 'charged' && x.n.beat === n.beat + 1);
        assert.ok(intoBuild || intoShot, `${mood} ${seed} bar ${i}: a spin goes into a build or a charged shot`);
        assert.ok(fm.count >= 1 && fm.count <= 3, `a spin has one to three gears (${fm.count})`);
      }
    });
  }
  assert.ok(spins >= 60, `spins (${spins})`);
});

test('K-pop and synthwave borrow one moment at most, before the last drop, in about a quarter to a third of tunes', () => {
  for (const mood of ['kpop', 'synthwave'] as LofiMood[]) {
    let tunes = 0;
    for (const seed of SEEDS) {
      const bars = composeLofiTune(seed, mood);
      const fms = bars.flatMap((b, i) => fmOf(b).map(x => ({ ...x, i })));
      assert.ok(fms.length <= 1, `${mood} ${seed}: one at most (${fms.length})`);
      if (!fms.length) continue;
      tunes++;
      const lastDrop = bars.map(b => b.section).lastIndexOf('drop');
      let start = lastDrop;
      while (start > 0 && bars[start - 1]!.section === 'drop') start--;
      assert.ok(isMoment(fms[0]!.fm.kind), `${mood} ${seed}: a moment`);
      assert.equal(fms[0]!.i, start - 1, `${mood} ${seed}: before the last drop`);
    }
    assert.ok(tunes >= 4 && tunes <= 20, `${mood}: now and then (${tunes} of ${SEEDS.length})`);
  }
});

test('the same seed places the same effects', () => {
  for (const mood of GAMES) assert.deepEqual(composeLofiTune(77, mood), composeLofiTune(77, mood));
});
