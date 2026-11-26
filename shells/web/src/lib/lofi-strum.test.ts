// SPDX-License-Identifier: MPL-2.0
/**
 * The strummed acoustic: the hand's strokes, their sweep and direction, the strings ringing
 * until they are struck again, the patterns and the chucks.
 *
 * Run directly:  node --test shells/web/src/lib/lofi-strum.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perform } from './lofi-perform.ts';
import { PLUCK_DEAD, PLUCK_KNOCK, RESTRUCK, percussive } from './lofi-lead-art.ts';
import { composeLofiTune, type LofiMood, type LofiNote } from '../../../../engine/src/lofi-compose.ts';

/** A tune's strummed bars, each as strokes: notes within 60 ms of each other are one stroke. */
function strokesOf(mood: LofiMood, seed: number): Array<{ spb: number; strokes: LofiNote[][]; bar: ReturnType<typeof composeLofiTune>[number] }> {
  return composeLofiTune(seed, mood, { keys: 'steel' }).flatMap(bar => {
    const spb = 60 / bar.tune.bpm;
    const notes = perform(bar, spb, 'steel', bar.tune.style.lead).filter(n => n.voice === 'keys' && n.mod !== PLUCK_KNOCK);
    if (!notes.length) return [];
    const strokes: LofiNote[][] = [];
    for (const n of notes) {
      const last = strokes[strokes.length - 1];
      if (last && (n.beat - last[last.length - 1]!.beat) * spb < 0.02) last.push(n);
      else strokes.push([n]);
    }
    return [{ spb, strokes, bar }];
  });
}

test('a held chord is strummed through: about one and a half to two and a half strokes a beat, as the recordings strum', () => {
  for (const [mood, seed] of [['warm', 15], ['sings', 4], ['rainy', 3]] as const) {
    const bars = strokesOf(mood, seed).filter(b => b.bar.notes.some(n => n.voice === 'keys' && n.dur >= 1));
    assert.ok(bars.length > 4, `${mood}: held chords to strum`);
    const perBeat = bars.reduce((s, b) => s + b.strokes.length, 0) / (bars.length * 4);
    assert.ok(perBeat > 1 && perBeat < 3, `${mood}: ${perBeat.toFixed(2)} strokes a beat`);
  }
});

test('a stroke sweeps the strings in 10 to 60 ms: down from the low strings on the beat, up from the top between', () => {
  let downs = 0, ups = 0;
  for (const [mood, seed] of [['warm', 15], ['country', 8], ['straya', 2]] as const) {
    for (const { spb, strokes } of strokesOf(mood, seed)) {
      for (const st of strokes) {
        if (st.length < 3 || st.some(n => n.mod === PLUCK_DEAD)) continue;
        const ms = (st[st.length - 1]!.beat - st[0]!.beat) * spb * 1000;
        assert.ok(ms > 5 && ms < 65, `${mood}: a sweep of ${ms.toFixed(0)} ms`);
        // (Two strings may sound one pitch, a unison in the shape.)
        const rising = st.every((n, k) => k === 0 || n.midi >= st[k - 1]!.midi);
        const falling = st.every((n, k) => k === 0 || n.midi <= st[k - 1]!.midi);
        assert.ok(rising || falling, 'strings in order across the chord');
        const onBeat = Math.abs(st[0]!.beat - Math.round(st[0]!.beat)) < 0.03;
        if (onBeat) { assert.ok(rising, 'a downstroke on the beat'); downs++; }
        if (falling) ups++;
      }
    }
  }
  assert.ok(downs > 20 && ups > 20, `${downs} downstrokes on the beat, ${ups} upstrokes`);
});

test('each string rings until it is struck again, and the new stroke takes it over', () => {
  for (const { bar, spb } of strokesOf('warm', 15).slice(0, 6)) {
    // A chuck's muted strings count: they stop what was ringing.
    const notes = perform(bar, spb, 'steel', bar.tune.style.lead).filter(n => n.voice === 'keys' && n.mod !== PLUCK_KNOCK);
    for (const [i, n] of notes.entries()) {
      if (n.mod === PLUCK_DEAD) continue;
      const later = notes.slice(i + 1).filter(m => m.midi === n.midi && m.beat > n.beat + 0.05);
      if (n.mod === RESTRUCK) assert.ok(later.some(m => Math.abs(n.beat + n.dur - m.beat) < 0.02), 'cut where the string is struck again');
      else assert.ok(n.beat + n.dur > 4, 'or left to ring past the bar');
    }
  }
});

test('a boom-chick keeps its booms on one and three, the bass string alone; a percussive strummer chucks some backbeats', () => {
  let booms = 0, chucked = 0, open = 0;
  for (const seed of [7, 8]) {
    for (const { strokes } of strokesOf('country', seed)) {
      for (const st of strokes) {
        const b = st[0]!.beat;
        if (st.length === 1 && (Math.abs(b) < 0.05 || Math.abs(b - 2) < 0.05)) booms++;
        if (st.every(n => n.mod === PLUCK_DEAD)) {
          assert.ok(percussive(seed), 'only a percussive player chucks');
          assert.ok(Math.abs(b - 1) < 0.05 || Math.abs(b - 3) < 0.05, 'on the backbeat');
          chucked++;
        } else open++;
      }
    }
  }
  assert.ok(booms > 40, `${booms} booms`);
  assert.ok(chucked > 5 && chucked < open * 0.25, `${chucked} chucks against ${open} ringing strokes (13 per cent measured in a percussive take)`);
});

test('the strummer is the same every time', () => {
  const bar = composeLofiTune(15, 'warm', { keys: 'steel' })[6]!;
  assert.deepEqual(perform(bar, 0.6, 'steel', 'none'), perform(bar, 0.6, 'steel', 'none'));
});
