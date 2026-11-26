// SPDX-License-Identifier: MPL-2.0
/**
 * The keys instruments played as a lead: the harp's runs, the acoustic guitar's licks and
 * knocks, the tar's tremolo.
 *
 * Run directly:  node --test shells/web/src/lib/lofi-lead-art.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAD_OWN, PLUCK_BEND, PLUCK_DEAD, PLUCK_HAMMER, PLUCK_KNOCK, PLUCK_PULL, PLUCK_SLIDE, ownOnly, percussive } from './lofi-lead-art.ts';
import { perform } from './lofi-perform.ts';
import { composeLofiTune, type LofiMood, type LofiStyle } from '../../../../engine/src/lofi-compose.ts';

/** Every bar of a few tunes with `lead` leading, as written and as played. */
function played(mood: LofiMood, lead: LofiStyle['lead'], seeds: number[]) {
  return seeds.flatMap(seed => composeLofiTune(seed, mood, { lead }).map(bar => ({
    bar, spb: 60 / bar.tune.bpm,
    notes: perform(bar, 60 / bar.tune.bpm, bar.tune.style.keys, lead).filter(n => n.voice === 'lead'),
  })));
}

test('a harpist sweeps up the chord into some phrases: a quick run of its tones below the note, the harp\'s own', () => {
  let runs = 0, phrases = 0;
  for (const { bar, spb, notes } of played('fantasy', 'harp', [1, 2, 3, 4])) {
    const written = bar.notes.filter(n => n.voice === 'lead');
    assert.equal(notes.filter(n => !ownOnly(n.mod)).length, written.length, 'every written note is played');
    for (let i = 0; i < notes.length; i++) {
      if (!ownOnly(notes[i]!.mod)) continue;
      const run = [];
      while (i < notes.length && ownOnly(notes[i]!.mod)) run.push(notes[i++]!);
      const target = notes[i]!;
      runs++;
      assert.ok(run.length >= 3 && run.length <= 4, 'three or four notes');
      for (const [k, n] of run.entries()) {
        assert.ok(bar.tones.includes(((n.midi % 12) + 12) % 12), `a chord tone (${n.midi} on ${bar.chord})`);
        assert.ok(n.midi < target.midi && (k === 0 || n.midi > run[k - 1]!.midi), 'rising, under the note');
        assert.ok(n.beat < target.beat && n.beat >= 0);
        assert.ok(n.mod === LEAD_OWN);
      }
      const gap = (target.beat - run.at(-1)!.beat) * spb;
      assert.ok(gap > 0.02 && gap < 0.05, `the run lands on the note (${(gap * 1000).toFixed(0)} ms)`);
    }
    phrases += written.filter(n => n.dur >= 0.5).length;
  }
  assert.ok(runs >= 4 && runs < phrases * 0.4, `some phrases, not most (${runs} runs, ${phrases} long notes)`);
});

test('an acoustic guitarist slides, hammers on and pulls off between notes, about a fifth to two fifths of them', () => {
  let slides = 0, hammers = 0, pulls = 0, all = 0;
  for (const { notes } of played('country', 'steel', [1, 2, 3])) {
    for (const n of notes) {
      if (ownOnly(n.mod)) continue;   // its runs, strums, double stops, rakes and knocks: see below
      all++;
      const art = (n.mod ?? 0) & 7;
      if (art === PLUCK_SLIDE) slides++;
      if (art === PLUCK_HAMMER) hammers++;
      if (art === PLUCK_PULL) pulls++;
    }
  }
  assert.ok(slides > 0 && hammers > 0 && pulls > 0, `${slides} slides, ${hammers} hammer-ons and ${pulls} pull-offs`);
  const share = (slides + hammers + pulls) / all;
  assert.ok(share > 0.18 && share < 0.5, `legato on ${(share * 100).toFixed(0)} per cent of the notes (11 to 31 measured in recorded phrases, more asked for)`);
});

test('a tar player tremolos held notes: as the composer asks in Persian, and on some long notes elsewhere', () => {
  const riz = (mood: LofiMood): number => played(mood, 'tar', [1, 2, 3]).reduce((s, b) => s + b.notes.filter(n => n.mod === PLUCK_BEND).length, 0);
  assert.ok(riz('persian') > 0, 'in Persian');
  assert.ok(riz('warm') > 0, 'and elsewhere');
  const bar = composeLofiTune(4, 'persian', { lead: 'tar' })[12]!;
  assert.deepEqual(perform(bar, 0.6, bar.tune.style.keys, 'tar'), perform(bar, 0.6, bar.tune.style.keys, 'tar'), 'the same every time');
});

test('the acoustic guitarist decorates the tune from the bar\'s chord and scale: runs, strums, double stops, rakes, and knocks in the rests', () => {
  let strums = 0, doubles = 0, rakes = 0, runs = 0, knocks = 0, melody = 0;
  for (const { bar, spb, notes } of [...played('country', 'steel', [1, 2, 3, 4]), ...played('warm', 'steel', [1, 2, 3, 4])]) {
    const pc = (m: number): number => ((Math.round(m) % 12) + 12) % 12;
    for (let i = 0; i < notes.length; i++) {
      if (!ownOnly(notes[i]!.mod)) { melody++; continue; }
      const group: typeof notes = [];
      while (i < notes.length && ownOnly(notes[i]!.mod)) group.push(notes[i++]!);
      const target = notes[i]!;
      assert.ok(target && !ownOnly(target.mod), 'every ornament leads into a melody note');
      // Knocks on the top, in a rest, on the beat, by a percussive player.
      const knock = group.filter(n => (n.mod! & 7) === PLUCK_KNOCK);
      for (const n of knock) assert.ok(percussive(bar.tune.seed) && Number.isInteger(n.beat) && n.beat < target.beat, 'a knock on a beat of the rest');
      knocks += knock.length;
      const rest = group.filter(n => (n.mod! & 7) !== PLUCK_KNOCK);
      if (!rest.length) continue;
      if (rest.every(n => (n.mod! & 7) === PLUCK_DEAD)) {
        rakes++;
        assert.ok(rest.length >= 2 && rest.length <= 3 && rest.every(n => n.beat < target.beat), 'two or three muted strings before the note');
      } else if (rest.length === 1 && rest[0]!.beat > target.beat - 0.001) {
        doubles++;
        assert.ok(bar.tones.includes(pc(rest[0]!.midi)) && [3, 4, 8, 9].includes(Math.round(target.midi - rest[0]!.midi)), 'a third or a sixth under, from the chord');
      } else if (rest.slice(1).some(n => (n.mod! & 7) === PLUCK_HAMMER || (n.mod! & 7) === PLUCK_PULL)) {
        runs++;
        const line = [...rest.map(n => n.midi), target.midi];
        const up = line[1]! > line[0]!;
        assert.ok(line.every((m, k) => k === 0 || (up ? m > line[k - 1]! : m < line[k - 1]!) && Math.abs(m - line[k - 1]!) <= 3), `a run by steps into the note: ${line}`);
        assert.ok(((target.mod ?? 0) & 7) === (up ? PLUCK_HAMMER : PLUCK_PULL), 'and the note itself hammered on or pulled off');
      } else {
        strums++;
        for (const n of rest) assert.ok(bar.tones.includes(pc(n.midi)) && n.midi < target.midi, `a chord tone under the melody (${n.midi} under ${target.midi} on ${bar.chord})`);
        assert.ok(rest.every((n, k) => k === 0 || n.midi > rest[k - 1]!.midi), 'a downstroke, low to high');
        const spread = (target.beat - rest[0]!.beat) * spb;
        assert.ok(spread > 0.015 && spread < 0.05, `the stroke ends on the melody (${(spread * 1000).toFixed(0)} ms)`);
      }
    }
  }
  assert.ok(strums >= 3 && doubles >= 3 && rakes >= 2 && runs >= 10 && knocks >= 1, `${strums} strums, ${doubles} double stops, ${rakes} rakes, ${runs} runs, ${knocks} knocks`);
  const added = strums + doubles + rakes + runs;
  assert.ok(added > melody * 0.2 && added < melody * 0.85, `a lick or a strum on ${(100 * added / melody).toFixed(0)} per cent of the notes`);
});

test('a strumming lead alternates picked phrases with strummed passages: about a quarter of its bars', () => {
  let bars = 0, strummed = 0;
  for (const { notes } of [...played('country', 'steel', [1, 2, 3, 4, 5]), ...played('warm', 'steel', [1, 2, 3, 4, 5])]) {
    const melody = notes.filter(n => !ownOnly(n.mod));
    if (melody.length < 2) continue;
    bars++;
    // A strummed bar: most of its notes come with strings struck under them.
    const struck = melody.filter(m => notes.some(n => ownOnly(n.mod) && (n.mod! & 7) === 0 && n.midi < m.midi && m.beat - n.beat > 0 && m.beat - n.beat < 0.12)).length;
    if (struck >= melody.length * 0.6) strummed++;
  }
  assert.ok(strummed > bars * 0.12 && strummed < bars * 0.4, `${strummed} strummed bars in ${bars}`);
});

test('a percussive strummer knocks the top on the backbeat; the others never do', () => {
  let knocked = 0, quiet = 0;
  for (let seed = 1; seed <= 12; seed++) {
    let knocks = 0;
    for (const bar of composeLofiTune(seed, 'country', { keys: 'steel' })) {
      for (const n of perform(bar, 60 / bar.tune.bpm, 'steel', bar.tune.style.lead)) {
        if (n.voice !== 'keys' || n.mod !== PLUCK_KNOCK) continue;
        knocks++;
        assert.ok(Math.abs(n.beat - 1) < 0.01 || Math.abs(n.beat - 3) < 0.01, 'on two or four');
      }
    }
    if (percussive(composeLofiTune(seed, 'country')[0]!.tune.seed)) { assert.ok(knocks > 10, `seed ${seed}: a percussive player knocks (${knocks})`); knocked++; }
    else { assert.equal(knocks, 0, `seed ${seed}: the others never do`); quiet++; }
  }
  assert.ok(knocked >= 3 && quiet >= 3, `${knocked} percussive players in 12, ${quiet} not`);
});
