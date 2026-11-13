// SPDX-License-Identifier: MPL-2.0
/**
 * A saved tune (lib/lofi-tune.ts) in an asset preview, played the way the Neurospicy
 * player plays one: live, on the same station, from its recipe. Nothing is rendered
 * first, so the tune plays the moment someone presses play.
 *
 * The station plays into one gain, and from there two ways: into the preview's `<audio>`
 * element (a MediaStream), so the transport's play, pause, volume and mute work as they
 * do for a file; and into an analyser, which the level meter and the visualiser read
 * (`tap()`, see lib/audio-meter.ts). The analyser sits before the element's volume, as
 * the Neurospicy player's visualiser feed does, so the bars move however quietly the
 * tune plays.
 *
 * The transport reads the tune's place from `source`: the bar playing and its time, from
 * the same bars and the same position the Neurospicy player uses (lib/neurospicy-lofi.ts).
 * A seek starts the tune again from the top of the nearest bar on a new station, as the
 * music generator plays from a bar. A pause holds the tune where it is; the end of the
 * tune stops it and puts it back at the top.
 */
import { lofiTuneFromUrl, type LofiTuneRecipe } from './lofi-tune.ts';
import { nearestBar, stationPosition, trackTimeline, tuneTimeline, type LofiTimeline } from './neurospicy-lofi.ts';
import { positionWords } from './neuro-position.ts';
import type { LofiMix, LofiSettings, LofiStation } from './lofi-station.ts';
import type { TransportSource } from './audio-transport.ts';

/** Seconds of reverb tail a generator track keeps after its last bar. */
const TAIL = 2.5;
/** A new station starts its first bar this far in (lib/lofi-station.ts start()). */
const LEAD = 0.1;

export interface TunePreview {
  /** Stop the tune, close its audio and drop the listeners. */
  dispose(): void;
  /** The analyser the level meter and the visualiser read, and its context, while the tune is live. */
  tap(): { analyser: AnalyserNode; context: BaseAudioContext } | null;
  /** The tune's place and its bars, for the transport's clock and scrubber. */
  readonly source: TransportSource;
}

/** How a recipe plays: the station settings from a bar, its mix, its bars, and where it is over. */
export interface TunePlan {
  seed: number;
  settings(startBar: number): LofiSettings;
  mix?: LofiMix;
  line: LofiTimeline;
  /** A generator track counts its bars by their place in the track, a tune by their index in the tune. */
  byPlace: boolean;
  /** Seconds from the top at which the tune is over. */
  end: number;
}

/** The plan for `recipe`: the same station settings its WAV renders with (lib/lofi-tune.ts). */
export async function tunePlan(recipe: LofiTuneRecipe): Promise<TunePlan> {
  const compose = await import('../../../../engine/src/lofi-compose.ts');
  if (recipe.generator) {
    const music = await import('./music-state.ts');
    const state = music.parseMusicState(recipe.generator);
    const line = trackTimeline(compose, music, state);
    return { seed: state.seed, settings: (bar) => music.trackSettings(state, bar), mix: state.mix, line, byPlace: true, end: line.total + TAIL };
  }
  const line = tuneTimeline(compose, recipe.mood, recipe.seed);
  // A station tune ends on a rest bar, which holds its tail; after it the tune would start again.
  return {
    seed: recipe.seed,
    settings: (bar) => ({ mood: recipe.mood, drums: true, texture: 0.5, repeat: true, ...(bar ? { startBar: bar } : {}) }),
    line, byPlace: false, end: line.total,
  };
}

interface Live { ctx: AudioContext; out: GainNode; analyser: AnalyserNode; station: LofiStation | null }

/**
 * Give `audioEl` the tune at `url`. `onError` is told when the tune cannot be read or
 * played.
 */
export function attachTunePreview(audioEl: HTMLAudioElement, url: string, onError: () => void): TunePreview {
  let disposed = false;
  let plan: TunePlan | null = null;
  let live: Live | null = null;
  let starting = false;
  let Station: typeof LofiStation | null = null;
  /** The bar the next start begins at (a seek before playing, or the top). */
  let from = 0;
  /** The bar a new station starts on, until that bar sounds. */
  let pending: number | null = null;
  let ends: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const changed = (): void => { for (const l of listeners) { try { l(); } catch { /* one listener never blocks the rest */ } } };

  const ready = lofiTuneFromUrl(url).then(tunePlan).then((p) => {
    if (!disposed) { plan = p; changed(); }
    return p;
  }).catch(() => { if (!disposed) onError(); return null; });

  const position = (): { seconds: number; duration: number } | null => {
    if (!plan) return null;
    const { line } = plan;
    const station = live?.station ?? null;
    const bar = pending ?? (station ? null : from);
    if (bar !== null || !station) return { seconds: line.starts[bar ?? 0] ?? 0, duration: line.total };
    return { seconds: stationPosition(station, line, plan.byPlace)?.seconds ?? 0, duration: line.total };
  };

  const stopLive = (): void => {
    if (ends) clearTimeout(ends);
    ends = null;
    pending = null;
    if (!live) return;
    if (live.station) { live.station.onBar = null; live.station.stop(0.05); }
    void live.ctx.close().catch(() => { /* already closed */ });
    live = null;
  };

  /** The end of the tune: stop, and stand ready at the top. */
  const finish = (): void => {
    stopLive();
    from = 0;
    audioEl.pause();
    audioEl.srcObject = null;
    audioEl.load();
    changed();
  };

  /** Run the end-of-tune timer from where the tune is now (on), or stop it (off). */
  const arm = (on: boolean): void => {
    if (ends) clearTimeout(ends);
    ends = null;
    if (!on || !plan || !live) return;
    const lead = pending !== null ? LEAD : 0;
    ends = setTimeout(finish, Math.max(0, plan.end - (position()?.seconds ?? 0) + lead) * 1000);
  };

  /** Start a station on `bar`, fading out the one before. */
  const playFrom = (bar: number): void => {
    if (!live || !plan || !Station) return;
    const old = live.station;
    if (old) { old.onBar = null; old.stop(0.08); }
    const s = new Station(live.ctx, live.out, plan.seed, plan.settings(bar), plan.mix);
    s.setVolume(1);
    pending = bar;
    s.onBar = () => {
      if (live?.station !== s || pending === null) return;
      pending = null;
      changed();
    };
    s.start();
    live.station = s;
    arm(!audioEl.paused);
    changed();
  };

  const startLive = async (): Promise<void> => {
    if (starting || live || disposed) return;
    starting = true;
    try {
      const p = await ready;
      if (!p || disposed) return;
      Station ??= (await import('./lofi-station.ts')).LofiStation;
      if (disposed) return;
      const ctx = new AudioContext();
      const out = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      // The analyser has to be pulled to run: into a silent gain, then the speakers.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      out.connect(dest);
      out.connect(analyser);
      analyser.connect(sink);
      sink.connect(ctx.destination);
      live = { ctx, out, analyser, station: null };
      playFrom(from);
      if (ctx.state === 'suspended') await ctx.resume().catch(() => { /* the next press resumes */ });
      audioEl.srcObject = dest.stream;
      await audioEl.play().catch(() => { /* the transport repaints from the element */ });
      arm(!audioEl.paused);
    } catch {
      if (!disposed) onError();
    } finally {
      starting = false;
    }
  };

  // A press with nothing to play yet starts the tune; a press after a pause carries on.
  const onPlay = (): void => {
    if (disposed) return;
    if (live) { if (live.ctx.state === 'suspended') void live.ctx.resume(); arm(true); return; }
    if (!audioEl.srcObject) void startLive();
  };
  // A pause holds the tune where it is.
  const onPause = (): void => {
    if (!live || starting) return;
    arm(false);
    void live.ctx.suspend();
  };
  audioEl.addEventListener('play', onPlay);
  audioEl.addEventListener('pause', onPause);

  const source: TransportSource = {
    position,
    seek(seconds: number): void {
      if (!plan) return;
      const bar = nearestBar(plan.line.starts, seconds);
      if (live) playFrom(bar);
      else { from = bar; changed(); }
    },
    grid: () => (plan ? { points: plan.line.starts, marks: plan.line.marks } : null),
    describe: (seconds) => positionWords(seconds, plan?.line.total ?? 0, plan?.line ?? null),
    onChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };

  return {
    source,
    tap: () => (live ? { analyser: live.analyser, context: live.ctx } : null),
    dispose(): void {
      disposed = true;
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('pause', onPause);
      stopLive();
      listeners.clear();
      if (audioEl.srcObject) { audioEl.pause(); audioEl.srcObject = null; }
    },
  };
}
