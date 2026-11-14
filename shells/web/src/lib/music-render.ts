// SPDX-License-Identifier: MPL-2.0
/**
 * A kept tune (lib/music-project.ts) rendered to a file the way the music generator's
 * Download makes one (views/music-studio.ts, render and download): the whole track at
 * full quality from its settings, with the same fade at the end, as M4A (WAV where the
 * browser has no AAC encoder). The folder render (pro/batch.ts) calls this for a tune
 * in a folder, so a folder of projects comes out with its music beside its pictures.
 *
 * Every file made here, and every Download from the music generator, carries Content
 * Credentials and the plain description, with no switch to turn them off (Andy,
 * 2026-11-14): the description says the music generator made the tune procedurally with
 * no AI, and the credential records the same sentence as algorithmic media
 * (engine/src/tune-sign.ts), so a reader checking for undeclared generative AI finds a
 * declared origin instead. A file whose credential could not be written, or whose
 * reading back finds no declaration, is not handed on.
 */
import { parseMusicState, trackSeconds, trackSettings, type MusicState } from './music-state.ts';
import { genreTitle } from './genre-icons.ts';
import { musicProjectTitle } from './music-project.ts';
import { t } from '../i18n.ts';

/** The reverb's tail after the last bar, and the fade over it, as the generator renders. */
const TAIL_SECONDS = 2.5;
const SAMPLE_RATE = 44100;

export interface MusicFile {
  blob: Blob;
  format: 'm4a' | 'wav';
  /** A link that opens the tune in the music generator. */
  url: string;
  /** What the file's Content Credentials record, read back from the written file. */
  declaration: string;
}

/**
 * Sign a rendered tune, always: the plain description, then the credential, then a
 * reading of the written bytes. The folder render and the music generator's Download
 * both sign here. `name` is the credential's title, the project's title by default.
 * Throws when the credential could not be written or the reading finds no declaration.
 */
export async function credentialMusicFile(host: unknown, blob: Blob, format: MusicFile['format'], state: MusicState, name = musicProjectTitle(state)): Promise<{ blob: Blob; declaration: string }> {
  const { signTrackDownload } = await import('./tune-provenance.ts');
  const signed = await signTrackDownload(host, blob, format, { name, style: state.mood, styleName: genreTitle(state.mood), seed: state.seed });
  if (!signed.declaration) throw new Error(t('The tune’s Content Credentials did not read back, so the file was not made.'));
  return { blob: signed.blob, declaration: signed.declaration };
}

/** Render a tune from its link's settings (`style=…&seed=…`) to an audio file. */
export async function renderMusicFile(host: unknown, params: string): Promise<MusicFile> {
  const state = parseMusicState(params);
  const [{ LofiStation, renderStation }, { pcmFromAudioBuffer, encodeM4a, encodeWav }] = await Promise.all([
    import('./lofi-station.ts'), import('./audio-encode.ts'),
  ]);
  const seconds = trackSeconds(state) + TAIL_SECONDS;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const station = new LofiStation(ctx, ctx.destination, state.seed, { ...trackSettings(state), quality: 'high' }, state.mix);
  station.fadeOutAt(Math.max(0, seconds - TAIL_SECONDS), TAIL_SECONDS);
  const pcm = pcmFromAudioBuffer(await renderStation(ctx, station, seconds));
  let blob: Blob;
  let format: MusicFile['format'];
  try { blob = await encodeM4a(pcm); format = 'm4a'; } catch { blob = encodeWav(pcm); format = 'wav'; }
  const signed = await credentialMusicFile(host, blob, format, state);
  return { blob: signed.blob, format, url: `${location.origin}${location.pathname}#/music?${params}`, declaration: signed.declaration };
}
