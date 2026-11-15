// SPDX-License-Identifier: MPL-2.0
/**
 * Pure page-model logic for the music genre pages (/info/music/<slug>/) and the
 * background music hub (docs/background-music.md).
 *
 * Two registers drive them, and this module reads neither from disk, so a unit test
 * can import it directly (docs/build.ts cannot be imported: it builds the site at
 * import time, which is why the format side doors keep their logic in
 * docs/formats-pages.ts too):
 *
 *  - docs/site/music-genres.json: one entry per genre, the page's own copy (what the
 *    genre sounds like when Lolly makes it, its uses and its own questions). English;
 *    a locale twin at docs/i18n/<lang>/music-genres.json replaces the fields it has.
 *  - docs/music/samples.json: one listening sample per genre, rendered by
 *    scripts/build-music-samples.ts through the music generator's own render and
 *    Content Credentials path, with the seed, the bar it starts at and what it
 *    measured. The audio sits beside it in docs/music/samples/.
 *
 * The genres, their groups, titles and icons come from the app itself
 * (shells/web/src/lib/genre-icons.ts), so a genre the picker lists cannot be missing
 * here without the drift test (tests/music-pages.test.ts) saying which.
 */
import type { LofiMood } from '../engine/src/lofi-compose.ts';
import type { GenreCategory } from '../shells/web/src/lib/genre-icons.ts';

/** Where the genre pages live under /info: /info/music/<slug>/. */
export const MUSIC_BASE = 'music';
/** Where the samples are served from: /info/music/samples/<slug>.m4a. */
export const SAMPLES_DIR = 'music/samples';
/** The one credit line every page asks for (Andy, 2026-11-15). */
export const MUSIC_CREDIT = 'Music made with Lolly';
/** The credit line with the address, for when there is room for a link. */
export const MUSIC_CREDIT_LINK = 'Music made with Lolly (https://lolly.tools)';

/** Each group's heading, as the genre picker shows the groups (views/music-studio/
 *  genre-picker.ts CATEGORY_TITLE, which is not exported because it translates at call
 *  time; tests/music-pages.test.ts holds the two to the same words). */
export const MUSIC_GROUP_TITLE: Readonly<Record<GenreCategory, string>> = {
  chill: 'Chill', rock: 'Rock & Roots', soul: 'Soul & Groove', club: 'Club', bass: 'Bass & Synth', world: 'World',
};

/**
 * Each genre's address under /info/music/. Readable words, the genre's own name
 * where people search for that name ("drum-and-bass", not "dnb"), and the Lofi moods
 * read as lofi. Permanent once published: a slug is an inbound link.
 */
export const GENRE_SLUG: Readonly<Record<LofiMood, string>> = {
  warm: 'warm-lofi', lateNight: 'late-night-lofi', rainy: 'rainy-lofi', sings: 'lolly-sings',
  sugar: 'sugar', sherbert: 'sherbert', persian: 'persian', guzheng: 'guzheng', koto: 'koto',
  kora: 'kora', afrobeat: 'afrobeat', amapiano: 'amapiano', chiptune: 'chiptune',
  citypop: 'city-pop', funk: 'funk', soul: 'soul', nudisco: 'nu-disco', hiphop: 'hip-hop',
  triphop: 'trip-hop', reggae: 'reggae', spanish: 'spanish-guitar', rock: 'rock', metal: 'metal',
  country: 'country', blues: 'blues', jazz: 'jazz', swing: 'swing', straya: 'straya',
  fantasy: 'fantasy', dream: 'dreamscape', kpop: 'k-pop', synthwave: 'synthwave', acid: 'acid',
  electro: 'electro', dubstep: 'dubstep', brostep: 'brostep', dnb: 'drum-and-bass', ska: 'ska',
  punk: 'punk', rnb: 'r-and-b', grunge: 'grunge', stoner: 'stoner-rock', shoegaze: 'shoegaze',
  lofiHouse: 'lofi-house', salsa: 'salsa', surf: 'surf-rock', yacht: 'yacht-rock',
  botanica: 'botanica', arnhem: 'arnhem-land', oompa: 'oompa', mandopop: 'mandopop', cpop: 'c-pop',
  breakbeat: 'breakbeat', funkyHouse: 'funky-house', ukGarage: 'uk-garage',
  privateSchool: 'private-school-piano', noosa: 'noosacore', jungle: 'jungle',
};

/** One question and its answer. */
export interface MusicQuestion { q: string; a: string }

/** One genre's page copy: an entry of docs/site/music-genres.json. */
export interface GenreCopy {
  id: LofiMood;
  /** How the genre reads inside a sentence: "lofi house", "K-pop". */
  name: string;
  /** The page title and its h1. */
  title: string;
  /** The meta description and the share card's line. */
  description: string;
  /** The standfirst under the title. */
  lead: string;
  /** What Lolly's version of the genre sounds like, a paragraph each. */
  sound: string[];
  /** What the music suits. */
  uses: string[];
  /** The genre's own questions, shown before the shared ones. */
  faq: MusicQuestion[];
  /** Three genres a fan of this one might try. */
  related: LofiMood[];
}

export interface MusicRegister { version: 1; genres: GenreCopy[] }

/** How every sample is cut and encoded. */
export interface ExcerptSpec {
  /** Length of each sample in seconds, its fades included. */
  seconds: number;
  fadeIn: number;
  fadeOut: number;
  /** AAC bitrate, bits a second. */
  bitrate: number;
  /** The most of the bar before the anchor a sample opens with, in seconds. */
  maxLeadIn: number;
  /** Bars played before the sample starts, so reverbs and echoes are already ringing. */
  warmupBars: number;
}

/** What a sample measured, from the PCM before encoding (scripts/build-music-samples.ts). */
export interface SampleMeasures {
  /** Whole-sample RMS, dBFS (fades excluded). */
  rmsDb: number;
  /** Sample peak, dBFS. */
  peakDb: number;
  /** The quietest 400 ms block after the anchor, dB under the sample's RMS. */
  dipDb: number;
  /** How much louder the music is after the anchor than in the lead-in, dB. */
  liftDb: number;
  /** Energy under about 150 Hz against the whole, dB. */
  lowDb: number;
  /** Left and right correlation, 1 for mono. */
  stereo: number;
  /** The DJ's scratches the composer placed in the sample's bars. */
  scratches?: number;
}

/** One genre's listening sample. */
export interface SampleRecipe {
  style: LofiMood;
  seed: number;
  bars: number;
  /** The bar the excerpt is anchored on: the first drop or chorus, or the full groove. */
  anchorBar: number;
  /** The section the anchor bar opens, in the genre's own words. */
  anchorSection: string;
  /** The tune's own tempo and key, for the page. */
  bpm: number;
  key: string;
  /** The file under docs/music/samples/, its size and SHA-256 (hex), as written. */
  file: string;
  bytes: number;
  sha256: string;
  /** The declaration the file's Content Credentials read back. */
  declaration: string;
  /** The licence statement the file's Content Credentials read back (`dc:rights`). */
  licence: string;
  measured: SampleMeasures;
}

export interface SampleSet { version: 1; excerpt: ExcerptSpec; samples: SampleRecipe[] }

/** The section the excerpt starts in, by preference: a drop (a chorus in the band
 *  genres, a bloom, a swell, a montuno), else the full groove of the Lofi moods, else
 *  the second strain, else the first verse, else the top. */
export const ANCHOR_SECTIONS = ['drop', 'groove', 'feature', 'verse'] as const;
export function excerptAnchor(sections: readonly string[]): number {
  for (const want of ANCHOR_SECTIONS) {
    const at = sections.indexOf(want);
    if (at > 0) return at;
  }
  return 0;
}

/** The link that opens the music generator on a genre and seed, with the genre locked
 *  so a shuffle stays in that genre (the music generator's `lock=genre`). */
export function makeYourOwnHash(style: string, seed: number, bars: number): string {
  return `#/music?style=${encodeURIComponent(style)}&seed=${seed >>> 0}&bars=${bars}&lock=genre`;
}

/** The genre page's path under /info, without the extension: music/<slug>. */
export function genrePageSlug(id: LofiMood): string {
  return `${MUSIC_BASE}/${GENRE_SLUG[id]}`;
}

/** Markdown inline marks taken out, for a plain-text answer in structured data. */
export function plainText(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** An ISO 8601 duration for whole and fractional seconds ("PT20S"). */
export function isoDuration(seconds: number): string {
  const s = Math.round(seconds * 10) / 10;
  return `PT${s}S`;
}

/**
 * Problems with the copy register against the genres the app lists: a genre missing,
 * one listed twice, an unknown id, a related id that is not a genre, or a field left
 * empty. An empty list means the register is complete.
 */
export function registerProblems(register: MusicRegister, moods: readonly LofiMood[]): string[] {
  const problems: string[] = [];
  const known = new Set<string>(moods);
  const seen = new Set<string>();
  for (const g of register.genres) {
    if (!known.has(g.id)) problems.push(`unknown genre id: ${g.id}`);
    if (seen.has(g.id)) problems.push(`listed twice: ${g.id}`);
    seen.add(g.id);
    for (const k of ['name', 'title', 'description', 'lead'] as const) if (!g[k]?.trim()) problems.push(`${g.id}: empty ${k}`);
    if (!g.sound?.length) problems.push(`${g.id}: no sound paragraphs`);
    if (!g.uses?.length) problems.push(`${g.id}: no uses`);
    for (const r of g.related ?? []) if (!known.has(r) || r === g.id) problems.push(`${g.id}: related genre ${r} is not another genre`);
  }
  for (const m of moods) if (!seen.has(m)) problems.push(`no copy for genre: ${m}`);
  return problems;
}

/**
 * Pull the questions out of a markdown section: every `### Question` heading under
 * the `## <heading>` section, with the paragraphs after it (to the next heading) as
 * its answer, inline markdown kept. The hub page's Questions section is the one
 * source for the questions every genre page repeats, so a translated hub translates
 * them everywhere.
 */
export function questionsFromMarkdown(md: string, heading: string): MusicQuestion[] {
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.replace(/<!--.*?-->/g, '').trim() === `## ${heading}`);
  if (start < 0) return [];
  const out: MusicQuestion[] = [];
  let current: { q: string; a: string[] } | null = null;
  const flush = (): void => { if (current) out.push({ q: current.q, a: current.a.join('\n').trim() }); current = null; };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^## /.test(line)) break;
    const h3 = /^### (.+)$/.exec(line);
    if (h3) { flush(); current = { q: h3[1]!.trim(), a: [] }; continue; }
    if (current && !/^<!--.*-->$/.test(line.trim())) current.a.push(line);
  }
  flush();
  return out.filter(q => q.q && q.a);
}
