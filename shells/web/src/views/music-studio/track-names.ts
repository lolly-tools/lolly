// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's words for its tracks and for what the composer chose (#/music).
 *
 * Each track is named for the part it plays in the tune rather than for an instrument:
 * the lead is the Melody, the keys are the Chords (that lane plays guitars, strings,
 * harps and saw chords as often as keys), the bass and the drums keep their names, and
 * the effects are the Ear candy. These are labels only: the link, the state and a saved
 * tune keep the old ids (lead, keys, bass, drums and fx), so every link plays as before.
 *
 * Where an instrument is left to the composer, its control reads "Auto" and the
 * instrument playing: "Auto · Yidaki", "Auto · Jazz kit". The name tables
 * (lib/lofi-names.ts) hold names as a sentence carries them ("felt piano"), so a control
 * capitalises the first letter when it shows one ("Felt piano"), in the language the
 * page is showing, and the tables stay as they are.
 */
import { currentLang, t, tRaw } from '../../i18n.ts';
import { genreTitle } from '../../lib/genre-icons.ts';
import { LOFI_KITS, LOFI_KIT_MOOD, LOFI_KIT_NAME } from '../../lib/lofi-drums.ts';
import { LOFI_TAGS, type LofiMood, type LofiTagChoice } from '../../../../../engine/src/lofi-compose.ts';

/** The generator's tracks, by the ids the link and the state use. */
export type StudioTrack = 'lead' | 'keys' | 'bass' | 'drums' | 'fx';

/** A track's name as a person reads it: the part it plays in the tune. */
export function trackName(track: StudioTrack): string {
  switch (track) {
    case 'lead': return t('Melody');
    case 'keys': return t('Chords');
    case 'bass': return t('Bass');
    case 'drums': return t('Drums');
    default: return t('Ear candy');
  }
}

/**
 * A name with its first letter capitalised for the page's language ("banjo" to
 * "Banjo", "jazz guitar" to "Jazz guitar"); the rest is left as written, so "Rhodes"
 * and "808" stay as they are.
 */
export function sentenceCase(name: string, lang: string = currentLang()): string {
  const [first = '', ...rest] = Array.from(name);
  let upper = first;
  try { upper = first.toLocaleUpperCase(lang); } catch { upper = first.toUpperCase(); }
  return upper + rest.join('');
}

/** What a control left to the composer shows: "Auto" and what plays ("Auto · Yidaki"). */
export function autoLabel(playing: string): string {
  return playing ? tRaw('Auto · {name}', { name: sentenceCase(playing) }) : t('Auto');
}

/**
 * A lane head's whole name, for its tooltip and for what a screen reader says. The head
 * shows the instrument at the playhead and is cut short with an ellipsis when the name is
 * longer than the head ("Auto · Synthwav…"), so this gives that label in full and, when
 * the lane plays other instruments across the tune, those too (`across`, the lane's list:
 * "Synthwave lead, Pad +1").
 */
export function laneHeadName(shown: string, across: string, others: boolean): string {
  return others && across ? tRaw('{now}. In this tune: {names}', { now: shown, names: across }) : shown;
}

/**
 * The drum kit a genre plays when the person has chosen none: the kit of that name for
 * the genres the named kits come from (rock's acoustic kit, jazz's jazz kit), and the
 * genre's own kit, by the genre's name, for the rest ("Straya kit").
 */
export function styleKitName(mood: LofiMood): string {
  const kit = LOFI_KITS.find(k => LOFI_KIT_MOOD[k] === mood);
  return kit ? t(LOFI_KIT_NAME[kit]) : tRaw('{genre} kit', { genre: genreTitle(mood) });
}

/** How the composer says "Lolly" in a track: the delivery of its first tag, or 'off' when it places none. */
export function composedTag(bars: ReadonlyArray<{ notes: ReadonlyArray<{ voice: string; mod?: number }> }>): LofiTagChoice {
  for (const bar of bars) {
    const tag = bar.notes.find(n => n.voice === 'tag');
    if (tag) return LOFI_TAGS[tag.mod ?? 0] ?? 'spoken';
  }
  return 'off';
}
