// SPDX-License-Identifier: MPL-2.0
/**
 * A kept tune (lib/music-project.ts) rendered to a file the way the music generator's
 * Download makes one (views/music-studio.ts, render and download): the whole track at
 * full quality from its settings, with the same fade at the end, as M4A (WAV where the
 * browser has no AAC encoder), carrying Content Credentials that say the music
 * generator made the file, which is how the Download panel starts. The folder render
 * (pro/batch.ts) calls this for a tune in a folder, so a folder of projects comes out
 * with its music beside its pictures.
 */
import { parseMusicState, trackSeconds, trackSettings } from './music-state.ts';
import { lofiStationName } from './neurospicy-lofi.ts';
import { musicProjectTitle } from './music-project.ts';

/** The reverb's tail after the last bar, and the fade over it, as the generator renders. */
const TAIL_SECONDS = 2.5;
const SAMPLE_RATE = 44100;

export interface MusicFile {
  blob: Blob;
  format: 'm4a' | 'wav';
  /** A link that opens the tune in the music generator. */
  url: string;
  /** What the file's Content Credentials record, read back from the file; null when none were written. */
  declaration: string | null;
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
  let declaration: string | null = null;
  try {
    const { signTrackDownload } = await import('./tune-provenance.ts');
    const signed = await signTrackDownload(host, blob, format, { name: musicProjectTitle(state), style: state.mood, styleName: lofiStationName(state.mood), seed: state.seed });
    blob = signed.blob;
    declaration = signed.declaration;
  } catch { /* written without credentials: the declaration stays null, and the file is still the tune */ }
  return { blob, format, url: `${location.origin}${location.pathname}#/music?${params}`, declaration };
}
