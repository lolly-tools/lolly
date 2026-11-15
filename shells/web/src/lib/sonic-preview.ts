// SPDX-License-Identifier: MPL-2.0
/**
 * The Sound room's previews (lib/design-system/rooms/sound.ts): a short excerpt of a
 * sound, alone or under a spoken sample, made with the same music renderer and gain
 * envelopes as a sequence export. The excerpt fades out; it is not a composed ending.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { SonicNarrationV1 } from '@lolly-tools/core/sonic-profile-v1';
import { bedDuckEnvelope } from '../bridge/audio-envelope.ts';
import { mixWindow } from '../bridge/mix-window.ts';
import { renderLofiTunePcm } from './lofi-tune.ts';
import { parseMusicState } from './music-state.ts';
import { pcmToWavBlob } from './pcm-wav.ts';

/** How long a music-only preview plays, in seconds. */
export const PREVIEW_SECONDS = 12;

/** The spoken text with each pronunciation note applied: literal swaps, longest phrase first. */
export function spokenText(script: string, pronunciations: SonicNarrationV1['pronunciations']): string {
  let spoken = script;
  for (const entry of [...pronunciations].sort((a, b) => b.written.length - a.written.length)) {
    if (entry.written) spoken = spoken.split(entry.written).join(entry.spoken);
  }
  return spoken;
}

/** A preview as a WAV file: the music, or the music under the voice reading `script`. */
export async function auditionSound(
  parameters: string,
  host: Pick<HostV1, 'speech'>,
  signal: AbortSignal,
  narration?: { settings: SonicNarrationV1; script: string }
): Promise<Blob> {
  const state = parseMusicState(parameters);
  let voice: Awaited<ReturnType<NonNullable<HostV1['speech']>['synthesize']>> | undefined;
  if (narration) {
    const { settings, script } = narration;
    if (!host.speech) throw new Error('Speech is unavailable here. You can still listen to the music.');
    if (!settings.voice) throw new Error('Choose a voice first.');
    if (!script.trim()) throw new Error('Write a few words for the voice to read.');
    voice = await host.speech.synthesize(spokenText(script, settings.pronunciations), {
      voice: settings.voice,
      speed: settings.speed,
      signal,
    });
    signal.throwIfAborted();
  }
  const rate = voice?.sampleRate ?? 48000;
  const seconds = voice ? voice.duration + 2 : PREVIEW_SECONDS;
  const music = await renderLofiTunePcm(
    { mood: state.mood, seed: state.seed, generator: parameters },
    { seconds, sampleRate: rate }
  );
  signal.throwIfAborted();
  const [left, right] = mixWindow(
    {
      rate,
      clips: voice ? [{ pcm: [voice.pcm], startMs: 750 }] : [],
      beds: [
        {
          pcm: [music.left, music.right],
          events: bedDuckEnvelope({
            clipSec: seconds,
            volume: voice ? narration!.settings.bedVolume : 0.7,
            centre: voice ? narration!.settings.duck : 1,
            spans: voice ? [{ from: 0.75, to: voice.duration + 0.75 }] : [],
            fadeIn: 0.2,
            fadeOut: 0.8,
          }),
        },
      ],
    },
    0,
    Math.ceil(seconds * rate)
  );
  // A common attenuation prevents clipping without changing the chosen voice and music balance.
  let peak = 1;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  if (peak > 1)
    for (let i = 0; i < left.length; i++) {
      left[i] = left[i]! / peak;
      right[i] = right[i]! / peak;
    }
  return pcmToWavBlob({ left, right, sampleRate: rate });
}
