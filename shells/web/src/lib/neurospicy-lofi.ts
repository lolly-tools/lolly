// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi stations in the Neurospicy player: three endless, generated stations (warm,
 * late night and rainy) that sit in the track list beside the catalog, uploads and
 * internet radio. Each plays engine/src/lofi-compose.ts's tunes through
 * lib/lofi-station.ts, one after another, never the same twice.
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
import type { LofiMood, LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';
import type { LofiStation } from './lofi-station.ts';

export const LOFI_PREFIX = 'lofi:';
/** The moods, in picker order. Kept here (not imported) so this module never loads the composer. */
export const LOFI_STATION_MOODS: readonly LofiMood[] = ['warm', 'lateNight', 'rainy'];
export const LOFI_MOOD_LABEL: Record<LofiMood, string> = { warm: 'Warm', lateNight: 'Late night', rainy: 'Rainy' };

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

/** The three stations as player tracks (the same shape as lib/neurospicy.ts's NeuroTrack). */
export function lofiTracks(): Array<{ id: string; name: string; tags: string[]; format: string }> {
  return LOFI_STATION_MOODS.map((mood) => ({ id: lofiId(mood), name: `Lofi · ${LOFI_MOOD_LABEL[mood]}`, tags: ['generated'], format: 'lofi' }));
}

// ── the live station ─────────────────────────────────────────────────────────

let station: LofiStation | null = null;
let stationId = '';
/** Seeds heard on the current station, oldest first; the last is playing. */
let heard: number[] = [];
/** A seed a shared link asked for, waiting for the station to start. */
let queued: number | null = null;
/** The tune to come back to after a pause: its station and seed. */
let resume: { id: string; seed: number } | null = null;

function freshSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0]!;
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

function notifyTune(): void {
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-tune'));
}

/**
 * Start station `id` into `dest` on `ctx`. A queued link seed wins; then the tune that
 * was paused, if it was this station's; otherwise a new tune.
 */
export async function startLofi(ctx: AudioContext, dest: AudioNode, id: string, prefs: LofiPrefs): Promise<void> {
  const mood = lofiMoodOf(id);
  if (!mood) return;
  const { LofiStation } = await import('./lofi-station.ts');
  stopLofi();
  const seed = queued ?? (resume?.id === id ? resume.seed : freshSeed());
  queued = null;
  if (stationId !== id || heard[heard.length - 1] !== seed) heard = [...(stationId === id ? heard : []), seed].slice(-50);
  stationId = id;
  const s = new LofiStation(ctx, dest, seed, { mood, drums: prefs.drums, texture: prefs.texture });
  s.setVolume(1);
  s.onBar = (bar) => {
    if (bar.index !== 0) return;
    // A tune that followed on by itself joins the run, so Previous can go back to that tune.
    if (heard[heard.length - 1] !== bar.tune.seed) heard = [...heard, bar.tune.seed].slice(-50);
    notifyTune();
  };
  s.start();
  station = s;
  notifyTune();
}

/** Stop the station, remembering its tune so playing again picks it up. */
export function stopLofi(): void {
  if (!station) return;
  const seed = station.current?.tune.seed ?? heard[heard.length - 1];
  if (seed !== undefined) resume = { id: stationId, seed };
  station.stop(0.25);
  station.onBar = null;
  station = null;
}

/** Is a station sounding? */
export function lofiLive(): boolean { return station !== null; }

/** The tune now playing, once its first bar has started. */
export function lofiTune(): LofiTuneInfo | null { return station?.current?.tune ?? null; }

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

/** Apply the listener's drums and texture to the live station. */
export function applyLofiPrefs(prefs: LofiPrefs): void {
  station?.setDrums(prefs.drums);
  station?.setTexture(prefs.texture);
}

/** Play `seed` the next time a station starts (a shared link). */
export function queueLofiSeed(seed: number): void { queued = seed >>> 0; }

// ── shared links ─────────────────────────────────────────────────────────────

/** A shared tune: its station's mood and its seed. */
export interface LofiLink { mood: LofiMood; seed: number }

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

/** A link that opens the app and plays the tune now playing. Null when nothing is. */
export function lofiShareUrl(origin: string): string | null {
  const mood = lofiMoodOf(stationId);
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
