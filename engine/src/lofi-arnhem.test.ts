// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_PERCUSSION, LOFI_SHOUTS, LOFI_SHOUT_CROWD } from './lofi-compose.ts';
import { arnhemOf, ARNHEM_SHOUTS } from './lofi-arnhem.ts';
import { isYidaki, readDidge, DIDGE_LEAD, DIDGE_TOOT } from './lofi-straya.ts';

const SEEDS = Array.from({ length: 48 }, (_, i) => (i * 2654435761 + 9) >>> 0);
const BILMA = LOFI_PERCUSSION.indexOf('bilma');

test('Arnhem Land\'s tunes sit along one line, most in the middle, a few island grooves and acoustic songs', () => {
  const zones = { modern: 0, middle: 0, traditional: 0 };
  let other = 0;
  for (const seed of SEEDS) {
    const plan = arnhemOf(seed);
    assert.ok(plan.axis >= 0 && plan.axis <= 1);
    if (plan.flavour === 'blend') zones[plan.zone]++; else other++;
  }
  assert.ok(zones.middle > zones.modern && zones.middle > zones.traditional, `most in the middle: ${JSON.stringify(zones)}`);
  assert.ok(zones.modern >= 3 && zones.traditional >= 3, `some lean each way: ${JSON.stringify(zones)}`);
  assert.ok(other >= 1 && other <= SEEDS.length / 4, `the island grooves and acoustic songs are occasional: ${other}`);
});

test('the bilma keeps time in every tune, the Yidaki leads, and the voices sing no words', () => {
  const words = new Set(ARNHEM_SHOUTS.map(w => LOFI_SHOUTS.indexOf(w)));
  for (const seed of SEEDS.slice(0, 16)) {
    const bars = composeLofiTune(seed, 'arnhem');
    const timed = bars.filter(b => b.notes.some(n => n.voice === 'perc' && n.mod === BILMA)).length;
    assert.ok(timed >= bars.length - 3, `seed ${seed}: the bilma in ${timed} of ${bars.length} bars`);
    assert.equal(bars[0]!.tune.style.lead, 'chop', `seed ${seed}: the voice leads`);
    assert.ok(bars.some(b => b.notes.some(n => n.voice === 'didge' && isYidaki(readDidge(n.mod ?? 0).kind))), `seed ${seed}: the Yidaki plays`);
    for (const b of bars) for (const n of b.notes) if (n.voice === 'hey') assert.ok(words.has((n.mod ?? 0) % LOFI_SHOUT_CROWD), `seed ${seed}: a wordless shout`);
  }
});

test('through a chorus the sung hook calls and the Yidaki answers; its toots only over a busy band', () => {
  let answered = 0;
  for (const seed of SEEDS.slice(0, 16)) {
    const plan = arnhemOf((seed ^ 0xa4e3) >>> 0);
    const bars = composeLofiTune(seed, 'arnhem');
    let run = 0;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]!;
      run = i > 0 && bars[i - 1]!.section === b.section ? run + 1 : 0;
      for (const n of b.notes) if (n.voice === 'didge' && readDidge(n.mod ?? 0).art === DIDGE_TOOT) assert.ok(b.section === 'build' || b.section === 'drop' || b.section === 'break', `seed ${seed} bar ${i}: a toot over the band`);
      if (plan.flavour !== 'blend' || b.section !== 'drop' || run % 4 < 2) continue;
      assert.ok(!b.notes.some(n => n.voice === 'lead'), `seed ${seed} bar ${i}: the hook rests`);
      if (b.notes.some(n => n.voice === 'didge' && readDidge(n.mod ?? 0).role === DIDGE_LEAD)) answered++;
    }
  }
  assert.ok(answered > 20, `the Yidaki answers (${answered} bars)`);
});

test('about half the tunes have one whipbird moment, in the intro, the solo\'s opening or between phrases', () => {
  let called = 0;
  for (const seed of SEEDS) {
    const plan = arnhemOf((seed ^ 0xa4e3) >>> 0);
    const birds = composeLofiTune(seed, 'arnhem').flatMap(b => b.notes.filter(n => n.voice === 'whipbird').map(n => ({ b, n })));
    assert.ok(birds.length <= 1, `seed ${seed}: one call at most`);
    if (!birds.length) continue;
    called++;
    const { b, n } = birds[0]!;
    const where = plan.whipbird === 'intro' ? ['intro'] : plan.whipbird === 'break' ? ['break'] : ['verse', 'outro'];
    assert.ok(where.includes(b.section), `seed ${seed}: where the plan puts it (${b.section})`);
    // The whistle sits where recorded whipbirds whistle, about 1.5 to 4.4 kHz.
    const hz = 440 * 2 ** ((n.midi - 69) / 12);
    assert.ok(hz >= 1500 && hz <= 4400, `seed ${seed}: the whistle at ${hz.toFixed(0)} Hz`);
    if (plan.whipbird !== 'break') assert.ok(!b.notes.some(x => x.voice === 'lead' && x.beat < n.beat + 3 && x.beat + x.dur > n.beat), `seed ${seed}: the voice clear of the call`);
  }
  assert.ok(called >= SEEDS.length * 0.3 && called <= SEEDS.length * 0.7, `about half (${called} of ${SEEDS.length})`);
});
