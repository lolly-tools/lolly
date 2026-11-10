// SPDX-License-Identifier: MPL-2.0
/**
 * A saved tune (lib/lofi-tune.ts) in an asset preview's `<audio>` element, playable the
 * moment someone presses play.
 *
 * A tune is a recipe, so the element has nothing to play until the recipe is rendered to
 * a WAV, and a full-length generator track renders at about four times real time: half a
 * minute for a two-minute track. A press in that time used to do nothing at all. Now a
 * press before the WAV is ready plays the tune live instead, on the same station the
 * Neurospicy player uses, streamed into the element (a MediaStream), so the transport's
 * play, pause, clock, volume and mute all work as they do for a file.
 *
 * The WAV keeps rendering, and takes over at the next natural stop: a pause (at the same
 * point in the track) or the end of the track. From then on the element plays the file,
 * which is what makes the scrubber, the level meter and the visualiser available (each
 * needs a real source; the meter waits for one, see lib/audio-meter.ts). A press after the
 * WAV is ready plays the file directly, as before.
 *
 * Live and rendered play the same notes with the same instruments, mix and length: both
 * come from the recipe, through the station settings that recipe gives.
 */
import { lofiTuneFromUrl, lofiTuneUrlToWavBlobUrl, type LofiTuneRecipe } from './lofi-tune.ts';

/** Seconds of reverb tail after the last bar, the same as the rendered WAV keeps. */
const TAIL = 2.5;

export interface TunePreview {
  /** Stop a live tune and drop the listeners. The WAV blob stays on `dataset.wavBlob`, for the sheet to free. */
  dispose(): void;
}

interface Live {
  ctx: AudioContext;
  stop(): void;
  /** Seconds into the track, from the live context's clock (which stops while suspended). */
  position(): number;
  /** Set the end-of-track timer from the current position (on), or clear it (off). */
  arm(on: boolean): void;
}

/** The station settings and length that play `recipe` as its WAV sounds. */
async function liveSettings(recipe: LofiTuneRecipe): Promise<{ seed: number; settings: import('./lofi-station.ts').LofiSettings; mix?: import('./lofi-station.ts').LofiMix; seconds: number }> {
  if (recipe.generator) {
    const { parseMusicState, trackSettings, trackSeconds } = await import('./music-state.ts');
    const state = parseMusicState(recipe.generator);
    return { seed: state.seed, settings: trackSettings(state), mix: state.mix, seconds: trackSeconds(state) + TAIL };
  }
  const { lofiTuneSeconds } = await import('../../../../engine/src/lofi-compose.ts');
  // The same settings renderLofiTunePcm renders a station tune with.
  return { seed: recipe.seed, settings: { mood: recipe.mood, drums: true, texture: 0.5, repeat: true }, seconds: lofiTuneSeconds(recipe.seed, recipe.mood) + TAIL };
}

/**
 * Give `audioEl` the tune at `url`. `onError` is told when the WAV cannot be made; live
 * playback still works without one.
 */
export function attachTunePreview(audioEl: HTMLAudioElement, url: string, onError: () => void): TunePreview {
  let disposed = false;
  let wav: string | null = null;
  let live: Live | null = null;
  let starting = false;

  /** Hand the element the rendered file, at `at` seconds. */
  const useWav = (at: number): void => {
    if (!wav || disposed) return;
    audioEl.srcObject = null;
    audioEl.src = wav;
    if (at > 0) audioEl.addEventListener('loadedmetadata', () => { audioEl.currentTime = Math.min(at, audioEl.duration || at); }, { once: true });
  };

  const stopLive = (): number => {
    if (!live) return 0;
    const at = live.position();
    live.stop();
    void live.ctx.close().catch(() => { /* already closed */ });
    live = null;
    return at;
  };

  const startLive = async (): Promise<void> => {
    if (starting || live || disposed) return;
    starting = true;
    try {
      const recipe = await lofiTuneFromUrl(url);
      const [{ LofiStation }, plan] = await Promise.all([import('./lofi-station.ts'), liveSettings(recipe)]);
      if (disposed || audioEl.src) return;
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const station = new LofiStation(ctx, dest, plan.seed, plan.settings, plan.mix);
      const startedAt = ctx.currentTime + 0.1;
      station.start();
      let ends: ReturnType<typeof setTimeout> | null = null;
      const position = (): number => Math.max(0, ctx.currentTime - startedAt);
      live = {
        ctx,
        stop: () => { if (ends) clearTimeout(ends); station.stop(0.05); },
        position,
        // The end of the track: hand over to the file, at the start, ready to play again.
        arm: (on) => {
          if (ends) clearTimeout(ends);
          ends = on ? setTimeout(() => {
            stopLive();
            audioEl.pause();
            if (wav) useWav(0); else { audioEl.srcObject = null; audioEl.load(); }
          }, Math.max(0, (plan.seconds - position()) * 1000)) : null;
        },
      };
      live.arm(true);
      if (ctx.state === 'suspended') await ctx.resume().catch(() => { /* the next press resumes */ });
      audioEl.srcObject = dest.stream;
      await audioEl.play().catch(() => { /* the transport repaints from the element */ });
    } catch {
      // No live playback (no AudioContext, an unreadable recipe): the WAV still arrives.
    } finally {
      starting = false;
      // The file arrived while the live tune was starting, and the live tune did not start.
      if (!live && wav && !audioEl.src) useWav(0);
    }
  };

  // A press with nothing to play yet starts the tune live.
  const onPlay = (): void => {
    if (disposed) return;
    if (live) { if (live.ctx.state === 'suspended') void live.ctx.resume(); live.arm(true); return; }
    if (!audioEl.src && !audioEl.srcObject) void startLive();
  };
  // A pause holds the live tune where it is; once the file is ready it takes over there.
  const onPause = (): void => {
    if (!live || starting) return;
    if (wav) { useWav(stopLive()); return; }
    live.arm(false);
    void live.ctx.suspend();
  };
  audioEl.addEventListener('play', onPlay);
  audioEl.addEventListener('pause', onPause);

  void lofiTuneUrlToWavBlobUrl(url).then((made) => {
    if (disposed) { URL.revokeObjectURL(made); return; }
    wav = made;
    audioEl.dataset.wavBlob = made;
    // Playing live: the file waits for the next pause or the end. Otherwise it is the source now.
    if (!live && !starting) useWav(0);
  }).catch(() => { if (!disposed) onError(); });

  return {
    dispose(): void {
      disposed = true;
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('pause', onPause);
      stopLive();
      if (audioEl.srcObject) { audioEl.pause(); audioEl.srcObject = null; }
    },
  };
}
