// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's genres as a person picks them (#/music): each genre's title
 * without its station's family ("Ska", not "Lolly Sings · Ska"), the category the picker
 * lists it under (chill, electronic, classic or international), and an icon. Most icons come from the shared set
 * (lib/icons.ts) or the instrument icons (lib/instrument-icons.ts). The few that only the
 * genre picker draws live here, in the same 24-unit stroke style, so a page that never
 * opens the generator never loads them. The shuffle button's crossing arrows are here
 * too. The station names elsewhere (the player, a saved track's file name) keep their
 * family: see lofiStationName.
 */
import type { LofiMood } from '../../../../engine/src/lofi-compose.ts';
import { icon, type IconName } from './icons.ts';
import { musicIconBody, strokeSvg, strokeSvgNode, type InstrumentIcon } from './instrument-icons.ts';
import { LOFI_MOOD_LABEL } from './neurospicy-lofi.ts';

/** Glyphs only the generator draws. Lucide (ISC): shuffle, disc-3, headphones,
 *  ice-cream-cone, flower, mountain, radio, speaker and castle. Lolly's own: a wrapped sweet. */
const OWN = {
  shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>',
  disc: '<circle cx="12" cy="12" r="10"/><path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="2"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  iceCream: '<path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/><path d="M17 7A5 5 0 0 0 7 7"/><path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>',
  flower: '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9"/><path d="M7.5 12H9"/><path d="M16.5 12H15"/><path d="M12 16.5V15"/><path d="m8 8 1.88 1.88"/><path d="M14.12 9.88 16 8"/><path d="m8 16 1.88-1.88"/><path d="M14.12 14.12 16 16"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  speaker: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 6h.01"/><circle cx="12" cy="14" r="4"/><path d="M12 14h.01"/>',
  castle: '<path d="M10 5V3"/><path d="M14 5V3"/><path d="M15 21v-3a3 3 0 0 0-6 0v3"/><path d="M18 3v8"/><path d="M18 5H6"/><path d="M22 11H2"/><path d="M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9"/><path d="M6 3v8"/>',
  candy: '<circle cx="12" cy="12" r="4.5"/><path d="M7.9 10 3 7v10l4.9-3"/><path d="M16.1 10 21 7v10l-4.9-3"/>',
} as const;
type OwnGlyph = keyof typeof OWN;

/** Where a genre's icon comes from: the shared set, the instrument icons, or this file. */
export type GenreGlyph = { set: IconName } | { inst: InstrumentIcon } | { own: OwnGlyph };

/** Each genre's icon: an instrument the genre is known for, or a picture of its world. */
export const GENRE_ICON: Record<LofiMood, GenreGlyph> = {
  sings: { set: 'lollipop' }, sugar: { own: 'candy' }, sherbert: { own: 'iceCream' }, kpop: { set: 'star' },
  straya: { set: 'bird' }, persian: { set: 'chimes' }, guzheng: { own: 'mountain' }, koto: { own: 'flower' },
  kora: { set: 'globe' }, afrobeat: { inst: 'drum' }, amapiano: { inst: 'piano' }, chiptune: { inst: 'gamepad' },
  citypop: { set: 'city' }, funk: { set: 'zap' }, soul: { set: 'heart' }, rnb: { inst: 'micVocal' },
  nudisco: { own: 'disc' }, lofiHouse: { set: 'home' }, hiphop: { own: 'speaker' }, triphop: { own: 'headphones' },
  reggae: { own: 'radio' }, ska: { set: 'grid' }, spanish: { set: 'flame' }, rock: { inst: 'guitar' },
  punk: { set: 'kiki' }, grunge: { set: 'noise' }, stoner: { set: 'bouba' }, metal: { set: 'cloudLightning' },
  country: { set: 'train' }, blues: { set: 'wind' }, jazz: { inst: 'horn' }, swing: { set: 'music' },
  fantasy: { own: 'castle' }, dream: { set: 'cloud' }, shoegaze: { set: 'waves' }, synthwave: { set: 'sunburst' },
  acid: { set: 'flask' }, electro: { set: 'cpu' }, dubstep: { inst: 'audioWaveform' }, brostep: { set: 'hammer' },
  dnb: { set: 'timer' }, warm: { set: 'coffee' }, lateNight: { set: 'moon' }, rainy: { set: 'cloudRain' },
  botanica: { set: 'leaf' },
};

/** The shapes of a genre's icon, inside its `<svg>`. */
function genreIconBody(mood: LofiMood): string {
  const g = GENRE_ICON[mood];
  if ('set' in g) return /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(icon(g.set))?.[1] ?? '';
  if ('inst' in g) return musicIconBody(g.inst);
  return OWN[g.own];
}
/** A genre's icon as `<svg>` markup, for markup written once (the picker's cards). */
export const genreIconSvg = (mood: LofiMood, size: number): string => strokeSvg(genreIconBody(mood), size);
/** A genre's icon as an element, for a control that changes its icon (the genre button). */
export const genreIconNode = (mood: LofiMood, size: number): SVGSVGElement => strokeSvgNode(genreIconBody(mood), size);

/** The shuffle button's crossing arrows. */
export const shuffleIconSvg = (size: number): string => strokeSvg(OWN.shuffle, size);

/** A genre's title in the picker: the style alone, the station's family left to the group heading. */
export const genreTitle = (mood: LofiMood): string => (mood === 'sings' ? 'Lolly Sings' : LOFI_MOOD_LABEL[mood]);

/** The picker's categories, in the order it shows them. */
export const GENRE_CATEGORIES = ['chill', 'electronic', 'classic', 'international'] as const;
export type GenreCategory = typeof GENRE_CATEGORIES[number];

/** Which category each genre is listed under: the Lofi stations and the calm styles are
 *  chill (botanica among them: most of its tunes drift, and even its glitchy grooves sit
 *  in a garden rather than a club), the club and synth styles electronic, the band and groove styles classic, and
 *  the styles of one tradition or place international. */
export const GENRE_CATEGORY: Record<LofiMood, GenreCategory> = {
  warm: 'chill', lateNight: 'chill', rainy: 'chill', lofiHouse: 'chill', triphop: 'chill', dream: 'chill', citypop: 'chill', sings: 'chill', fantasy: 'chill', botanica: 'chill',
  sugar: 'electronic', sherbert: 'electronic', synthwave: 'electronic', chiptune: 'electronic', acid: 'electronic', electro: 'electronic', dubstep: 'electronic', brostep: 'electronic', dnb: 'electronic', nudisco: 'electronic',
  rock: 'classic', punk: 'classic', grunge: 'classic', stoner: 'classic', metal: 'classic', shoegaze: 'classic', blues: 'classic', jazz: 'classic', swing: 'classic', soul: 'classic', funk: 'classic', rnb: 'classic', country: 'classic', ska: 'classic', reggae: 'classic', hiphop: 'classic',
  persian: 'international', guzheng: 'international', koto: 'international', kora: 'international', afrobeat: 'international', amapiano: 'international', spanish: 'international', straya: 'international', kpop: 'international',
};

/** The picker's groups: each category's genres, A to Z by title. */
export const GENRE_GROUPS: ReadonlyArray<{ id: GenreCategory; moods: readonly LofiMood[] }> = GENRE_CATEGORIES.map(id => ({
  id,
  moods: (Object.keys(GENRE_CATEGORY) as LofiMood[])
    .filter(m => GENRE_CATEGORY[m] === id)
    .sort((a, b) => genreTitle(a).localeCompare(genreTitle(b), 'en', { sensitivity: 'base' })),
}));
