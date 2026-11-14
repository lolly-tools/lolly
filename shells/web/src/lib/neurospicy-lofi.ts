// SPDX-License-Identifier: MPL-2.0
/**
 * The generated stations in the Neurospicy player: three Lofi moods (warm, late night
 * and rainy) and Lolly Sings, the melody-first genre. They sit in the track list beside
 * uploads and internet radio and are the player's own music: endless, made as they play
 * by engine/src/lofi-compose.ts through lib/lofi-station.ts, never the same tune twice.
 *
 * This module is the thin layer lib/neurospicy.ts calls: the station ids, the live
 * station, the run of tunes heard so far (so Previous goes back a tune), the seed a
 * shared link asks for, and the link itself. It imports the station only when one
 * starts, so the player costs nothing extra for anyone who never plays Lofi.
 *
 * A tune is its seed. Pausing and playing again starts the same tune from its top;
 * Next draws a new seed; a shared link (#/?lofi=warm.123456) plays exactly the tune the
 * sender heard, in the same mood. Drums and texture are listener preferences, not part
 * of the tune, so a link carries neither.
 */
import type { LofiBar, LofiMood, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import type { LofiStation } from './lofi-station.ts';

export const LOFI_PREFIX = 'lofi:';
/** The stations, in picker order. Kept here (not imported) so this module never loads the composer. */
export const LOFI_STATION_MOODS: readonly LofiMood[] = ['sings', 'sugar', 'sherbert', 'kpop', 'straya', 'persian', 'guzheng', 'koto', 'kora', 'afrobeat', 'amapiano', 'chiptune', 'citypop', 'funk', 'soul', 'rnb', 'nudisco', 'lofiHouse', 'hiphop', 'triphop', 'reggae', 'ska', 'spanish', 'rock', 'punk', 'grunge', 'stoner', 'metal', 'country', 'blues', 'jazz', 'swing', 'fantasy', 'dream', 'shoegaze', 'synthwave', 'acid', 'electro', 'dubstep', 'brostep', 'dnb', 'breakbeat', 'funkyHouse', 'ukGarage', 'privateSchool', 'warm', 'lateNight', 'rainy'];
/** The Lofi moods: the stations the Mood control moves between. */
export const LOFI_ONLY_MOODS: readonly LofiMood[] = ['warm', 'lateNight', 'rainy'];
/** The Lolly Sings family: the melody-first station and its dance genres, which the Style control moves between. */
export const LOFI_SINGS_MOODS: readonly LofiMood[] = ['sings', 'sugar', 'sherbert', 'kpop', 'straya', 'persian', 'guzheng', 'koto', 'kora', 'afrobeat', 'amapiano', 'chiptune', 'citypop', 'funk', 'soul', 'rnb', 'nudisco', 'lofiHouse', 'hiphop', 'triphop', 'reggae', 'ska', 'spanish', 'rock', 'punk', 'grunge', 'stoner', 'metal', 'country', 'blues', 'jazz', 'swing', 'fantasy', 'dream', 'shoegaze', 'synthwave', 'acid', 'electro', 'dubstep', 'brostep', 'dnb', 'breakbeat', 'funkyHouse', 'ukGarage', 'privateSchool'];
export const LOFI_MOOD_LABEL: Record<LofiMood, string> = {
  warm: 'Warm', lateNight: 'Late night', rainy: 'Rainy', sings: 'Lolly Sings',
  sugar: 'Sugar', sherbert: 'Sherbert', persian: 'Persian', guzheng: 'Guzheng', koto: 'Koto', kora: 'Kora', afrobeat: 'Afrobeat', amapiano: 'Amapiano', chiptune: 'Chiptune', citypop: 'City pop', nudisco: 'Nu-disco', lofiHouse: 'Lofi house', triphop: 'Trip hop', funk: 'Funk', soul: 'Soul', rnb: 'R&B', ska: 'Ska', punk: 'Punk', grunge: 'Grunge', stoner: 'Stoner rock', shoegaze: 'Shoegaze', acid: 'Acid', hiphop: 'Hip hop', reggae: 'Reggae', spanish: 'Spanish guitar', rock: 'Rock', country: 'Country', blues: 'Blues', jazz: 'Jazz', swing: 'Swing', straya: 'Straya', fantasy: 'Fantasy', dream: 'Dreamscape', kpop: 'K-pop', metal: 'Metal', synthwave: 'Synthwave', electro: 'Electro', dubstep: 'Dubstep', brostep: 'Brostep', dnb: 'D&B',
  breakbeat: 'Breakbeat', funkyHouse: 'Funky house', ukGarage: 'UK garage', privateSchool: 'Private school piano',
};

/** Whether `mood` belongs to the Lolly Sings family. */
export function isSingsMood(mood: LofiMood): boolean { return LOFI_SINGS_MOODS.includes(mood); }

/** A station's name in the player: "Lofi · Warm", "Lolly Sings", "Lolly Sings · Sugar". */
export function lofiStationName(mood: LofiMood): string {
  if (mood === 'sings') return 'Lolly Sings';
  return isSingsMood(mood) ? `Lolly Sings · ${LOFI_MOOD_LABEL[mood]}` : `Lofi · ${LOFI_MOOD_LABEL[mood]}`;
}

/** What a listener sets for every Lofi station: whether the drums play, and how dusty it sounds. */
export interface LofiPrefs { drums: boolean; texture: number }
export const LOFI_DEFAULTS: LofiPrefs = { drums: true, texture: 0.5 };

export function isLofiId(id: string): boolean { return lofiMoodOf(id) !== null; }
export function lofiId(mood: LofiMood): string { return LOFI_PREFIX + mood; }
export function lofiMoodOf(id: string): LofiMood | null {
  if (!id.startsWith(LOFI_PREFIX)) return null;
  const mood = id.slice(LOFI_PREFIX.length) as LofiMood;
  return LOFI_STATION_MOODS.includes(mood) ? mood : null;
}

/** The stations as player tracks (the same shape as lib/neurospicy.ts's NeuroTrack). */
export function lofiTracks(): Array<{ id: string; name: string; tags: string[]; format: string }> {
  return LOFI_STATION_MOODS.map((mood) => ({ id: lofiId(mood), name: lofiStationName(mood), tags: ['generated'], format: 'lofi' }));
}

/**
 * The station a retired catalog track hands over to. The recorded lo-fi loops, the
 * tracker modules and the hand-written Lolly Sings songs left the starter catalogs once
 * the player could make its own music; a listener whose selection was one of them
 * carries on with the nearest station rather than silence. Null for anything else.
 */
export function retiredTrackStation(id: string): string | null {
  if (/^lolly\/songs\//.test(id)) return lofiId('sings');
  if (!/^lolly\/(loops|modules)\//.test(id)) return null;
  if (/rain/.test(id)) return lofiId('rainy');
  if (/3-?am|night|static|echoes|blue|jazz/.test(id)) return lofiId('lateNight');
  return lofiId('warm');
}

// ── saved tunes ──────────────────────────────────────────────────────────────

/**
 * Tunes the listener saved to the asset library (lib/lofi-tune.ts), by asset id. The
 * player fills this as it lists the library, so playing one needs no fetch.
 */
const savedTunes = new Map<string, LofiLink>();

/** Note that asset `id` is a saved tune with this recipe. */
export function rememberSavedTune(id: string, recipe: LofiLink): void { savedTunes.set(id, recipe); }

/** The recipe of saved tune `id`, or null when `id` is not one. */
export function savedTuneOf(id: string): LofiLink | null { return savedTunes.get(id) ?? null; }

/** A station or a saved tune: anything the live station plays. */
export function playsOnStation(id: string): boolean { return isLofiId(id) || savedTunes.has(id); }

// ── the live station ─────────────────────────────────────────────────────────

let station: LofiStation | null = null;
let stationId = '';
/** Seeds heard on the current station, oldest first; the last is playing. */
let heard: number[] = [];
/** A seed a shared link asked for, waiting for the station to start. */
let queued: number | null = null;
/** The tune to come back to after a pause: its station and seed. */
let resume: { id: string; seed: number } | null = null;
/** What the station was started with, so a seek can start it again from another bar. */
let started: StartArgs | null = null;
/**
 * The bar a new station starts on, until that bar sounds (a fresh start, a seek, a shared
 * moment). It comes first wherever the player asks where it is: while a seek's station
 * loads, the old one plays on and can reach its next tune. `owner` is the station that
 * starts there (null while it loads), and only the first bar of that station ends the wait.
 */
let pending: { bar: number; seed: number; owner: LofiStation | null } | null = null;
/** Counts starts and stops, so a start that finishes loading after a newer one (or a stop) gives way. */
let generation = 0;
/** The composer, once a station has loaded it, and a generator track's settings: what a timeline is drawn from. */
let composer: Composer | null = null;
let track: { state: MusicState; music: MusicStateModule } | null = null;
/** The bars of what is playing, worked out once per tune (or track). */
let timeline: { key: string; line: LofiTimeline } | null = null;

export type Composer = typeof import('../../../../engine/src/lofi-compose.ts');
export type MusicStateModule = typeof import('./music-state.ts');
type MusicState = ReturnType<MusicStateModule['parseMusicState']>;
interface StartArgs { ctx: AudioContext; dest: AudioNode; id: string; prefs: LofiPrefs; onTuneEnd?: (() => void) | undefined }

function freshSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0]!;
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

function notifyTune(): void {
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-tune'));
}

/**
 * Start station `id` into `dest` on `ctx`. A queued link seed wins; then the tune that
 * was paused, if it was this station's; otherwise a new tune. A saved tune (`id` is its
 * asset id) plays its own seed and repeats; `onTuneEnd` runs each time it comes round
 * again, for a player that moves on to the next track instead.
 */
export async function startLofi(ctx: AudioContext, dest: AudioNode, id: string, prefs: LofiPrefs, onTuneEnd?: () => void): Promise<void> {
  const saved = savedTunes.get(id);
  if (!(saved?.mood ?? lofiMoodOf(id))) return;
  const seed = saved?.seed ?? queued ?? (resume?.id === id ? resume.seed : freshSeed());
  // A shared moment starts its tune from the bar it had reached.
  const startBar = !saved && queued !== null ? queuedBar : 0;
  if (!saved) { queued = null; queuedBar = 0; }
  await begin({ ctx, dest, id, prefs, onTuneEnd }, seed, startBar);
}

/**
 * Start a new station for `from`, playing tune `seed` from bar `startBar` (a generator
 * track from bar `startBar` of the track), the way the music generator plays from a bar.
 * Whatever was playing fades out over `fade` seconds.
 */
async function begin(from: StartArgs, seed: number, startBar: number, fade = 0.25): Promise<void> {
  const { ctx, dest, id, prefs, onTuneEnd } = from;
  const saved = savedTunes.get(id);
  const mood = saved?.mood ?? lofiMoodOf(id);
  if (!mood) return;
  const mine = ++generation;
  const [{ LofiStation }, compose, music] = await Promise.all([
    import('./lofi-station.ts'),
    import('../../../../engine/src/lofi-compose.ts'),
    saved?.generator ? import('./music-state.ts') : null,
  ]);
  if (mine !== generation) return;   // a newer start, or a stop, came while this one loaded
  stopLofi(fade);
  composer = compose;
  // A track saved from the music generator plays exactly as it was made (its instruments,
  // tempo, key, mix and length), repeating; the listener's drums switch still holds.
  const state = music && saved?.generator ? music.parseMusicState(saved.generator) : null;
  track = state && music ? { state, music } : null;
  if (stationId !== id || heard[heard.length - 1] !== seed) heard = [...(stationId === id ? heard : []), seed].slice(-50);
  stationId = id;
  const s = state && music
    ? new LofiStation(ctx, dest, state.seed, { ...music.trackSettings(state, startBar), drums: prefs.drums && state.drums, repeat: true }, state.mix)
    : new LofiStation(ctx, dest, seed, { mood, drums: prefs.drums, texture: prefs.texture, repeat: Boolean(saved), ...(startBar ? { startBar } : {}) });
  s.setVolume(1);
  pending = { bar: startBar, seed, owner: s };
  // A tune started part way through is already on its first time round.
  let rounds = startBar > 0 ? 1 : 0;
  s.onBar = (bar) => {
    if (pending?.owner === s) pending = null;
    // The top of a saved tune, or of a generator track (which can hold several tunes).
    const top = state ? s.currentPos === 0 : bar.index === 0;
    if (saved && top && rounds++ > 0) { onTuneEnd?.(); return; }
    if (bar.index !== 0) return;
    // A tune that followed on by itself joins the run, so Previous can go back to that tune.
    if (heard[heard.length - 1] !== bar.tune.seed) heard = [...heard, bar.tune.seed].slice(-50);
    notifyTune();
  };
  s.start();
  station = s;
  started = from;
  notifyTune();
}

/** Stop the station, remembering its tune so playing again picks it up. */
export function stopLofi(fade = 0.25): void {
  generation++;
  pending = null;
  if (!station) return;
  const seed = station.current?.tune.seed ?? heard[heard.length - 1];
  if (seed !== undefined) resume = { id: stationId, seed };
  station.stop(fade);
  station.onBar = null;
  station = null;
}

/** Is a station sounding? */
export function lofiLive(): boolean { return station !== null; }

/** The tune now playing, once its first bar has started (or the tune a new station is about to start). */
export function lofiTune(): LofiTuneInfo | null {
  if (!station) return null;
  return pending ? currentTimeline()?.tunes[pending.bar] ?? null : station.current?.tune ?? null;
}

/** Next: a new tune on the same station. */
export function nextLofiTune(): void {
  if (!station) return;
  const seed = freshSeed();
  heard = [...heard, seed].slice(-50);
  station.skip(seed);
  notifyTune();
}

/** Previous: the tune before this one, or this one from its top when it is the first. */
export function prevLofiTune(): void {
  if (!station) return;
  if (heard.length > 1) heard = heard.slice(0, -1);
  const seed = heard[heard.length - 1];
  if (seed !== undefined) station.skip(seed);
  notifyTune();
}

/** Apply the listener's drums and texture to the live station, and to any it starts again from a seek. */
export function applyLofiPrefs(prefs: LofiPrefs): void {
  station?.setDrums(prefs.drums);
  station?.setTexture(prefs.texture);
  if (started) started = { ...started, prefs };
}

/** The tune now playing on a station, as a recipe to save: its mood and seed. Null on a
 *  saved tune (it is already saved) or before the first bar. */
export function currentLofiRecipe(): LofiLink | null {
  const mood = lofiMoodOf(stationId);
  const seed = station ? pending?.seed ?? station.current?.tune.seed : undefined;
  return mood && seed !== undefined ? { mood, seed } : null;
}

/** Play `seed` the next time a station starts (a shared link), from bar `bar` of the tune (a shared moment). */
export function queueLofiSeed(seed: number, bar = 0): void { queued = seed >>> 0; queuedBar = Math.max(0, Math.floor(bar)); }
let queuedBar = 0;

/** The bar the station's tune has reached (0 is its first), for a shared moment; null when nothing is sounding. */
export function currentLofiBar(): number | null {
  if (!station) return null;
  return pending?.bar ?? station.current?.index ?? null;
}

// ── where the tune has got to, and seeking by bar ───────────────────────────────

/** The bars of what a station plays: when each starts, its part of the tune, and where the parts change. */
export interface LofiTimeline {
  /** Seconds from the top at which each bar starts, ascending, the first 0. */
  starts: readonly number[];
  /** Each bar's part, in the music generator's words ("verse", "chorus", "rest"). */
  sections: readonly string[];
  /** Where a new part starts, in seconds (the top left out). */
  marks: readonly number[];
  /** Each bar's tune (a generator track can hold several). */
  tunes: readonly LofiTuneInfo[];
  /** The whole length, in seconds. */
  total: number;
}

/** The timeline of `bars`, each bar's part named by `name`. A bar lasts four beats at its tune's tempo. */
export function lofiTimeline(bars: readonly LofiBar[], name: (bar: LofiBar) => string): LofiTimeline {
  const starts: number[] = [];
  const sections: string[] = [];
  const marks: number[] = [];
  const tunes: LofiTuneInfo[] = [];
  let at = 0;
  for (const bar of bars) {
    const part = name(bar);
    if (sections.length && part !== sections[sections.length - 1]) marks.push(at);
    starts.push(at);
    sections.push(part);
    tunes.push(bar.tune);
    at += 240 / bar.tune.bpm;
  }
  return { starts, sections, marks, tunes, total: at };
}

/** The bar whose start is nearest `seconds` (`starts` ascending); halfway goes to the later bar. */
export function nearestBar(starts: readonly number[], seconds: number): number {
  let best = 0;
  for (let i = 1; i < starts.length; i++) {
    if (Math.abs(starts[i]! - seconds) <= Math.abs(starts[best]! - seconds)) best = i;
    else break;   // past the nearest start, every later one is further away
  }
  return best;
}

/** The bar playing at `seconds`: the last bar to have started by then. */
export function barAt(starts: readonly number[], seconds: number): number {
  let bar = 0;
  for (let i = 1; i < starts.length && starts[i]! <= seconds + 1e-6; i++) bar = i;
  return bar;
}

/** The timeline of what the station plays now, worked out once per tune (or track). */
function currentTimeline(): LofiTimeline | null {
  const compose = composer;
  if (!station || !compose) return null;
  if (track) {
    const { state, music } = track;
    const key = `track:${stationId}`;
    if (timeline?.key !== key) timeline = { key, line: trackTimeline(compose, music, state) };
    return timeline.line;
  }
  const mood = savedTunes.get(stationId)?.mood ?? lofiMoodOf(stationId);
  const seed = pending?.seed ?? station.current?.tune.seed;
  if (!mood || seed === undefined) return null;
  const key = `${mood}:${seed}`;
  if (timeline?.key !== key) timeline = { key, line: tuneTimeline(compose, mood, seed) };
  return timeline.line;
}

/** The bars of station tune `seed` in `mood`, with the music generator's name for each part. */
export function tuneTimeline(compose: Composer, mood: LofiMood, seed: number): LofiTimeline {
  return lofiTimeline(compose.composeLofiTune(seed, mood), (b) => compose.lofiSectionName(mood, b.section));
}

/** The bars of a track from the music generator, across every tune it holds. */
export function trackTimeline(compose: Composer, music: MusicStateModule, state: MusicState): LofiTimeline {
  return lofiTimeline(music.composeTrack(state), (b) => compose.lofiSectionName(b.tune.mood, b.section));
}

/**
 * Where `station` has got to on `line`: the bar playing and the seconds from the top. A
 * generator track counts its bars by their place in the track (`byPlace`), a tune by
 * their index in the tune. Null before the station's first bar sounds.
 */
export function stationPosition(station: LofiStation, line: LofiTimeline, byPlace: boolean): { bar: number; seconds: number } | null {
  if (!station.current) return null;
  const bar = byPlace ? station.currentPos : station.current.index;
  const start = line.starts[bar];
  if (start === undefined) return null;
  const length = (line.starts[bar + 1] ?? line.total) - start;
  return { bar, seconds: start + Math.min(length, Math.max(0, station.ctx.currentTime - station.currentAt)) };
}

/**
 * Where the station has got to: the bar playing (0 is the first of the tune, or of a
 * generator track), the seconds from the top, and the timeline. Null when nothing is
 * sounding on a station.
 */
export function lofiPosition(): { bar: number; seconds: number; timeline: LofiTimeline } | null {
  const line = currentTimeline();
  if (!station || !line) return null;
  if (pending) return { bar: pending.bar, seconds: line.starts[pending.bar] ?? 0, timeline: line };
  const at = stationPosition(station, line, track !== null);
  return at ? { ...at, timeline: line } : null;
}

/**
 * Seek: start the tune (or generator track) again from the bar whose start is nearest
 * `seconds`, the way the music generator plays from a bar: a new station, that many bars
 * in. Returns the bar, or null when nothing is playing on a station.
 */
export async function seekLofi(seconds: number): Promise<number | null> {
  const at = lofiPosition();
  if (!at || !started || !station) return null;
  const bar = nearestBar(at.timeline.starts, seconds);
  const seed = savedTunes.get(stationId)?.seed ?? pending?.seed ?? station.current?.tune.seed;
  if (seed === undefined) return null;
  // The player reports this bar at once, so the progress bar and a shared moment give it
  // before the new station plays a note.
  pending = { bar, seed, owner: null };
  await begin(started, seed, bar, 0.08);
  return bar;
}

// ── shared links ─────────────────────────────────────────────────────────────

/** A shared tune: its station's mood and its seed. */
export interface LofiLink { mood: LofiMood; seed: number; /** A music generator track's settings (lib/music-state.ts), for a saved one. */ generator?: string }

/** Where the music generator opens a tune: a generator track with everything it was made
 *  with, a station tune by its style and seed. */
export function musicEditorHash(recipe: LofiLink): string {
  return recipe.generator ? `#/music?${recipe.generator}` : `#/music?style=${encodeURIComponent(recipe.mood)}&seed=${recipe.seed >>> 0}`;
}

/** The `lofi` link parameter's value for a tune: "<mood>.<seed>". */
export function lofiLinkValue(link: LofiLink): string { return `${link.mood}.${link.seed >>> 0}`; }

/** Read a `lofi` link parameter. Anything not a known mood and a 32-bit seed is ignored. */
export function parseLofiLink(value: string | null | undefined): LofiLink | null {
  const m = /^([a-zA-Z]+)\.(\d{1,10})$/.exec(value ?? '');
  if (!m) return null;
  const mood = m[1] as LofiMood;
  const seed = Number(m[2]);
  if (!LOFI_STATION_MOODS.includes(mood) || !Number.isInteger(seed) || seed > 4294967295) return null;
  return { mood, seed };
}

/** A link that opens the app and plays the tune now playing (a saved generator track
 *  opens in the music generator, the one place its settings travel). Null when nothing is. */
export function lofiShareUrl(origin: string): string | null {
  const generator = savedTunes.get(stationId)?.generator;
  if (generator && station) return `${origin}/#/music?${generator}`;
  const mood = savedTunes.get(stationId)?.mood ?? lofiMoodOf(stationId);
  const seed = station?.current?.tune.seed ?? heard[heard.length - 1];
  if (!mood || seed === undefined || !station) return null;
  return `${origin}/#/?lofi=${lofiLinkValue({ mood, seed })}`;
}

/** The link this page was opened with, if any (the hash query, like `?lang`, or the search). */
export function readLofiLink(loc: { hash: string; search: string }): LofiLink | null {
  const hashQuery = loc.hash.split('?')[1] ?? '';
  return parseLofiLink(new URLSearchParams(hashQuery).get('lofi') ?? new URLSearchParams(loc.search).get('lofi'));
}

/** The same location without its `lofi` parameter, so a reload does not queue the tune again. */
export function withoutLofiLink(loc: { pathname: string; hash: string; search: string }): string {
  const [route, hashQuery = ''] = loc.hash.split('?');
  const hq = new URLSearchParams(hashQuery);
  hq.delete('lofi');
  const sq = new URLSearchParams(loc.search);
  sq.delete('lofi');
  const search = sq.toString();
  const hqs = hq.toString();
  return `${loc.pathname}${search ? `?${search}` : ''}${route ?? ''}${hqs ? `?${hqs}` : ''}`;
}
