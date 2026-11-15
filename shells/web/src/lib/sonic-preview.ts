// SPDX-License-Identifier: MPL-2.0
/** Auditions use the same music renderer and gain envelopes as sequence exports. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { SonicRecipeV1 } from '../../../../packages/core/src/sonic-profile-v1.ts';
import { bedDuckEnvelope } from '../bridge/audio-envelope.ts';
import { mixWindow } from '../bridge/mix-window.ts';
import { renderLofiTunePcm } from './lofi-tune.ts';
import { parseMusicState } from './music-state.ts';
import { pcmToWavBlob } from './pcm-wav.ts';

export async function auditionSonicRecipe(
  recipe: SonicRecipeV1,
  host: Pick<HostV1, 'speech'>,
  signal: AbortSignal,
  script?: string
): Promise<Blob> {
  const context = recipe.profile.contexts.find((c) => c.id === recipe.contextId)!;
  const state = parseMusicState(recipe.music.parameters);
  let voice: Awaited<ReturnType<NonNullable<HostV1['speech']>['synthesize']>> | undefined;
  if (script !== undefined) {
    if (!host.speech)
      throw new Error('Speech is unavailable in this shell. You can still listen to the music.');
    if (!context.narration.voice)
      throw new Error('Choose a voice before listening with narration.');
    if (!script.trim()) throw new Error('Write a short sample before listening with narration.');
    // Pronunciations are literal substitutions, longest phrases first; never executable patterns.
    let spoken = script;
    for (const entry of [...context.narration.pronunciations].sort(
      (a, b) => b.written.length - a.written.length
    )) {
      if (entry.written) spoken = spoken.split(entry.written).join(entry.spoken);
    }
    voice = await host.speech.synthesize(spoken, {
      voice: context.narration.voice,
      speed: context.narration.speed,
      signal,
    });
    signal.throwIfAborted();
  }
  const rate = voice?.sampleRate ?? 48000;
  const seconds = voice ? voice.duration + 2 : 12;
  const music = await renderLofiTunePcm(
    { mood: state.mood, seed: state.seed, generator: recipe.music.parameters },
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
            volume: voice ? context.narration.bedVolume : 0.7,
            centre: voice ? context.narration.duck : 1,
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
  // A common attenuation prevents clipping without changing the chosen voice/bed balance.
  let peak = 1;
  for (let i = 0; i < left.length; i++)
    peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  if (peak > 1)
    for (let i = 0; i < left.length; i++) {
      left[i] = left[i]! / peak;
      right[i] = right[i]! / peak;
    }
  return pcmToWavBlob({ left, right, sampleRate: rate });
}
