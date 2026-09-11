// SPDX-License-Identifier: MPL-2.0
/**
 * The `?neuro` demo deep-link - how the docs screenshot pipeline (url-shot recipes,
 * no clicking) captures the Neurospicy sound dock and the enlarged visualizer panel.
 *
 *   #/?neuro=player   dock open + expanded, Atmosphere section open with a demo mix
 *   #/?neuro=viz      the same, plus the enlarged viz panel (never fullscreen - 
 *                     requestFullscreen needs a user gesture)
 *
 * `viz` implies `player`; values outside that closed vocabulary are ignored. The param
 * rides the hash query like `lang` does (see peekUrlLang in main.ts).
 *
 * NOTHING PERSISTS AND NOTHING SOUNDS. The demo lights the feature flag in memory only
 * (overrideFlagInMemory), assigns the player/atmosphere state in memory only
 * (demoNeurospicy / demoAtmosphere - no persistLocal, no persistProfile), and never
 * touches the audio graph: isNeurospicyPlaying() is state-only, so the transport
 * renders the "playing" look silently. A shared ?neuro link affects one page load.
 *
 * Kept import-free at module top level (types only): lib/viz-support.ts consults
 * neuroDemoActive() from its synchronous probe, and everything heavier is
 * dynamic-imported inside applyNeuroDemo.
 */
import type { NeurospicyHost } from './neurospicy.ts';

// The two synchronous reads live in a leaf (lib/neuro-demo-peek.ts) so boot and
// the visualizer probe can ask "is this a ?neuro load?" without this driver. Re-
// exported here so every existing import site keeps working.
export { neuroDemoActive, peekNeuroDemo } from './neuro-demo-peek.ts';
export type { NeuroDemoMode } from './neuro-demo-peek.ts';
import { type NeuroDemoMode } from './neuro-demo-peek.ts';

/** How long to wait for the catalog sync before giving up on picking a demo track.
 *  Bounded so an empty catalog still yields a dock (with no selection) rather than
 *  a promise that never settles. */
const TRACKS_WAIT_MS = 20_000;


type NeuroModule = typeof import('./neurospicy.ts');

/**
 * The demo track: the first 'neurospicy'-tagged, non-radio entry in the canonical
 * playlist order. NOT loops[0] - radio is online-gated, so [0] is nondeterministic.
 * On a cold context the catalog sync hasn't landed when boot runs this, so wait for
 * the track-list invalidation main.ts fires once it does ('lolly:neuro-tracks').
 */
async function demoLoopId(host: NeurospicyHost, neuro: NeuroModule): Promise<string> {
  const pick = async (): Promise<string> =>
    (await neuro.listLoops(host))
      .find((t) => t.tags?.includes('neurospicy') && neuro.trackCategory(t) !== 'radio')?.id ?? '';
  const now = await pick();
  if (now || typeof document === 'undefined') return now;
  return new Promise<string>((resolve) => {
    const done = (id: string): void => {
      clearTimeout(timer);
      document.removeEventListener('lolly:neuro-tracks', onTracks);
      resolve(id);
    };
    const onTracks = (): void => { void pick().then((id) => { if (id) done(id); }); };
    const timer = setTimeout(() => done(''), TRACKS_WAIT_MS);
    document.addEventListener('lolly:neuro-tracks', onTracks);
  });
}

/**
 * Stage the demo: flag lit in memory, silent "playing" player state, an Atmosphere
 * mix with its section open, the dock shown expanded with no entrance animation
 * (the spring-in + confetti burst are nondeterministic), and for `viz` the enlarged
 * panel on top. Fire-and-forget from main.ts's boot.
 */
export async function applyNeuroDemo(host: NeurospicyHost, mode: NeuroDemoMode): Promise<void> {
  const [{ overrideFlagInMemory }, neuro, atmo] = await Promise.all([
    import('../feature-flags.ts'),
    import('./neurospicy.ts'),
    import('./atmosphere.ts'),
  ]);
  // In memory only - outranks the mirror, so this works even under the docs
  // pipeline's capture-neutral pin (which forces the mirror copy off).
  overrideFlagInMemory('neurospicy', true);
  const loopId = await demoLoopId(host, neuro);
  neuro.demoNeurospicy({ enabled: true, loopId, volume: 0.5, paused: false });
  // Real layer ids from ATMOSPHERE_LAYERS: Wind / Birdsong / Crickets.
  atmo.demoAtmosphere({ wind: 0.55, birds: 0.32, night: 0.18 }, { open: true });
  const dock = await import('../components/neuro-dock.ts');
  if (mode === 'viz') {
    // The rich visualiser lives in the dock now - open it in the expanded window (the
    // shell's draggable + resizable state). No fullscreen: requestFullscreen needs a
    // user gesture, and a capture has none.
    dock.openNeuroDockExpanded(host);
  } else {
    dock.showNeuroDock(host, { animateIn: false, forceExpanded: true });
  }
}

// ── the deterministic viz-demo kit ───────────────────────────────────────────
// Shared with the dock's DockViz renderer
// (lib/neurospicy-dock-host.ts) - so a ?neuro=viz capture renders the identical
// frozen field whichever surface hosts it. One source, because the two drifted
// once: when the enlarged viz moved from the panel into the dock (2026-08-14)
// the demo pump stayed behind in the panel, the dock ran a live loop instead,
// and the incl-neuro-viz docs baseline could never settle again. Import-free,
// per this module's own top-level rule.

/** The preset a ?neuro demo pins instead of the random start: the first `calm`
 *  entry in VIZ_PRESETS (Aurora). Hardcoded so a registry reorder shows up as a
 *  visible screenshot diff rather than silently drifting the baseline. */
export const DEMO_VIZ_PRESET_ID = 'aurora';

/** Frames the demo pump renders before freezing (enough for the preset's
 *  blend-in to finish and the field to mature), batched so SwiftShader (the
 *  docs pipeline's software GL) never blocks the main thread for the whole
 *  sequence. */
export const DEMO_VIZ_FRAMES = 180;
export const DEMO_VIZ_BATCH = 12;

/**
 * The demo's injected audio: a fixed 1024-byte time-domain window of summed
 * sines around the webaudio silence midpoint (128), generated once. With
 * `seed: 0` and `deterministic: true` on the mount, every capture renders the
 * visualizer from identical input: no analyser, no AudioContext, no sound.
 */
let demoVizWaveCache: Uint8Array | null = null;
export function demoVizWave(): Uint8Array {
  if (!demoVizWaveCache) {
    const w = new Uint8Array(1024);
    for (let i = 0; i < w.length; i++) {
      const t = i / w.length;
      w[i] = Math.round(128
        + 42 * Math.sin(2 * Math.PI * 3 * t)
        + 22 * Math.sin(2 * Math.PI * 7 * t + 1.3)
        + 11 * Math.sin(2 * Math.PI * 13 * t + 2.1));
    }
    demoVizWaveCache = w;
  }
  return demoVizWaveCache;
}

/** The slice of VizHandle the pump needs (structural, so this module stays
 *  import-free of lib/butterchurn-viz.ts). */
export interface DemoVizHandle {
  reset(): void;
  renderFrame(elapsed?: number): void;
  running(): boolean;
}

/**
 * Step a ?neuro demo surface through the FIXED frame sequence, then stop. The
 * frozen end state is the point: with a pinned preset, injected wave, seeded
 * randomness and a fixed frame count, every capture of the page serialises the
 * identical image. When the sequence completes, `data-demo-settled` on
 * `stampRoot` is the signal a capture recipe's waitSelector blocks on.
 *
 * `alive` is the caller's identity guard - it must return false once the
 * surface was torn down or remounted under the pump, so a stale pump never
 * drives a replaced handle or stamps a dead root.
 */
export function pumpVizDemoFrames(handle: DemoVizHandle, alive: () => boolean, stampRoot: Element | null): void {
  // Frame 0 must be the fresh-mount state: a surface that inherited rendered
  // history would carry a different feedback trail into the fixed sequence,
  // and the capture would differ run to run.
  handle.reset();
  let done = 0;
  const tick = (): void => {
    if (!alive() || !handle.running()) return;
    for (let i = 0; i < DEMO_VIZ_BATCH && done < DEMO_VIZ_FRAMES; i++, done++) handle.renderFrame(1 / 60);
    if (done < DEMO_VIZ_FRAMES) { requestAnimationFrame(tick); return; }
    stampRoot?.setAttribute('data-demo-settled', 'true');
  };
  requestAnimationFrame(tick);
}
