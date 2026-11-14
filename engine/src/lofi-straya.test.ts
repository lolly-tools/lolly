// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLofiTune, LOFI_MOODS } from './lofi-compose.ts';
import { DIDGE_CAMEO, DIDGE_LEAD, DIDGE_MID, readBird, readDidge } from './lofi-straya.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i * 2654435761 + 5) >>> 0);

test('Straya\'s didgeridoo plays three roles by section: the drone, the rhythm, the solo', () => {
  for (const seed of SEEDS.slice(0, 12)) {
    const bars = composeLofiTune(seed, 'straya');
    for (const b of bars) {
      const drone = b.notes.filter(n => n.voice === 'bass');
      const didge = b.notes.filter(n => n.voice === 'didge').map(n => readDidge(n.mod ?? 0));
      const where = `seed ${seed} bar ${b.index} (${b.section})`;
      if (b.section === 'build' || b.section === 'drop') {
        assert.equal(drone.length, 0, `${where}: the drone gives way to the rhythm`);
        if (b.layers.includes('bass')) assert.ok(didge.length > 0 && didge.every(d => d.role === DIDGE_MID), `${where}: the rhythm plays`);
      }
      if (b.section === 'verse') {
        assert.ok(drone.length > 0, `${where}: the drone under the verse`);
        assert.equal(didge.length, 0, `${where}: no rhythm or solo in a verse`);
        // The drone's notes join up: each ends where the next starts.
        const sorted = [...drone].sort((x, y) => x.beat - y.beat);
        for (let i = 0; i + 1 < sorted.length; i++) assert.ok(sorted[i + 1]!.beat - (sorted[i]!.beat + sorted[i]!.dur) < 0.05, `${where}: the drone never stops`);
      }
      if (didge.some(d => d.role === DIDGE_LEAD)) {
        assert.equal(b.section, 'break', `${where}: the didgeridoo leads only in the solo`);
        assert.ok(!b.notes.some(n => n.voice === 'lead'), `${where}: the banjo or the fiddle rests while it leads`);
      }
    }
    // The solo trades: some bars the didgeridoo's, some the answering lead's.
    const solo = bars.filter(b => b.section === 'break');
    assert.ok(solo.some(b => b.notes.some(n => n.voice === 'didge' && readDidge(n.mod ?? 0).role === DIDGE_LEAD)), `seed ${seed}: the didgeridoo takes the solo`);
    assert.ok(solo.some(b => b.notes.some(n => n.voice === 'lead')), `seed ${seed}: and the band answers`);
  }
});

test('the yidaki\'s kinds: each note names one, the rhythm and the solo often another than the drone\'s', () => {
  let changed = 0;
  for (const seed of SEEDS) {
    const kinds = new Set<number>();
    for (const b of composeLofiTune(seed, 'straya')) for (const n of b.notes) if (n.voice === 'didge' || (n.voice === 'bass' && b.tune.style.bass === 'yidaki')) kinds.add(readDidge(n.mod ?? 0).kind);
    for (const k of kinds) assert.ok(k >= 0 && k < 4, `seed ${seed}: kind ${k}`);
    if (kinds.size > 1) changed++;
  }
  assert.ok(changed >= SEEDS.length / 3, `most tunes move between kinds (${changed} of ${SEEDS.length})`);
});

test('most Straya tunes have a signature bird moment, one or two, and the lead stays clear of it', () => {
  let some = 0;
  for (const seed of SEEDS) {
    const bars = composeLofiTune(seed, 'straya');
    const featured = bars.flatMap(b => b.notes.filter(n => (n.voice === 'magpie' || n.voice === 'kookaburra') && readBird(n.mod ?? 0).featured).map(n => ({ b, n })));
    assert.ok(featured.length <= 2, `seed ${seed}: ${featured.length} featured birds`);
    if (featured.length) some++;
    for (const { b, n } of featured) assert.ok(!b.notes.some(x => x.voice === 'lead' && x.beat >= n.beat), `seed ${seed} bar ${b.index}: the lead is cleared under the ${n.voice}`);
  }
  assert.ok(some >= SEEDS.length * 0.75, `most tunes (${some} of ${SEEDS.length})`);
});

test('the didgeridoo\'s cameo in the bass genres is rare and short, and nowhere else plays a didge note', () => {
  for (const mood of LOFI_MOODS) {
    let tunes = 0;
    for (const seed of SEEDS) {
      const bars = composeLofiTune(seed, mood).filter(b => b.notes.some(n => n.voice === 'didge'));
      if (mood === 'straya') continue;
      if (!DIDGE_CAMEO.has(mood)) { assert.equal(bars.length, 0, `${mood} ${seed}: no didgeridoo`); continue; }
      assert.ok(bars.length <= 2, `${mood} ${seed}: a cameo of ${bars.length} bars`);
      if (bars.length) tunes++;
    }
    if (DIDGE_CAMEO.has(mood)) assert.ok(tunes >= 3 && tunes <= SEEDS.length / 2, `${mood}: a cameo in ${tunes} of ${SEEDS.length} tunes`);
  }
});

test('a bird note\'s and a didgeridoo note\'s mod decode', () => {
  assert.deepEqual(readBird(123 + 4096 + 2 * 8192), { song: 123, featured: true, birds: 3 });
  assert.deepEqual(readBird(77), { song: 77, featured: false, birds: 1 });
  assert.deepEqual(readDidge(2 + 16 * 2 + 64 * 3), { art: 2, role: 2, kind: 3 });
});
