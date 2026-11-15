// SPDX-License-Identifier: MPL-2.0
/**
 * Who sings the vocal chops (lofi-chop-cast.ts): each voice alone and each group as a lead of
 * its own, and the genre's own choice behind the first chop id, `chop`, cast from the tune's
 * seed on a stream of its own.
 *
 * Run directly:  node --test engine/src/lofi-chop-cast.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOP_LEADS, CHOP_VOICES, baritoneShift, chopCast, chopCasting, chopCoro, isChopLead, type ChopBar } from './lofi-chop-cast.ts';
import { LOFI_LEADS, LOFI_MOODS, composeLofiTune, isRetiredLead, type LofiMood } from './lofi-compose.ts';
import { arnhemUnison } from './lofi-arnhem.ts';

const bar = (over: Partial<ChopBar> = {}): ChopBar => ({ mood: 'sherbert', seed: 7, section: 'verse', barMean: 72, ...over });
const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2654435761 + 11) >>> 0);

test('every chop lead is a lead a link can name, and none is retired', () => {
  for (const id of CHOP_LEADS) {
    assert.ok((LOFI_LEADS as readonly string[]).includes(id), `${id} is in LOFI_LEADS`);
    assert.ok(!isRetiredLead(id));
    assert.ok(isChopLead(id));
  }
  assert.ok(!isChopLead('flute') && !isChopLead('angel'));
  assert.deepEqual([...CHOP_VOICES], ['female', 'male', 'baritone', 'child']);
});

test('each voice alone sings at its own octave: a woman and a child on the line, a man an octave under, a baritone one or two', () => {
  assert.deepEqual(chopCast('chopFemale', bar()).map(s => [s.voice, s.shift, s.takes]), [['female', 0, 2]]);
  assert.deepEqual(chopCast('chopChild', bar()).map(s => [s.voice, s.shift]), [['child', 0]]);
  assert.deepEqual(chopCast('chopMale', bar()).map(s => [s.voice, s.shift]), [['male', -12]]);
  assert.deepEqual(chopCast('chopBaritone', bar({ barMean: 72 })).map(s => [s.voice, s.shift]), [['baritone', -12]]);
  assert.deepEqual(chopCast('chopBaritone', bar({ barMean: 79 })).map(s => [s.voice, s.shift]), [['baritone', -24]], 'a bar that sits high goes down two octaves');
  assert.equal(baritoneShift(76), -12);
  assert.equal(baritoneShift(77), -24);
  for (const lead of ['chopFemale', 'chopMale', 'chopBaritone', 'chopChild'] as const) {
    for (const s of chopCast(lead, bar())) assert.equal(s.speed, 1, `${lead}: a voice chosen by name is not sped up`);
  }
});

test('the groups: a baritone under a woman, five children, and women with men under them, each a voice of their own', () => {
  const octave = chopCast('chopOctave', bar());
  assert.deepEqual(octave.map(s => [s.voice, s.shift]), [['female', 0], ['baritone', -12]]);
  assert.ok(octave[1]!.level < octave[0]!.level, 'the baritone sits under her');
  const choir = chopCast('chopChoir', bar());
  assert.equal(choir.length, 5);
  assert.ok(choir.every(s => s.voice === 'child' && s.takes === 1 && s.shift === 0));
  assert.equal(new Set(choir.map(s => s.salt)).size, 5, 'each child their own voice');
  assert.equal(new Set(choir.map(s => s.pan)).size, 5, 'each in their own place');
  assert.ok(Math.max(...choir.map(s => s.late)) > 0.015, 'not quite together');
  const group = chopCast('chopGroup', bar());
  assert.deepEqual(group.map(s => s.voice), ['female', 'female', 'male', 'baritone']);
  assert.ok(group.every(s => s.takes === 1));
  assert.ok(group.filter(s => s.voice !== 'female').every(s => s.shift <= -12), 'the men an octave or more under');
});

test("`chop` is the genre's choice: the same tune always casts the same, and other tunes vary", () => {
  for (const mood of LOFI_MOODS) {
    for (const seed of SEEDS.slice(0, 8)) assert.deepEqual(chopCasting(mood, seed), chopCasting(mood, seed));
  }
  const voices = new Set(SEEDS.map(seed => chopCasting('rnb', seed).voice));
  assert.ok(voices.has('female') && voices.has('male'), `R&B sings both (${[...voices].join(', ')})`);
});

/** How often, over many tunes, a genre's casting has a property. */
const share = (mood: LofiMood, test: (c: ReturnType<typeof chopCasting>) => boolean): number => SEEDS.filter(seed => test(chopCasting(mood, seed))).length / SEEDS.length;

test('each genre casts its own way', () => {
  // Future bass, Sugar and C-Pop: a woman's voice, mostly sped up, a man under some drops.
  for (const mood of ['sherbert', 'sugar', 'cpop'] as const) {
    assert.ok(share(mood, c => c.voice === 'female') >= 0.75, `${mood}: mostly a woman`);
    assert.ok(share(mood, c => c.voice === 'female' && c.speed > 1.05) >= 0.55, `${mood}: mostly sped up`);
    const under = share(mood, c => c.under !== null);
    assert.ok(under > 0.12 && under < 0.45, `${mood}: a man under the drops now and then (${under})`);
  }
  // Hip hop and R&B sometimes a man; Mandopop either, as its ballads are sung, never sped up.
  for (const mood of ['hiphop', 'rnb'] as const) {
    const man = share(mood, c => c.voice === 'male' || c.voice === 'baritone');
    assert.ok(man > 0.2 && man < 0.6, `${mood}: sometimes a man (${man})`);
  }
  const mando = share('mandopop', c => c.voice === 'male');
  assert.ok(mando > 0.3 && mando < 0.6, `mandopop: a woman or a man (${mando})`);
  assert.equal(share('mandopop', c => c.speed !== 1), 0, 'a ballad\'s voice is as it is');
  // A children's choir now and then, in a dreamy breakdown or a botanica moment, and nowhere in the club styles that do not ask for one.
  for (const mood of ['sherbert', 'botanica', 'dream'] as const) {
    const choir = share(mood, c => c.choirIn.length > 0);
    assert.ok(choir > 0.05 && choir < 0.4, `${mood}: a choir now and then (${choir})`);
  }
  for (const mood of ['ukGarage', 'mandopop', 'hiphop', 'jungle'] as const) assert.equal(share(mood, c => c.choirIn.length > 0), 0, `${mood}: no choir`);
  // Only a woman's voice has a man under her.
  for (const mood of LOFI_MOODS) assert.equal(share(mood, c => c.under !== null && c.voice !== 'female'), 0, mood);
});

test('a cast plays only where it belongs: the man under her in drops, the choir in its sections, the principal everywhere else', () => {
  let unders = 0, choirs = 0;
  for (const seed of SEEDS) {
    const c = chopCasting('sherbert', seed);
    for (const section of ['intro', 'verse', 'build', 'drop', 'break', 'outro'] as const) {
      const cast = chopCast('chop', bar({ seed, section }));
      if (c.choirIn.includes(section)) { choirs++; assert.ok(cast.every(s => s.voice === 'child')); continue; }
      assert.equal(cast[0]!.voice, c.voice, 'the principal sings first');
      assert.equal(cast[0]!.speed, c.speed);
      if (section === 'drop' && c.under) { unders++; assert.deepEqual(cast.map(s => s.voice), [c.voice, c.under]); } else assert.equal(cast.length, 1, `${seed} ${section}: one voice`);
    }
  }
  assert.ok(unders > 0 && choirs > 0);
});

test("salsa's coro and Arnhem Land's unison hook are a mixed group in the drop; the men lead salsa's", () => {
  assert.ok(chopCoro('salsa', 1));
  const salsa = chopCast('chop', bar({ mood: 'salsa', section: 'drop' }));
  assert.ok(salsa.length >= 4 && new Set(salsa.map(s => s.voice)).size >= 3, 'women and men');
  const loudest = salsa.reduce((a, b) => (b.level > a.level ? b : a));
  assert.notEqual(loudest.voice, 'female', 'a man leads the coro');
  let unison = 0;
  for (const seed of SEEDS.slice(0, 60)) {
    const together = chopCoro('arnhem', seed);
    assert.equal(together, arnhemUnison(seed));
    const cast = chopCast('chop', bar({ mood: 'arnhem', seed, section: 'drop' }));
    if (together) { unison++; assert.ok(cast.length >= 4 && cast.some(s => s.voice === 'female') && cast.some(s => s.voice !== 'female'), 'a mixed group'); } else assert.equal(cast.length, 1);
    assert.equal(chopCast('chop', bar({ mood: 'arnhem', seed, section: 'verse' })).length, 1, 'one voice outside the hook');
  }
  assert.ok(unison > 0, 'some Arnhem Land tunes sing their hook together');
});

test("the composer still draws `chop`: no style's notes moved for the voices", () => {
  // The cast is drawn on its own stream, so a tune composes as it did: the composer's lead is still the chop.
  const bars = composeLofiTune(3, 'sherbert');
  assert.equal(bars[0]!.tune.style.lead, 'chop');
  for (const mood of LOFI_MOODS) {
    const lead = composeLofiTune(5, mood)[0]!.tune.style.lead;
    assert.ok(!isChopLead(lead) || lead === 'chop', `${mood} draws ${lead}: a style draws only the genre's own chop`);
  }
});
