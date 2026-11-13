// SPDX-License-Identifier: MPL-2.0
/**
 * The keys instruments played as a lead: the harp's runs, the acoustic guitar's slides
 * and hammer-ons, the tar's tremolo.
 *
 * Run directly:  node --test shells/web/src/lib/lofi-lead-art.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAD_OWN, PLUCK_BEND, PLUCK_HAMMER, PLUCK_SLIDE, ownOnly } from './lofi-lead-art.ts';
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

test('an acoustic guitarist slides into some notes and hammers some on; most are picked as written', () => {
  let slides = 0, hammers = 0, all = 0;
  for (const { notes } of played('country', 'steel', [1, 2, 3])) {
    for (const n of notes) {
      all++;
      if (n.mod === PLUCK_SLIDE) slides++;
      if (n.mod === PLUCK_HAMMER) hammers++;
      assert.ok(!ownOnly(n.mod), 'no ornament notes of its own');
    }
  }
  assert.ok(slides > 0 && hammers > 0, `${slides} slides and ${hammers} hammer-ons`);
  assert.ok(slides + hammers < all * 0.4, 'most notes picked as written');
});

test('a tar player tremolos held notes: as the composer asks in Persian, and on some long notes elsewhere', () => {
  const riz = (mood: LofiMood): number => played(mood, 'tar', [1, 2, 3]).reduce((s, b) => s + b.notes.filter(n => n.mod === PLUCK_BEND).length, 0);
  assert.ok(riz('persian') > 0, 'in Persian');
  assert.ok(riz('warm') > 0, 'and elsewhere');
  const bar = composeLofiTune(4, 'persian', { lead: 'tar' })[12]!;
  assert.deepEqual(perform(bar, 0.6, bar.tune.style.keys, 'tar'), perform(bar, 0.6, bar.tune.style.keys, 'tar'), 'the same every time');
});
