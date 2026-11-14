// SPDX-License-Identifier: MPL-2.0
/**
 * Salsa (engine/src/lofi-salsa.ts): the clave governs every part, the bass and the piano
 * anticipate, the percussion changes between the verse and the montuno, the coro and the
 * pregón trade, and the mambo is the horns' riff.
 *
 * Run directly: node --test engine/src/lofi-salsa.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_PERCUSSION } from './lofi-compose.ts';
import type { LofiBar, LofiNote } from './lofi-compose.ts';
import { BELL_STROKES, CASCARA, claveSide, CONGA_DRUM, CONGA_STROKES, MONTUNOS, SALSA_PERCUSSION, SON_CLAVE, TIMBAL_STROKES, type ClaveDirection } from './lofi-salsa.ts';

const SEEDS = Array.from({ length: 12 }, (_, i) => (i * 2654435761 + 17) >>> 0);
const step = (n: LofiNote): number => Math.round(n.beat * 4);
const PC = (m: number): number => ((m % 12) + 12) % 12;
const perc = (bar: LofiBar, kind: typeof SALSA_PERCUSSION[number]): LofiNote[] => bar.notes.filter(n => n.voice === 'perc' && n.mod === LOFI_PERCUSSION.indexOf(kind));
/** The tune's clave direction, read from its first bar's clave. */
function direction(bars: LofiBar[]): ClaveDirection {
  return perc(bars[0]!, 'clave').length === 3 ? '3-2' : '2-3';
}
/** The bars that keep the groove: not the break, the ending, or the rest bar. */
const grooving = (bars: LofiBar[]): LofiBar[] => bars.filter(b => b.section !== 'rest' && perc(b, 'clave').length > 0);

test('the percussion the composer already had keeps its place; salsa\'s follows it', () => {
  assert.deepEqual(LOFI_PERCUSSION.slice(0, 17), ['shaker', 'tambourine', 'conga', 'cowbell', 'sticks', 'tombak', 'daf', 'woodblock', 'tanggu', 'gong', 'taiko', 'kotsuzumi', 'djembe', 'dunun', 'shekere', 'agogo', 'talking']);
  assert.deepEqual(LOFI_PERCUSSION.slice(17), [...SALSA_PERCUSSION]);
});

test('a salsa tune: 160 to 210 a minute, every section an even number of bars, a montuno, a mambo and a second montuno', () => {
  const tempos = new Set<number>();
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'salsa');
    const t = bars[0]!.tune;
    assert.ok(t.bpm >= 160 && t.bpm <= 210, `${seed}: ${t.bpm} bpm`);
    tempos.add(t.bpm);
    const runs: Array<[string, number]> = [];
    for (const b of bars) {
      const last = runs[runs.length - 1];
      if (last && last[0] === b.section) last[1]++;
      else runs.push([b.section, 1]);
    }
    for (const [section, n] of runs) if (section !== 'rest') assert.equal(n % 2, 0, `${seed}: ${section} is ${n} bars, so the clave would turn round`);
    assert.deepEqual(runs.map(r => r[0]), ['intro', 'verse', 'build', 'drop', 'break', 'drop', 'outro', 'rest'], `${seed}: ${runs.map(r => r[0]).join(' > ')}`);
    assert.equal(bars[0]!.tune.style.keys, 'grand', 'the montuno is the grand piano');
  }
  assert.ok(tempos.size > 6, 'tempos vary from tune to tune');
});

test('the clave governs: its strokes are its side\'s, the sides alternate bar by bar, and both directions are drawn', () => {
  const directions = new Set<ClaveDirection>();
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'salsa');
    const dir = direction(bars);
    directions.add(dir);
    for (const bar of grooving(bars)) {
      const side = claveSide(dir, bar.index);
      assert.deepEqual(perc(bar, 'clave').map(step), [...SON_CLAVE[side]], `${seed} bar ${bar.index}: the ${side} side`);
    }
  }
  assert.deepEqual([...directions].sort(), ['2-3', '3-2']);
});

test('the bass is anticipated: beat one is left alone, and four plays the next chord\'s root, held over the bar line', () => {
  let checked = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'salsa');
    for (const bar of grooving(bars)) {
      const bass = bar.notes.filter(n => n.voice === 'bass');
      if (!bass.length) continue;
      const prev = bars[bar.index - 1];
      if (prev && prev.section === bar.section && prev.notes.some(n => n.voice === 'bass')) {
        assert.ok(!bass.some(n => step(n) === 0), `${seed} bar ${bar.index}: the bass strikes beat one mid-section`);
      }
      const four = bass.find(n => step(n) === 12)!;
      assert.ok(four, `${seed} bar ${bar.index}: a note on four`);
      const next = bars[bar.index + 1]!;
      if (next.tones.length) assert.equal(PC(four.midi), next.tones[0], `${seed} bar ${bar.index}: four is ${next.chord}'s root`);
      assert.ok(four.beat + four.dur > 4, `${seed} bar ${bar.index}: four is held over the bar line`);
      assert.ok(bass.some(n => step(n) === 6), `${seed} bar ${bar.index}: and the and of two`);
      checked++;
    }
  }
  assert.ok(checked > 400, `enough bars to judge (${checked})`);
});

test('the montuno is in clave, in octaves, never on beat one, and anticipates the next chord', () => {
  for (const [two, three] of MONTUNOS) {
    // Each figure holds its side's off-beat clave strokes (in eighths) and leaves beat one alone.
    assert.ok([2, 4].every(e => two.some(([x]) => x === e)), 'the two side\'s strokes on two and three');
    assert.ok([3, 6].every(e => three.some(([x]) => x === e)), 'the three side\'s on the and of two and four');
    for (const fig of [two, three]) {
      assert.ok(!fig.some(([x]) => x === 0), 'nothing on beat one');
      assert.ok(['n', 'N'].includes(fig[fig.length - 1]![1]) && fig[fig.length - 1]![0] === 7, 'the last eighth anticipates');
    }
  }
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'salsa');
    const dir = direction(bars);
    for (const bar of grooving(bars)) {
      const keys = bar.notes.filter(n => n.voice === 'keys');
      if (!keys.length) continue;
      const at = new Set(keys.map(step));
      assert.ok(!at.has(0), `${seed} bar ${bar.index}: the piano strikes beat one`);
      const side = claveSide(dir, bar.index);
      for (const st of SON_CLAVE[side]) if (st !== 0) assert.ok(at.has(st), `${seed} bar ${bar.index}: the montuno plays the clave's ${st}`);
      // The two hands an octave apart.
      const byStep = new Map<number, number[]>();
      for (const n of keys) byStep.set(step(n), [...(byStep.get(step(n)) ?? []), n.midi]);
      for (const [st, ps] of byStep) assert.ok(ps.some(p => ps.includes(p + 12)), `${seed} bar ${bar.index} step ${st}: octaves`);
      // The last eighth is the next chord's.
      const next = bars[bar.index + 1]!;
      for (const n of keys.filter(x => step(x) === 14)) assert.ok(next.tones.includes(PC(n.midi)), `${seed} bar ${bar.index}: the anticipation is ${next.chord}'s`);
    }
  }
});

test('the percussion: the conga\'s tumbao every bar, the martillo and the cáscara in the verse, the bells in the montuno', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'salsa');
    const dir = direction(bars);
    for (const bar of grooving(bars)) {
      const congas = perc(bar, 'congas');
      if (!congas.length) continue;
      const side = claveSide(dir, bar.index);
      assert.ok(congas.some(n => step(n) === 4 && n.midi % CONGA_DRUM === CONGA_STROKES.slap), `${seed} bar ${bar.index}: the slap on two`);
      assert.deepEqual(congas.filter(n => n.midi % CONGA_DRUM === CONGA_STROKES.open).map(step), [12, 14], `${seed} bar ${bar.index}: open tones on four and its and`);
      const verse = bar.section === 'verse';
      const hot = bar.section === 'drop' || bar.section === 'break';
      if (verse) {
        assert.equal(perc(bar, 'bongos').length, 8, `${seed} bar ${bar.index}: the martillo's eighths`);
        assert.deepEqual(perc(bar, 'timbales').filter(n => n.midi === TIMBAL_STROKES.shell).map(step), [...CASCARA[side]], `${seed} bar ${bar.index}: the cáscara's ${side} side`);
        assert.equal(perc(bar, 'bongoBell').length, 0);
      }
      if (hot) {
        assert.equal(perc(bar, 'bongos').length, 0, `${seed} bar ${bar.index}: the bongocero has taken up the bell`);
        assert.deepEqual(perc(bar, 'bongoBell').filter(n => n.midi === BELL_STROKES.mouth).map(step), [0, 8], 'the bongo bell\'s mouth on one and three');
        assert.deepEqual(perc(bar, 'mamboBell').map(step), [...CASCARA[side]], `${seed} bar ${bar.index}: the mambo bell plays the ${side} side`);
        if (bar.section === 'drop') assert.ok(perc(bar, 'congas').some(n => n.midi >= 2 * CONGA_DRUM) === (side === 'two'), 'the tumba answers on the two side');
      }
      assert.deepEqual(perc(bar, 'guiro').map(step), [0, 4, 6, 8, 12, 14], 'the güiro: long, short, short');
      assert.ok(perc(bar, 'guiro').filter(n => step(n) % 8 === 0).every(n => n.dur > 0.5), 'the long scrape is long');
    }
  }
});

test('the montuno trades a sung coro with the lead\'s pregón, two bars each; the coro sings the same every time', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'salsa');
    const drops = bars.filter(b => b.section === 'drop');
    const coros = new Map<number, string[]>();
    let run = 0;
    for (let i = 0; i < drops.length; i++) {
      const bar = drops[i]!;
      run = i > 0 && drops[i - 1]!.index === bar.index - 1 ? run + 1 : 0;
      const sung = bar.voices?.lead === 'chop';
      assert.equal(sung, run % 4 < 2, `${seed} bar ${bar.index}: coro then pregón`);
      const lead = bar.notes.filter(n => n.voice === 'lead');
      assert.ok(lead.length > 0, `${seed} bar ${bar.index}: someone sings or plays`);
      if (sung) {
        const sig = lead.map(n => `${step(n)}:${n.midi}`);
        const before = coros.get(run % 2);
        if (before) assert.deepEqual(sig, before, `${seed} bar ${bar.index}: the coro is the same refrain`);
        else coros.set(run % 2, sig);
        // Two voices: the line and a second voice under the line.
        assert.ok(new Set(lead.map(step)).size < lead.length, 'two voices');
      }
    }
  }
});

test('the mambo is the horns\' riff, its rhythm repeating every two bars, with a moña joining halfway', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'salsa');
    const mambo = bars.filter(b => b.section === 'break');
    assert.equal(mambo.length, 8);
    const rhythm = (b: LofiBar): number[] => [...new Set(b.notes.filter(n => n.voice === 'lead').map(step))].sort((x, y) => x - y);
    assert.deepEqual(rhythm(mambo[2]!), rhythm(mambo[0]!), `${seed}: the riff comes round`);
    assert.ok(mambo[5]!.notes.filter(n => n.voice === 'lead').length > mambo[1]!.notes.filter(n => n.voice === 'lead').length, `${seed}: the moña thickens the second half`);
    for (const b of mambo) assert.equal(perc(b, 'bongos').length, 0, 'bells, not the martillo');
  }
});

test('the abanico rolls into each new section and the timbales mark its first beat; the ending hits the clave and the tonic', () => {
  for (const seed of SEEDS.slice(0, 6)) {
    const bars = composeLofiTune(seed, 'salsa');
    const dir = direction(bars);
    for (const bar of bars) {
      const next = bars[bar.index + 1];
      if (!next || next.section === bar.section || next.section === 'outro' || next.section === 'rest' || bar.section === 'intro' && !perc(bar, 'congas').length) continue;
      const roll = perc(bar, 'timbales').filter(n => n.midi === TIMBAL_STROKES.roll && n.beat >= 3);
      assert.ok(roll.length >= 6, `${seed} bar ${bar.index}: an abanico into the ${next.section}`);
      assert.ok(perc(next, 'timbales').some(n => n.midi === TIMBAL_STROKES.rimshot && n.beat === 0), `${seed} bar ${next.index}: the rimshot on one`);
    }
    const last = bars[bars.length - 2]!, before = bars[bars.length - 3]!;
    const hits = [...new Set(before.notes.filter(n => n.voice === 'keys').map(step))];
    assert.deepEqual(hits, [...SON_CLAVE[claveSide(dir, before.index)]], `${seed}: the band hits the clave together`);
    assert.equal(last.chord, last.tune.key.split(' ')[0] + (last.tune.key.endsWith('minor') ? 'm' : ''), `${seed}: it ends on the tonic`);
    assert.ok(last.notes.some(n => n.voice === 'crash' && n.beat === 0));
  }
});
