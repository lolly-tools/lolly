// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side MilkDrop enhancer for `[data-lolly-viz]` markers in a tool canvas.
 *
 * A tool is data, not code: it can't import butterchurn, can't hold a WebGL context
 * and can't reach the host bridge from a template script. So it renders a PLACEHOLDER
 * carrying the parameters, and this module - the same post-paint enhancer contract as
 * lottie-mount.ts and video-mount.ts - owns the canvas, the visualizer and the clock.
 *
 * THE CANVAS IS OURS, AND IT IS RE-ADOPTED, NOT REBUILT. Every paint swaps the tool's
 * innerHTML, which orphans anything inside it. Remounting butterchurn per keystroke
 * would mean a new WebGL2 context each time - browsers cap those at ~16 and drop the
 * oldest, so the tool would go black a dozen edits in with nothing logged. Instead the
 * canvas element (and its context, and the loaded preset) outlives the rebuild and is
 * appended into whatever placeholder the newest paint produced.
 *
 * AUDIO IS INJECTED, NOT LISTENED TO. The placeholder carries the decoded clip's
 * time-domain windows (host.audio's opt-in `samples`, base64) - one window per analysis
 * frame. butterchurn takes those per frame, so the image is a function of (preset,
 * palette, frame index) and not of what the speakers happen to be doing. That is what
 * makes the exported video match the audio track instead of matching the render's
 * wall-clock.
 *
 * DETERMINISM, AND WHY THERE IS A WARM-UP. MilkDrop is a feedback simulation: frame N
 * is a function of frame N-1, so there is no such thing as seeking. A single frame
 * rendered cold is a near-empty field - the black-frame failure people report as "the
 * visualizer is broken". So a jump (an export's t=0, or a scrub backwards) resets the
 * visualizer to its just-loaded state and replays WARMUP frames of real audio up to the
 * target before the frame is read; sequential playback after that costs exactly one
 * render per frame. Without the reset an export would inherit whatever the live preview
 * had built up on the feedback buffers, and the same clip would export differently
 * depending on how long it had been on screen first.
 *
 * Marker attributes on the placeholder element:
 *   data-lolly-viz    required - preset id: one of ours, or `stock:<id>` for an artist preset
 *   data-viz-colors   space-separated swatches the palette is derived from
 *   data-viz-hero     optional hero hint (the colour the palette is "about")
 *   data-viz-brand    artist-preset brand influence: off | subtle | strong | full
 *   data-viz-wave     base64 of `count × samples` time-domain bytes (128 = silence)
 *   data-viz-meta     JSON { count, samples, fps, poster }
 *   data-viz-calm     'true' → the calm treatment: the calm preset pool only, no artist
 *                     preset. The TOOL's setting, deliberately not the viewer's motion
 *                     preference - see readConfig().
 *   data-viz-fallback selector, relative to the marker's root, of the 2D canvas to hide
 *                     once this mounts
 */
import { mountViz, type VizHandle } from './butterchurn-viz.ts';
import { releaseHdrCanvas } from './hdr-canvas.ts';
import { buildVizPalette, type VizPalette } from './viz-palette.ts';
import { vizPresetById, VIZ_PRESETS } from './viz-presets.ts';
import { vizSupported } from './viz-support.ts';

/** Frames of real audio replayed before a frame is read after a jump. ~1.6s at 30fps - 
 *  enough for the warp/feedback field to fill, cheap enough to do per export still. */
const WARMUP = 48;
/** Ceiling on a single step() so scrubbing to the end of a long clip can't render the
 *  whole track synchronously and lock the tab. */
const MAX_STEP = 120;

interface VizToolConfig {
  preset: string;
  colors: string;
  hero: string;
  brand: string;
  meta: string;
  calm: boolean;
  fallback: string;
}

interface Entry {
  /** The stable tool content element - the placeholder itself is replaced each paint. */
  container: Element;
  canvas: HTMLCanvasElement & { __lollyFrameRender?: (t: number) => void; __lollyFrameDriven?: boolean };
  handle: VizHandle;
  cfg: VizToolConfig;
  /** Frame index the visualizer has been advanced to, or -1 before the first render. */
  cursor: number;
  /** Advance (or re-warm to) an analysis frame index and render it. */
  step(target: number): void;
  /**
   * Point the running visualizer at a NEW analysis track.
   *
   * Needed because the placeholder is replaced on every paint but this entry is keyed
   * on the stable content element, so an input change re-adopts the existing mount
   * rather than building a fresh one. The frame provider and the step loop close over
   * the track, so without this they would keep feeding butterchurn the samples from
   * whichever clip happened to be chosen when the visualizer was first mounted - 
   * changing the audio (or the in-point) would leave the picture reacting to the old
   * one, silently and forever.
   */
  setTrack(next: WaveTrack): void;
  stop(): void;
}

const registry = new Map<Element, Entry>();

/** Seconds into the analysed bed for a normalised clip time `t`: the export bar's clip
 *  length is the span t runs over, not the length of the whole track. */
export function clipSeconds(t: number, clipSec: number): number {
  return Math.max(0, t) * clipSec;
}

function readConfig(el: HTMLElement): VizToolConfig {
  return {
    preset: el.dataset.lollyViz || '',
    colors: el.dataset.vizColors || '',
    hero: el.dataset.vizHero || '',
    brand: el.dataset.vizBrand || 'strong',
    meta: el.dataset.vizMeta || '',
    // Calm is the TOOL's setting, never the viewer's. It used to also read the viewer's
    // reduced-motion preference, on the reasoning that a tool cannot know it - but this
    // canvas is a render, and `calm` does not merely slow it down: ownPresetId() below
    // refuses to leave the calm pool and applyConfig() skips the artist-preset fetch
    // entirely, so a viewer preference silently chose a DIFFERENT VISUALISER, and the
    // export clock films this same mount. An Audiogram exported with reduced motion on
    // came out as a different picture than the one the author configured, and than the
    // CLI renders from the same URL. Motion inside the render canvas is the user's
    // creative output - which is exactly why parts/base.css exempts the canvas subtree
    // from the reduced-motion rule too. A user who wants a calm visualiser has the
    // tool's own control for it.
    calm: el.dataset.vizCalm === 'true',
    fallback: el.dataset.vizFallback || '',
  };
}

/** Decode the wave payload. Hand-rolled base64 rather than atob+charCodeAt because this
 *  is a quarter of a megabyte of bytes and the string round-trip through atob doubles
 *  the peak allocation for no gain. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decodeWave(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let at = 0;
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean.charAt(i));
    bits += 6;
    if (bits >= 8) { bits -= 8; out[at++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, at);
}

interface WaveTrack {
  count: number;
  samples: number;
  fps: number;
  poster: number;
  bytes: Uint8Array;
}

/**
 * Parse the meta + payload into a track, or null when they disagree.
 *
 * A payload shorter than its own header is a bug in the tool, not something to render
 * around: mounting anyway would feed butterchurn a window that runs off the end of the
 * buffer, and a zero-length subarray reads as silence - a visualizer that sits perfectly
 * still, which is indistinguishable from a broken one.
 */
export function parseTrack(meta: string, wave: string): WaveTrack | null {
  let m: { count?: number; samples?: number; fps?: number; poster?: number };
  try { m = JSON.parse(meta || '{}'); } catch { return null; }
  const count = Math.max(0, m.count ?? 0);
  const samples = Math.max(0, m.samples ?? 0);
  if (!count || !samples) return null;
  const bytes = decodeWave(wave);
  if (bytes.length < count * samples) return null;
  return {
    count,
    samples,
    fps: m.fps && m.fps > 0 ? m.fps : 30,
    poster: Math.min(count - 1, Math.max(0, m.poster ?? 0)),
    bytes,
  };
}

function paletteFor(cfg: VizToolConfig): VizPalette {
  const colors = cfg.colors.split(/\s+/).filter(Boolean);
  return buildVizPalette(colors, cfg.hero || colors[0] || null);
}

/** Our own preset for this config - the one that mounts first even when an artist preset
 *  was asked for, since that one has to be fetched. A calm config never leaves the calm
 *  pool, and never reaches an artist preset at all. */
function ownPresetId(cfg: VizToolConfig): string {
  if (cfg.calm) {
    const calm = VIZ_PRESETS.filter((d) => d.calm);
    const wanted = calm.find((d) => d.id === cfg.preset);
    return (wanted ?? calm[0] ?? VIZ_PRESETS[0]!).id;
  }
  return vizPresetById(cfg.preset.startsWith('stock:') ? null : cfg.preset).id;
}

function destroyEntry(e: Entry): void {
  e.stop();
  try { e.handle.destroy(); } catch { /* already down */ }
  // handle.destroy() already releases any HDR context this mount allocated; this is the
  // belt-and-suspenders for destroyToolViz (WP-4). A no-op today - the tool viz mounts with
  // `capture: true`, so it never takes the HDR path - but harmless if that ever changes.
  releaseHdrCanvas(e.canvas);
  e.canvas.remove();
  delete e.canvas.__lollyFrameRender;
}

/** Drop entries whose tool canvas has left the document - a tool navigation, or a view
 *  teardown that didn't route through destroyToolViz. */
function reap(): void {
  for (const [key, e] of registry) {
    if (!key.isConnected) { destroyEntry(e); registry.delete(key); }
  }
}

export interface MountToolVizOpts {
  /** Stale-render guard: a slower mount must not adopt into a canvas a newer paint
   *  has already replaced. */
  isCurrent?: () => boolean;
}

/**
 * Run one enhancement pass over `container` (the tool's content element).
 *
 * Resolves once the requested preset is actually loaded, so views/tool.ts can await it
 * before an export - otherwise a deep-linked export of an artist preset would capture
 * whichever brand-native preset happened to be up while the fetch was in flight.
 */
export async function mountToolViz(container: Element, opts: MountToolVizOpts = {}): Promise<void> {
  reap();
  const marker = container.querySelector<HTMLElement>('[data-lolly-viz]');
  const existing = registry.get(container);
  if (!marker) {
    // The style was switched away from the visualizer: give the context back rather
    // than leaving it parked on a hidden canvas.
    if (existing) { destroyEntry(existing); registry.delete(container); }
    return;
  }
  const cfg = readConfig(marker);
  const track = parseTrack(cfg.meta, marker.dataset.vizWave || '');
  // No WebGL2, or nothing to drive it with: leave the tool's own 2D fallback visible
  // and running. This is progressive enhancement, not a capability gate - the tool
  // renders (and exports) either way.
  if (!track || !vizSupported()) {
    if (existing) { destroyEntry(existing); registry.delete(container); }
    return;
  }

  if (existing && existing.handle.running()) {
    adopt(existing, marker);
    // Before applyConfig: the running mount's closures still hold the track from
    // whenever it was first built, so a changed clip (or in-point) has to be handed
    // over explicitly or the picture keeps reacting to the previous audio.
    existing.setTrack(track);
    await applyConfig(existing, cfg, track);
    hideFallback(container, cfg);
    return;
  }
  if (existing) { destroyEntry(existing); registry.delete(container); }

  const canvas = document.createElement('canvas') as Entry['canvas'];
  canvas.className = 'lolly-viz-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  marker.appendChild(canvas);

  let cur = 0;
  // The closures below (the frame provider, step, the preview loop) outlive this
  // invocation and are reused when a later paint re-adopts this mount, so they read a
  // mutable cell rather than capturing the track parsed on this pass. `setTrack` swaps it.
  let live = track;
  const palette = paletteFor(cfg);
  // onError matters: without it a per-frame throw or a failed reset() stands the
  // renderer down SILENTLY and the canvas freezes on its last frame forever.
  const handle = await mountViz(canvas, undefined, ownPresetId(cfg), (err) => console.warn('[lolly:viz] tool mount:', err), palette, {
    driven: true,
    capture: true,
    deterministic: true,
    audio: {
      frame: () => ({
        wave: live.bytes.subarray(cur * live.samples, (cur + 1) * live.samples),
        seed: cur,
      }),
    },
  });
  if (!handle || (opts.isCurrent && !opts.isCurrent())) {
    handle?.destroy();
    canvas.remove();
    return;
  }

  const entry: Entry = {
    container, canvas, handle, cfg, cursor: -1,
    step: () => {},
    // New samples mean the feedback field was warmed from the PREVIOUS clip, so force a
    // re-warm as well as swapping the data - otherwise the first frames of the new clip
    // render against the old one's trails.
    setTrack: (next) => { live = next; entry.cursor = -1; },
    stop: () => {},
  };

  // Re-read the box before rendering: the tool canvas is CSS-scaled to fit the view and
  // the export path removes that scale, so the same element is (say) 520px on screen and
  // 1080px during a capture. Without this the exported frame would be an upscale of the
  // preview's backing store.
  let lastW = 0;
  let lastH = 0;
  const sync = (): void => {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w && h && (w !== lastW || h !== lastH)) {
      lastW = w; lastH = h;
      handle.resize();
      // A resize reallocates the feedback targets, so whatever was on them is gone - 
      // the next frame has to warm up again or it renders against an empty field.
      entry.cursor = -1;
    }
  };

  const step = (target: number, restart = false): void => {
    sync();
    const t = Math.min(live.count - 1, Math.max(0, target));
    const jumped = restart || entry.cursor < 0 || t < entry.cursor || t - entry.cursor > MAX_STEP;
    // Start a warm-up from a cleared field, not from whatever the preview left on the
    // buffers - otherwise the same clip exports differently depending on how long it
    // had been playing on screen first.
    if (jumped) handle.reset();
    const from = jumped ? Math.max(0, t - WARMUP) : entry.cursor + 1;
    for (let i = from; i <= t; i++) {
      cur = i;
      // A CONSTANT elapsed: butterchurn advances the preset clock by 1/fps and damps its
      // fps estimate toward what it is told, so feeding real deltas would make the same
      // frame index render differently depending on how busy the machine was.
      handle.renderFrame(1 / live.fps);
    }
    entry.cursor = t;
  };
  entry.step = step;

  // The shared frame-clock convention (bridge/export.ts): t is normalised over the
  // CLIP the export bar asked for, and a video export also passes that clip's length
  // in seconds. The analysis spans the whole bed from the in-point, so the mapping
  // goes through seconds: a 2 s export shows the first 2 s of the track at the speed
  // the preview plays it. (It used to spread t across the whole analysis, so a short
  // export of a long track raced through the entire song - Andy, 2026-09-03.) Without
  // a clip length - a still - t === 0 is the poster frame: a still of an audiogram
  // should show the loudest moment, not the silence clips routinely open on.
  // Every export begins at t === 0, so that is where the sequence is pinned: reset,
  // warm up from a cleared field, and render. Two exports of the same clip then agree
  // frame for frame instead of each inheriting however long the preview had been up.
  let clockSecs = -1;
  canvas.__lollyFrameRender = (t: number, clipSec?: number): void => {
    if (!(clipSec && clipSec > 0)) { clockSecs = -1; step(t === 0 ? live.poster : Math.floor(t * live.count), t === 0); return; }
    const secs = clipSeconds(t, clipSec);
    const idx = Math.min(live.count - 1, Math.max(0, Math.floor(secs * live.fps)));
    // One MilkDrop frame per ANALYSIS frame, exactly as the preview loop steps it: a
    // preset's per-frame equations (the bouncing balls' velocities) advance once per
    // render, so rendering once per exported frame at 60 fps would run the motion at
    // twice the speed the preview shows. A 60 fps file therefore repeats each frame
    // for the fraction of the analysis interval it covers, and moves at preview speed.
    step(idx, t === 0 || clockSecs < 0 || secs < clockSecs);
    clockSecs = secs;
  };

  // Live preview. Stands down while the export clock is driving, and holds the poster
  // under reduced motion rather than looping - auto-motion is exactly what that
  // preference is asking us not to do.
  if (!cfg.calm) {
    let raf = 0;
    let t0 = 0;
    const period = (live.count / live.fps) * 1000;
    const loop = (now: number): void => {
      if (!canvas.isConnected) { raf = 0; return; }
      if (!canvas.__lollyFrameDriven && handle.running()) {
        if (!t0) t0 = now;
        step(Math.floor((((now - t0) % period) / period) * live.count));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    entry.stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  }

  registry.set(container, entry);
  await applyConfig(entry, cfg, track);
  hideFallback(container, cfg);
}

/** Re-append our canvas into the newest paint's placeholder. Parent-identity check only:
 *  this runs on every paint and the common case is that nothing moved. */
function adopt(e: Entry, marker: HTMLElement): void {
  // Deliberately does NOT touch e.cfg - applyConfig compares against the config the
  // visualizer was actually built with, and overwriting it here would make every
  // change look like no change.
  if (e.canvas.parentElement !== marker) marker.appendChild(e.canvas);
}

/** Hide the tool's own 2D fallback once we're actually drawing - it stays in the DOM so
 *  a later failure (or a style change) can fall back to it, and so the export path has
 *  something to capture if we never mounted. */
function hideFallback(container: Element, cfg: VizToolConfig): void {
  if (!cfg.fallback) return;
  const el = container.querySelector<HTMLElement>(cfg.fallback);
  if (el) el.style.display = 'none';
}

/** Apply preset + palette for a (possibly changed) config. Artist presets are fetched,
 *  which is why this is the async half. */
async function applyConfig(e: Entry, cfg: VizToolConfig, track: WaveTrack): Promise<void> {
  const changed = e.cfg.preset !== cfg.preset || e.cfg.colors !== cfg.colors
    || e.cfg.hero !== cfg.hero || e.cfg.brand !== cfg.brand;
  // A fresh mount has already loaded its own preset against its own palette, so only an
  // artist preset (which has to be fetched) still has work to do on the first pass.
  const first = e.cursor < 0;
  const stock = cfg.preset.startsWith('stock:') && !cfg.calm;
  e.cfg = cfg;
  if (!changed && !(first && stock)) return;
  const palette = paletteFor(cfg);
  if (stock) {
    const { loadStockPreset, BRAND_TINTS } = await import('./viz-stock.ts');
    const tint = (BRAND_TINTS as readonly string[]).includes(cfg.brand)
      ? (cfg.brand as Parameters<typeof loadStockPreset>[2])
      : 'strong';
    // Rebuilt against the palette rather than recoloured through setPalette: an artist
    // preset's colour lives in its composite SHADER, which is compiled at load - and
    // setPalette reloads by ID, which for a `stock:` id finds nothing in our registry
    // and would silently drop the user onto the default preset.
    const preset = await loadStockPreset(cfg.preset.slice(6), palette, tint);
    // Null means the pack isn't staged in this build. Staying on the brand-native
    // preset is the honest outcome - a black canvas is not.
    if (preset) e.handle.setRawPreset(cfg.preset, preset);
  } else {
    e.handle.setPalette(palette);
    e.handle.setPreset(ownPresetId(cfg));
  }
  // The preset changed under the feedback field, so the next frame re-warms rather than
  // cross-fading out of whatever the old one had left on the buffers.
  e.cursor = -1;
  // Reduced motion has no loop to draw the first frame, so paint the poster here.
  if (cfg.calm) e.step(track.poster);
}

/** Tear every mounted visualizer down - views/tool.ts calls this on navigation, where the
 *  container is about to be discarded and the GL context must go with it. */
export function destroyToolViz(): void {
  for (const [key, e] of registry) { destroyEntry(e); registry.delete(key); }
}
