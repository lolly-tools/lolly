// SPDX-License-Identifier: MPL-2.0
/**
 * Yacht rock's band as the station plays it: the guitar's fills fingered on the neck as a lead
 * guitarist's notes are, the chorused guitar a lead guitar through its pedal into the clean
 * twin, and the drummer sitting back a little.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-yacht.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perform } from './lofi-perform.ts';
import { LEAD_GUITARS, LEADS } from './lofi-lead-guitars.ts';
import { composeLofiTune, ELECTRIC_FRET } from '../../../../engine/src/lofi-compose.ts';

test('the guitar\'s fills are fingered on the neck, each on a fret the hand reaches', () => {
  let fills = 0;
  for (const seed of [2, 4, 9, 13]) {
    for (const bar of composeLofiTune(seed, 'yacht')) {
      if (!bar.notes.some(n => n.voice === 'fill')) continue;
      const played = perform(bar, 60 / bar.tune.bpm, bar.voices?.keys ?? bar.tune.style.keys, bar.voices?.lead ?? bar.tune.style.lead);
      for (const n of played.filter(x => x.voice === 'fill')) {
        fills++;
        const fret = Math.floor((n.mod ?? 0) / ELECTRIC_FRET);
        assert.ok(fret >= 0 && fret <= 20, `a fret the hand reaches (${fret})`);
        assert.ok(n.midi - fret >= 40, 'on a string the guitar has');
      }
    }
  }
  assert.ok(fills > 20, `${fills} fill notes`);
});

test('the chorused guitar is a lead guitar on its neck and middle pickups, through the clean amp', () => {
  assert.ok(LEAD_GUITARS.has('chorus'));
  assert.equal(LEADS.chorus!.pickup, 'neck-middle');
  assert.equal(LEADS.chorus!.amp, null, 'no high-gain amp: the clean twin');
  assert.ok(LEADS.chorus!.vibrato > 0 && LEADS.chorus!.vibrato < LEADS.overdrive!.vibrato, 'a gentler vibrato than a rock lead\'s');
});

test('the drummer sits back a little: the backbeat lands behind the grid on average', () => {
  let late = 0, n = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const bar of composeLofiTune(seed, 'yacht').filter(b => b.section === 'drop')) {
      const played = perform(bar, 60 / bar.tune.bpm, bar.tune.style.keys, bar.tune.style.lead);
      for (const s of played.filter(x => x.voice === 'snare' && x.vel >= 0.6)) { late += s.beat - Math.round(s.beat); n++; }
    }
  }
  assert.ok(n > 20 && late / n > 0, `the backbeat ${((late / n) * 1000).toFixed(1)} thousandths of a beat behind`);
});
