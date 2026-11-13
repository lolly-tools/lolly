// SPDX-License-Identifier: MPL-2.0
/**
 * A saved tune: one generated station tune kept in the asset library, so it can be
 * played again later. The asset is the recipe, not a recording: its bytes are a few
 * dozen characters of JSON naming the station's mood and the tune's seed, and the tune
 * is composed again whenever it plays. Composing is deterministic, so the saved tune
 * is the same tune every time, on every device.
 *
 * The format follows the other songs-as-data the library holds (ZzFXM songs, tracker
 * modules, rondocode songs): the Neurospicy player plays it live through
 * lib/lofi-station.ts, with the listener's drums and texture; the asset details, a
 * video's music bed and any tool reading audio render it to PCM or a WAV first.
 *
 * A tune saved from the music generator carries the generator's settings too (version 2:
 * its instruments per section, tempo, key, mix and length, as the generator's link
 * parameters), so it plays and renders exactly as it was made, everywhere a saved tune
 * plays: the player, the asset details, a video's music bed, an audiogram.
 *
 * Nothing heavy loads with this module: the composer and the station are imported at
 * the point a tune is rendered.
 */
import type { LofiMood } from '../../../../engine/src/lofi-compose.ts';
import type { RenderedPcm } from '../../../../engine/src/zzfxm.ts';
import { LOFI_STATION_MOODS, lofiStationName, type LofiLink, type LofiPrefs } from './neurospicy-lofi.ts';

/** The asset format of a saved tune. */
export const LOFI_TUNE_FORMAT = 'lofi';
/** The `kind` the bytes carry, so a stray JSON file is never read as a tune. */
const KIND = 'lolly-lofi-tune';
/** Reverb and echo still ringing after the last bar, rendered so the end is not cut. */
const TAIL_SECONDS = 2.5;

/**
 * A saved tune's recipe: its station's mood and its seed, and for a music generator track
 * the generator's link parameters (lib/music-state.ts), which win over the mood and seed.
 */
export type LofiTuneRecipe = LofiLink & { generator?: string };

/** The bytes stored for a saved tune: version 1 a station tune, version 2 a generator track. */
export function lofiTuneBytes(recipe: LofiTuneRecipe): Uint8Array {
  const base = { kind: KIND, version: recipe.generator ? 2 : 1, mood: recipe.mood, seed: recipe.seed >>> 0 };
  return new TextEncoder().encode(JSON.stringify(recipe.generator ? { ...base, generator: recipe.generator } : base));
}

/** Read a saved tune's bytes, or null when they are not one. */
export function lofiTuneFromBytes(bytes: Uint8Array): LofiTuneRecipe | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes)) as { kind?: unknown; mood?: unknown; seed?: unknown };
    return lofiTuneFromMeta(v.kind === KIND ? v : null);
  } catch { return null; }
}

/** The recipe in an asset's `meta.lofi` (written when the tune is saved), or null. */
export function lofiTuneFromMeta(value: unknown): LofiTuneRecipe | null {
  if (!value || typeof value !== 'object') return null;
  const { mood, seed, generator } = value as { mood?: unknown; seed?: unknown; generator?: unknown };
  if (typeof mood !== 'string' || !LOFI_STATION_MOODS.includes(mood as LofiMood)) return null;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) return null;
  // A generator track's settings are its link's parameters: short, and read back by the
  // same parser the generator uses, which ignores anything it does not know.
  const gen = typeof generator === 'string' && generator.length < 4000 ? generator : undefined;
  return { mood: mood as LofiMood, seed, ...(gen ? { generator: gen } : {}) };
}

/** Fetch and read a saved tune from its asset url. */
export async function lofiTuneFromUrl(url: string): Promise<LofiTuneRecipe> {
  const recipe = lofiTuneFromBytes(new Uint8Array(await (await fetch(url)).arrayBuffer()));
  if (!recipe) throw new Error('this asset is not a saved tune');
  return recipe;
}

/** A saved tune's library name: its station, key and tempo, e.g. "Lolly Sings · C major · 96 bpm". */
export function lofiTuneName(recipe: LofiTuneRecipe, tune: { key: string; bpm: number }): string {
  return `${lofiStationName(recipe.mood)} · ${tune.key} · ${Math.round(tune.bpm)} bpm`;
}

/**
 * Render a saved tune to stereo PCM. Without `seconds` the tune plays once, with its
 * reverb tail; with `seconds` it repeats to fill that length (a video's music bed).
 */
export function renderLofiTunePcm(
  recipe: LofiTuneRecipe,
  opts: { seconds?: number; prefs?: LofiPrefs; sampleRate?: number } = {},
): Promise<RenderedPcm> {
  // Two callers can ask for the same render at once (a tune's waveform in Assets and a
  // music bed's WAV): they share one instead of each taking the whole time.
  return shareRender(renderKey(recipe, opts), () => renderUnshared(recipe, opts), inflight);
}

const inflight = new Map<string, Promise<RenderedPcm>>();
/** What makes two renders the same render: the recipe and every option. */
export function renderKey(recipe: LofiTuneRecipe, opts: { seconds?: number; prefs?: LofiPrefs; sampleRate?: number }): string {
  return JSON.stringify([recipe.mood, recipe.seed >>> 0, recipe.generator ?? '', opts.seconds ?? null, opts.sampleRate ?? 44100, opts.prefs ?? null]);
}
/** Run `make` once for every caller asking for `key` while the first run is still going. Nothing is kept afterwards. */
export function shareRender<T>(key: string, make: () => Promise<T>, pending: Map<string, Promise<T>>): Promise<T> {
  const running = pending.get(key);
  if (running) return running;
  const run = make().finally(() => { pending.delete(key); });
  pending.set(key, run);
  return run;
}

async function renderUnshared(
  recipe: LofiTuneRecipe,
  opts: { seconds?: number; prefs?: LofiPrefs; sampleRate?: number },
): Promise<RenderedPcm> {
  if (recipe.generator) return renderTrackPcm(recipe.generator, opts);
  const [{ lofiTuneSeconds }, { renderLofi }] = await Promise.all([
    import('../../../../engine/src/lofi-compose.ts'),
    import('./lofi-station.ts'),
  ]);
  const seconds = opts.seconds ?? lofiTuneSeconds(recipe.seed, recipe.mood) + TAIL_SECONDS;
  const prefs = opts.prefs ?? { drums: true, texture: 0.5 };
  const buf = await renderLofi(recipe.seed, { mood: recipe.mood, drums: prefs.drums, texture: prefs.texture, repeat: true }, seconds, opts.sampleRate ?? 44100);
  return { left: buf.getChannelData(0), right: buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0), sampleRate: buf.sampleRate };
}

/**
 * Render a music generator track (its link's parameters) to stereo PCM, exactly as the
 * generator plays it: its instruments, tempo, key, mix and length, with its reverb tail.
 * With `seconds` longer than the track (a video's music bed) the track loops to fill the time.
 */
async function renderTrackPcm(generator: string, opts: { seconds?: number; sampleRate?: number }): Promise<RenderedPcm> {
  const [{ parseMusicState, trackSeconds, trackSettings }, { renderLofi }] = await Promise.all([import('./music-state.ts'), import('./lofi-station.ts')]);
  const state = parseMusicState(generator);
  const sampleRate = opts.sampleRate ?? 44100;
  const once = trackSeconds(state) + TAIL_SECONDS;
  const buf = await renderLofi(state.seed, trackSettings(state), Math.min(once, opts.seconds ?? once), sampleRate, state.mix);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0);
  if (!opts.seconds || opts.seconds <= once) return { left, right, sampleRate };
  // Loop the track, without its tail, to fill the length asked for.
  const loop = Math.max(1, Math.floor((once - TAIL_SECONDS) * sampleRate));
  const total = Math.ceil(opts.seconds * sampleRate);
  const tile = (src: Float32Array): Float32Array => { const out = new Float32Array(total); for (let i = 0; i < total; i++) out[i] = src[i % loop]!; return out; };
  return { left: tile(left), right: tile(right), sampleRate };
}

/** Render a saved tune at `url` to a WAV blob url (video music beds). */
export async function lofiTuneUrlToWavBlobUrl(url: string, seconds?: number): Promise<string> {
  const [recipe, { pcmToWavBlob }] = await Promise.all([lofiTuneFromUrl(url), import('./pcm-wav.ts')]);
  return URL.createObjectURL(pcmToWavBlob(await renderLofiTunePcm(recipe, { seconds })));
}
