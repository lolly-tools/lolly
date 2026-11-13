// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's favourite and blocked instruments (lib/music-prefs.ts) and how a
 * shuffle honours them (lib/music-shuffle.ts): a blocked instrument is never drawn, a
 * favourite is drawn more often, a new tune puts another instrument in place of a
 * blocked one and writes it into the link, so the link plays the same for someone with
 * no preferences at all, and a link that sets a blocked instrument still plays that
 * instrument.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/music-prefs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '@lolly-tools/core/host-v1';
import {
  INSTRUMENT_FAMILIES, MUSIC_PARTS, NO_PREFS, avoidBlocked, clearSwaps, familyOf, heardBySection, instrumentsOf,
  isBlocked, loadMusicPrefs, setMusicPref, styleInstruments, swapKey, type MusicPart, type MusicPrefs,
} from './music-prefs.ts';
import { shuffleMusic } from './music-shuffle.ts';
import { composeTrack, musicStateParams, parseMusicState, type MusicState } from './music-state.ts';

/** A small seeded random source (mulberry32), so a shuffle can be replayed. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const prefsOf = (favourites: string[], blocked: string[]): MusicPrefs => ({ favourites: new Set(favourites), blocked: new Set(blocked) });
/** Every instrument heard for a part in a composed track, by kind of section. */
const heard = (s: MusicState, part: MusicPart): string[] => [...new Set([...heardBySection(composeTrack(s), part).values()].flat())];

test('every instrument has a family, and every family is one the browser shows', () => {
  for (const part of MUSIC_PARTS) {
    for (const id of instrumentsOf(part)) assert.ok(INSTRUMENT_FAMILIES.includes(familyOf(part, id)), `${part} ${id}`);
  }
  assert.equal(familyOf('keys', 'rhodes'), 'keys');
  assert.equal(familyOf('lead', 'koto'), 'world');
  assert.equal(familyOf('lead', 'sax'), 'winds');
  assert.equal(familyOf('lead', 'bit'), 'chip');
  assert.equal(familyOf('bass', 'upright'), 'guitars');
  assert.equal(familyOf('keys', 'electric'), 'guitars', 'the electric guitar is with the guitars');
  assert.ok(!instrumentsOf('lead').includes('none'), 'no lead is not an instrument');
});

test('a favourite and a block are kept on the profile, never both at once, and an empty record leaves no field', () => {
  const profile: Profile = { firstname: 'Sam' };
  let p = setMusicPref(profile, 'lead', 'flute', 'favourite', true);
  assert.deepEqual(profile.music, { favourites: ['lead:flute'] });
  assert.ok(p.favourites.has('lead:flute'));
  p = setMusicPref(profile, 'lead', 'flute', 'blocked', true);
  assert.deepEqual(profile.music, { blocked: ['lead:flute'] }, 'blocking a favourite unstars it');
  assert.ok(isBlocked(p, 'lead', 'flute') && !p.favourites.size);
  setMusicPref(profile, 'lead', 'flute', 'blocked', false);
  assert.equal(profile.music, undefined, 'nothing left, no field');
  assert.deepEqual(Object.keys(profile), ['firstname']);
});

test('preferences read back from the profile, keeping an instrument this build does not know', () => {
  // As a stored record can arrive: written by another version, with entries of any shape.
  const profile: Profile = JSON.parse('{"music":{"favourites":["keys:rhodes","keys:theremin","nonsense",7],"blocked":["lead:chip"]}}');
  const p = loadMusicPrefs(profile);
  assert.deepEqual([...p.favourites], ['keys:rhodes', 'keys:theremin']);
  assert.deepEqual([...p.blocked], ['lead:chip']);
  setMusicPref(profile, 'bass', 'eight', 'favourite', true);
  assert.deepEqual(profile.music?.favourites, ['keys:rhodes', 'keys:theremin', 'bass:eight'], 'a later version\'s instrument survives a save here');
  assert.deepEqual(loadMusicPrefs(null), NO_PREFS);
});

test('what a style plays is read the same every time, and covers its sections\' own instruments', () => {
  const ska = styleInstruments('ska', 'lead');
  assert.deepEqual(styleInstruments('ska', 'lead'), ska);
  assert.ok(ska.includes('trumpet'), ska.join());
  assert.ok(ska.every(id => instrumentsOf('lead').includes(id)));
});

test('a new tune never plays a blocked instrument the composer drew, and the link carries what plays instead', () => {
  let swapsSeen = 0;
  for (const mood of ['ska', 'sugar', 'metal', 'warm', 'dnb', 'koto'] as const) {
    for (let seed = 1; seed <= 6; seed++) {
      const s = parseMusicState(`style=${mood}&seed=${seed * 97}&bars=48`);
      // Block whatever the composer drew for each part, the main instrument and one more.
      const blocked = MUSIC_PARTS.flatMap(part => heard(s, part).slice(0, 2).map(id => `${part}:${id}`));
      const prefs = prefsOf([], blocked);
      const { state: next, swaps } = avoidBlocked(s, prefs);
      for (const part of MUSIC_PARTS) {
        for (const id of heard(next, part)) assert.ok(!isBlocked(prefs, part, id), `${mood} ${seed}: ${part} ${id} is blocked yet plays`);
      }
      swapsSeen += swaps.length;
      // The link holds the swaps, and plays the very same bars for someone with no preferences.
      const link = musicStateParams(next);
      const theirs = parseMusicState(link);
      assert.deepEqual(composeTrack(theirs), composeTrack(next), `${mood} ${seed}: the link reproduces the track`);
      for (const w of swaps) assert.match(link, new RegExp(`(^|&)${swapKey(w).replace('.', '\\.')}=${w.to}(&|$)`), 'every swap is in the link');
      assert.deepEqual(avoidBlocked(next, prefs).swaps, [], 'nothing left to swap');
      assert.deepEqual(s, parseMusicState(`style=${mood}&seed=${seed * 97}&bars=48`), 'the state passed in is not changed');
    }
  }
  assert.ok(swapsSeen > 20, `swaps were made (${swapsSeen})`);
});

test('a substitute is one the style plays, a favourite first', () => {
  const s = parseMusicState('style=ska&seed=4&bars=64');
  const own = composeTrack(s)[0]!.tune.style.lead;
  const fav = styleInstruments('ska', 'lead').find(id => id !== own)!;
  const { state: next, swaps } = avoidBlocked(s, prefsOf([`lead:${fav}`], [`lead:${own}`]));
  assert.equal(next.lead, fav, 'the favourite plays in place of the blocked lead');
  assert.deepEqual(swaps[0], { part: 'lead', from: own, to: fav });
  const plain = avoidBlocked(s, prefsOf([], [`lead:${own}`])).state.lead;
  assert.ok(plain && styleInstruments('ska', 'lead').includes(plain), `${plain} is a lead ska plays`);
});

test('a link that sets a blocked instrument plays as linked', () => {
  const s = parseMusicState('style=ska&seed=4&bars=64&lead=trumpet&drop.keys=organ');
  const { state: next, swaps } = avoidBlocked(s, prefsOf([], ['lead:trumpet', 'keys:organ']));
  assert.equal(next.lead, 'trumpet');
  assert.equal(next.sections.drop?.keys, 'organ');
  assert.ok(!swaps.some(w => w.part === 'lead' || (w.part === 'keys' && w.section === 'drop')));
  assert.equal(musicStateParams(next).includes('lead=trumpet'), true);
});

test('with nothing blocked, the state is left exactly as it was', () => {
  const s = parseMusicState('style=sugar&seed=11&bars=32');
  const out = avoidBlocked(s, prefsOf(['lead:flute'], []));
  assert.equal(out.state, s);
  assert.deepEqual(out.swaps, []);
});

test('swaps are taken back for the next tune, and a person\'s own choice is left alone', () => {
  const s = parseMusicState('style=sugar&seed=11&bars=32&verse.bass=slap');
  s.lead = 'flute';
  s.sections.drop = { keys: 'pad', lead: 'chip' };
  clearSwaps(s, ['lead', 'drop.keys']);
  assert.equal(s.lead, undefined);
  assert.deepEqual(s.sections, { verse: { bass: 'slap' }, drop: { lead: 'chip' } });
  clearSwaps(s, ['drop.lead']);
  assert.deepEqual(s.sections, { verse: { bass: 'slap' } }, 'an emptied section is dropped');
});

test('a shuffle never draws a blocked instrument and leans on favourites', () => {
  const blocked = ['lead:trumpet', 'lead:sax', 'keys:organ', 'bass:round', 'lead:chip', 'keys:rhodes', 'bass:slap'];
  const prefs = prefsOf([], blocked);
  for (let i = 0; i < 80; i++) {
    const s = shuffleMusic(seeded(500 + i), { bars: 64, prefs });
    for (const part of MUSIC_PARTS) {
      const pick = s[part];
      if (pick) assert.ok(!isBlocked(prefs, part, pick), `${s.mood}: drew blocked ${part} ${pick}`);
      for (const v of Object.values(s.sections)) {
        const id = v?.[part];
        if (id) assert.ok(!isBlocked(prefs, part, id), `${s.mood}: drew blocked ${part} ${id} for a section`);
      }
    }
  }
  // Favourites: each style's favourite lead is picked far more often with the star than without.
  const count = (withPrefs: boolean): number => {
    let n = 0;
    for (let i = 0; i < 120; i++) {
      const rand = seeded(9000 + i);
      const s = shuffleMusic(rand, { bars: 32, keep: { mood: 'ska', seed: 4 }, prefs: withPrefs ? prefsOf(['lead:clarinet'], []) : undefined });
      if (s.lead === 'clarinet') n++;
    }
    return n;
  };
  const without = count(false), with_ = count(true);
  assert.ok(with_ > without * 2 && with_ > 30, `the favourite clarinet was drawn ${with_} times with the star, ${without} without`);
});

test('a shuffle with no preferences draws exactly what it drew before', () => {
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(shuffleMusic(seeded(70 + i), { bars: 64 }), shuffleMusic(seeded(70 + i), { bars: 64, prefs: NO_PREFS }));
  }
});
