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
 * Nothing heavy loads with this module: the composer and the station are imported at
 * the point a tune is rendered.
 */
import type { LofiMood } from '../../../../engine/src/lofi-compose.ts';
import type { RenderedPcm } from '../../../../engine/src/zzfxm.ts';
import { LOFI_STATION_MOODS, LOFI_MOOD_LABEL, type LofiLink, type LofiPrefs } from './neurospicy-lofi.ts';

/** The asset format of a saved tune. */
export const LOFI_TUNE_FORMAT = 'lofi';
/** The `kind` the bytes carry, so a stray JSON file is never read as a tune. */
const KIND = 'lolly-lofi-tune';
/** Reverb and echo still ringing after the last bar, rendered so the end is not cut. */
const TAIL_SECONDS = 2.5;

/** A saved tune's recipe: its station's mood and its seed. */
export type LofiTuneRecipe = LofiLink;

/** The bytes stored for a saved tune. */
export function lofiTuneBytes(recipe: LofiTuneRecipe): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ kind: KIND, version: 1, mood: recipe.mood, seed: recipe.seed >>> 0 }));
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
  const { mood, seed } = value as { mood?: unknown; seed?: unknown };
  if (typeof mood !== 'string' || !LOFI_STATION_MOODS.includes(mood as LofiMood)) return null;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) return null;
  return { mood: mood as LofiMood, seed };
}

/** Fetch and read a saved tune from its asset url. */
export async function lofiTuneFromUrl(url: string): Promise<LofiTuneRecipe> {
  const recipe = lofiTuneFromBytes(new Uint8Array(await (await fetch(url)).arrayBuffer()));
  if (!recipe) throw new Error('this asset is not a saved tune');
  return recipe;
}

/** A saved tune's library name: its station, key and tempo, e.g. "Lolly Sings · C major · 96 bpm". */
export function lofiTuneName(recipe: LofiTuneRecipe, tune: { key: string; bpm: number }): string {
  return `${LOFI_MOOD_LABEL[recipe.mood]} · ${tune.key} · ${Math.round(tune.bpm)} bpm`;
}

/**
 * Render a saved tune to stereo PCM. Without `seconds` the tune plays once, with its
 * reverb tail; with `seconds` it repeats to fill that length (a video's music bed).
 */
export async function renderLofiTunePcm(
  recipe: LofiTuneRecipe,
  opts: { seconds?: number; prefs?: LofiPrefs; sampleRate?: number } = {},
): Promise<RenderedPcm> {
  const [{ lofiTuneSeconds }, { renderLofi }] = await Promise.all([
    import('../../../../engine/src/lofi-compose.ts'),
    import('./lofi-station.ts'),
  ]);
  const seconds = opts.seconds ?? lofiTuneSeconds(recipe.seed, recipe.mood) + TAIL_SECONDS;
  const prefs = opts.prefs ?? { drums: true, texture: 0.5 };
  const buf = await renderLofi(recipe.seed, { mood: recipe.mood, drums: prefs.drums, texture: prefs.texture, repeat: true }, seconds, opts.sampleRate ?? 44100);
  return { left: buf.getChannelData(0), right: buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0), sampleRate: buf.sampleRate };
}

/** Render a saved tune at `url` to a WAV blob url (asset details, video music beds). */
export async function lofiTuneUrlToWavBlobUrl(url: string, seconds?: number): Promise<string> {
  const [recipe, { pcmToWavBlob }] = await Promise.all([lofiTuneFromUrl(url), import('./pcm-wav.ts')]);
  return URL.createObjectURL(pcmToWavBlob(await renderLofiTunePcm(recipe, { seconds })));
}
