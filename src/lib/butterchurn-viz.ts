// SPDX-License-Identifier: MPL-2.0
/**
 * The MilkDrop visualizer's engine wrapper - everything WebGL and audio, nothing UI.
 * components/viz-overlay.ts owns the surface it draws into; this module owns the
 * butterchurn instance, the render loop, and the audio tap.
 *
 * Deliberately kept out of the initial bundle: `butterchurn` is ~40 KB gzipped and
 * only ever needed when someone actually opens the visualizer, so it arrives via a
 * dynamic import on first `mountViz()` and is cached by the module system after.
 *
 * AUDIO. It taps the EXISTING focus-loop graph rather than building its own:
 * `getNeurospicyAnalyser()` hands back the pass-through analyser that already sits
 * between the player's gain and the speakers (lib/neurospicy.ts), and its
 * `.context` is the AudioContext butterchurn needs. `connectAudio` adds a parallel
 * branch into butterchurn's internal delay tap - it never reaches the destination,
 * so nothing is heard twice - and `disconnectAudio` unhooks only that branch,
 * leaving analyser→destination intact. That means:
 *   - no second AudioContext, no autoplay-gesture juggling of our own;
 *   - the visualizer is dead until audio has actually started once (the analyser
 *     doesn't exist before then), hence `vizAudioReady()` and the retry the overlay
 *     does on 'lolly:neuro-playing';
 *   - internet radio DOES drive it: the stream's <audio> element is tapped into the
 *     same graph via createMediaElementSource (SomaFM sends the CORS header that
 *     needs), so a station looks exactly like a local track here. A station whose
 *     server refuses the tap falls back to untapped playback and reports
 *     'unanalysable' - `vizHasSignal()` is false then, and the overlay says why
 *     instead of looking broken.
 *
 * INJECTED AUDIO - the second mode. butterchurn's renderer takes per-frame
 * time-domain bytes when you hand it any (`render({ audioLevels })`), and only falls
 * back to reading its own AnalyserNode when you don't. That is what lets a tool drive
 * the same visualizer from a DECODED FILE (host.audio) rather than from live playback:
 * pass `opts.audio.frame` and there is no analyser, no AudioContext and no focus-loop
 * graph in the picture at all. Paired with `opts.driven` (no rAF loop of our own, one
 * frame per `renderFrame()` call) that makes the visualizer reproducible frame by
 * frame, which is what an offline video export needs.
 *
 * WebGL2 is a hard requirement of butterchurn 2.x, so every entry point here is
 * gated on `vizSupported()` from the dependency-free lib/viz-support.ts (which the
 * dock also reads, synchronously, to decide whether to show its button at all).
 */
import { getNeurospicyAnalyser, neurospicySignalState } from './neurospicy.ts';
import { boostHdrCanvas, hdrCanvasSupported, releaseHdrCanvas } from './hdr-canvas.ts';
import { displaySupportsHdr } from './display-gamut.ts';
import { vizPossible } from './viz-support.ts';
import { vizPalette, vizPaletteDiagnostics, type VizPalette, type VizPaletteHost } from './viz-palette.ts';
import { vizPresetById, type VizPreset } from './viz-presets.ts';

/** Cap the backing store so a 4K display doesn't ask for a 4× mesh render. The
 *  visualizer is a soft, blurred image - the extra pixels buy nothing and cost fps. */
const MAX_PIXEL_RATIO = 1.5;
/** Mesh resolution. butterchurn defaults to 48×36; 40×30 is visually equivalent for
 *  our presets and noticeably cheaper on integrated GPUs. */
const MESH = { width: 40, height: 30 };
/** Seconds to cross-fade when switching presets. */
const BLEND_SECONDS = 2.2;
/** The shortest blend we ever ask for. Must be > 0 - see the `load()` call site: a
 *  zero blend duration divides by zero and wedges the renderer on NaN. */
const MIN_BLEND_SECONDS = 0.05;
/**
 * The length butterchurn's AudioProcessor allocates for its time-domain arrays
 * (`numSamps = 512`, `fftSize = numSamps * 2`). Injected windows are copied into
 * buffers of exactly this length before `updateAudio` sees them, because it does a
 * bare `.set()`: a LONGER source throws RangeError inside render (the loop catches it
 * once and stands the whole visualizer down), and a SHORTER one silently leaves the
 * previous frame's tail in place, which reads as a stuck low-frequency ghost.
 */
const FFT_SIZE = 1024;

type Butterchurn = { createVisualizer: typeof import('butterchurn').createVisualizer };

/** One frame of time-domain audio in the webaudio byte form (0..255, 128 = silence).
 *  `waveL`/`waveR` may be omitted for a mono source - both then read `wave`. */
export interface VizAudioFrame {
  wave: Uint8Array;
  waveL?: Uint8Array;
  waveR?: Uint8Array;
  /** Seed for this frame under `deterministic` - pass the frame INDEX, so replaying a
   *  stretch of the clip replays the same randomness. */
  seed?: number;
}

/** mulberry32 - 4 lines, uniform enough for jitter, and identical everywhere. */
function seededRandom(seed: number): () => number {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run `fn` with Math.random replaced by a seeded stream. Synchronous by contract:
 *  an async body would leave the global swapped for other code to observe. */
function withSeed<T>(seed: number | null, fn: () => T): T {
  if (seed === null) return fn();
  const real = Math.random;
  Math.random = seededRandom(seed);
  try { return fn(); } finally { Math.random = real; }
}

export interface VizMountOpts {
  /**
   * Where the samples come from. Omitted (or with neither field) means the app's
   * default: tap the focus-loop analyser. `frame` supplies them per rendered frame
   * instead - return null to draw the frame against silence rather than to fail.
   */
  audio?: {
    analyser?: AnalyserNode | null;
    frame?: () => VizAudioFrame | null;
  };
  /**
   * Don't start a rAF loop; the caller renders one frame at a time via
   * `handle.renderFrame()`. The only way to get a reproducible sequence out of this
   * thing - a self-driven loop renders as many frames as the display happened to give
   * it, so the same clip exports differently every run.
   */
  driven?: boolean;
  /**
   * Replace Math.random with a seeded stream for the duration of each preset load and
   * each driven frame.
   *
   * butterchurn is genuinely random in its hot path - the `rand()` equation helper,
   * the mesh jitter, the wave randomisation, and `rand_preset`/`rand_start` at load - 
   * all straight `Math.random()`. So the same clip rendered twice does not produce the
   * same video, which for an EXPORT is a defect rather than a flourish: re-exporting
   * after a title tweak silently gives you a different visual. Seeding is contained to
   * the synchronous render call and restored in a finally, so nothing else in the page
   * can observe it.
   */
  deterministic?: boolean;
  /**
   * Acquire the WebGL2 context with `preserveDrawingBuffer` before butterchurn does.
   * Its own `getContext` omits the flag, and a second `getContext` on the same canvas
   * returns the first context and IGNORES the new attributes - so this has to happen
   * here, before the Visualizer is constructed. Without it `canvas.toDataURL()` (which
   * is how dom-to-image snapshots a canvas) reads a buffer the compositor already
   * cleared, and every exported frame is blank.
   */
  capture?: boolean;
  /**
   * Override the device-pixel-ratio cap for the backing store (default
   * `MAX_PIXEL_RATIO` = 1.5). The in-dock visualiser passes 2 so an enlarged /
   * fullscreen window resamples crisply rather than upscaling a small buffer; the
   * export/preview callers keep the cheaper default.
   */
  pixelRatioCap?: number;
}

/** The renderer's real signature. vendor.d.ts declares the no-argument `render()` the
 *  live path uses; the options form is butterchurn's own (renderer.render destructures
 *  `{ audioLevels, elapsedTime }`) and is what the injected path needs. */
type InjectableViz = {
  render(opts?: {
    audioLevels?: { timeByteArray: Uint8Array; timeByteArrayL: Uint8Array; timeByteArrayR: Uint8Array };
    elapsedTime?: number;
  }): void;
};

/**
 * Dig `createVisualizer` out of however the bundler chose to present the package.
 *
 * butterchurn ships a webpack UMD bundle whose `module.exports` is itself
 * `{ default: { createVisualizer } }` - webpack's own harmony-export wrapper. Layer
 * an ES-module interop on top of that and the nesting depends on the toolchain:
 * Node's `require` gives one `default` to unwrap, while Vite's esbuild pre-bundle
 * adds its own, so `m.default.default` is where the real object lives. Getting it
 * wrong throws `mod.createVisualizer is not a function` in one environment and
 * works fine in the other - dev vs. build, which is the worst way to find out.
 *
 * So don't guess a depth: walk `default` until something has `createVisualizer`.
 */
export function resolveButterchurn(mod: unknown): Butterchurn {
  let cur = mod;
  for (let depth = 0; depth < 4; depth++) {
    if (cur && typeof (cur as Butterchurn).createVisualizer === 'function') return cur as Butterchurn;
    const next = (cur as { default?: unknown } | null)?.default;
    if (!next || next === cur) break;
    cur = next;
  }
  throw new Error('butterchurn loaded but exposes no createVisualizer - unexpected module shape');
}

let loggedPalette = false;
let modPromise: Promise<Butterchurn> | null = null;
function loadButterchurn(): Promise<Butterchurn> {
  modPromise ??= import('butterchurn').then(resolveButterchurn);
  return modPromise;
}

/** Has the focus-loop audio graph been built yet? Until it has, there's nothing to
 *  create a visualizer against (butterchurn needs the AudioContext). */
export function vizAudioReady(): boolean {
  return getNeurospicyAnalyser() !== null;
}

/**
 * Will the visualizer actually see samples right now? False while paused/idle, while a
 * stream is still connecting, and for a station whose server wouldn't allow the analyser
 * tap. `neurospicySignalState()` is the single source of truth the level meter shares, so
 * the two views never disagree about whether there's a signal.
 */
export function vizHasSignal(): boolean {
  return neurospicySignalState() === 'live';
}

export interface VizHandle {
  /** Switch preset, cross-fading. Unknown ids fall back to the default. */
  setPreset(id: string): void;
  /** Re-colour: rebuild the CURRENT preset against a new palette and cross-fade to it.
   *  A scheme change is a palette change - the presets themselves are unaffected. */
  setPalette(palette: VizPalette): void;
  /** Load a preset object built elsewhere - the brand-wrapped artist presets, which are
   *  fetched and assembled by lib/viz-stock.ts rather than coming from our registry. */
  setRawPreset(id: string, preset: VizPreset): void;
  /** The palette currently in force, so a caller rebuilding a preset can match it. */
  palette(): VizPalette;
  /** Is the render loop still going? False once the canvas was hidden or detached
   *  (the loop stands itself down) or after a frame threw - an INLINE surface that
   *  gets collapsed and reopened needs to know it must re-mount. */
  running(): boolean;
  /** The preset currently loaded. */
  presetId(): string;
  /** Re-read the canvas's box and resize the renderer to match. */
  resize(): void;
  /**
   * Put the visualizer back to the state it had the moment the current preset loaded:
   * the preset re-loaded from scratch (its equations carry INTEGRATED state - rotation,
   * zoom, q variables - that no amount of replaying audio unwinds) and the feedback
   * buffers cleared.
   *
   * MilkDrop is a feedback simulation: the previous frame is an input to this one, and
   * for a preset with a slow echo decay it is still faintly visible a hundred frames
   * later, and the frame equations integrate. Without this an export inherits whatever
   * the live preview happened to have on screen, and two exports of the SAME clip
   * differ - the visual equivalent of an uninitialised buffer. Recompiles the preset's
   * shaders, so it belongs before a warm-up, not in a per-frame path.
   */
  reset(): void;
  /**
   * Draw exactly one frame - the `driven: true` counterpart of the internal loop.
   * `elapsed` is the seconds this frame stands for; feed a CONSTANT (1/fps) for an
   * offline render, because butterchurn only uses it to estimate fps and advances the
   * preset clock by `1/fps`, so a jittery value makes the preset's own time wander.
   */
  renderFrame(elapsed?: number): void;
  /** Stop rendering, unhook the audio branch, and drop the GL context's canvas use. */
  destroy(): void;
}

/**
 * Whether a mount should light up the WP-4 live on-screen HDR path (plan 154): an
 * HDR-capable display (Chromium `configureHighDynamicRange` + a float drawing buffer) AND
 * a LIVE surface - never a `capture` one. Every export/cover/thumbnail/`?neuro` demo mount
 * passes `capture: true` and feeds a byte-exact snapshot pipeline, so those stay on the
 * plain butterchurn canvas, unchanged, and no export path is ever touched. `supported` is
 * injectable for tests; production requires BOTH an HDR-capable canvas AND an HDR
 * display - hdrCanvasSupported() is capability-only (the Canvas-HDR API exists), so
 * without displaySupportsHdr() (the real `(dynamic-range: high)` probe) a Chromium on
 * an SDR monitor would run the whole boost pipeline for nothing. This matches the
 * sibling WP-5 Tier-A gate (oklch-slice.ts ANDs displaySupportsHdr() too).
 */
export function vizWantsHdr(capture: boolean, supported: boolean = hdrCanvasSupported() && displaySupportsHdr()): boolean {
  return !capture && supported;
}

/**
 * Attach a visualizer to `canvas` and start rendering. Resolves null when the
 * browser can't do WebGL2 or the audio graph doesn't exist yet - callers should
 * check `vizSupported()`/`vizAudioReady()` first and retry the latter on
 * 'lolly:neuro-playing'.
 *
 * `host` supplies the brand tokens the palette is seeded from; a host without
 * tokens gets the fallback palette rather than no colour.
 *
 * `onError` is called if a frame throws after a successful mount - butterchurn
 * failures are otherwise completely silent (a dead rAF chain over a black canvas),
 * which is exactly the failure mode that makes this thing hard to debug.
 */
export async function mountViz(
  canvas: HTMLCanvasElement,
  host: VizPaletteHost | undefined,
  presetId: string,
  onError?: (err: unknown) => void,
  initialPalette?: VizPalette | null,
  opts?: VizMountOpts,
): Promise<VizHandle | null> {
  const inject = opts?.audio?.frame ?? null;
  // Only the live path needs the focus-loop graph. An injected caller must NOT be
  // gated on it: a tool canvas visualising a decoded file has nothing to do with
  // whether the app happens to be playing music.
  const analyser = inject ? (opts?.audio?.analyser ?? null) : (opts?.audio?.analyser ?? getNeurospicyAnalyser());
  // The LAX probe here: mountViz is only ever called deliberately, and the strict
  // performance-caveat test turns a machine on integrated graphics into "the button does
  // nothing" rather than "a slower visualiser". The dock still gates its ambient BUTTON
  // on the strict vizSupported().
  if ((!analyser && !inject) || !vizPossible()) return null;

  // WP-4 live HDR. When on: butterchurn renders to an OFFSCREEN canvas and a boost pass
  // presents it onto `canvas` (the DOM element) as an extended-range HDR image. Off (SDR
  // display, WebKit, and every `capture` mount): `renderCanvas === canvas`, butterchurn
  // renders straight to it exactly as before and nothing below diverges - byte-identical.
  const useHdr = vizWantsHdr(!!opts?.capture);
  const renderCanvas = useHdr ? document.createElement('canvas') : canvas;

  const mod = await loadButterchurn();
  // A caller that already has a palette (a chosen SCHEME, or a tool's own colours)
  // passes it, and then we never touch `vizPalette` - which reads the APP's computed
  // root custom properties for its accent hint, the wrong document entirely for a
  // tool canvas, and costs a token read for an answer that is already in hand.
  let palette = initialPalette ?? await vizPalette(host);
  // One line per mount saying where the brand colour came from. A mis-resolved accent
  // shows up as "the whole visualizer is the wrong colour" with nothing to explain it,
  // which is exactly the kind of bug that costs a round trip to diagnose.
  if (!loggedPalette) {
    loggedPalette = true;
    console.info('[lolly:viz]', vizPaletteDiagnostics(palette));
  }

  /**
   * DPR handling, and the trap in it.
   *
   * butterchurn never touches `canvas.width`/`canvas.height`. `renderToScreen` does
   * `bindFrambufferAndSetViewport(null, this.width, this.height)` - so the SCREEN
   * viewport is exactly the width/height we hand it, and the canvas's drawing buffer
   * must match those numbers or the frame lands in the wrong part of the buffer:
   *   - buffer left at its 300×150 default → the viewport overshoots it entirely;
   *   - buffer set to `size × pixelRatio` while width/height stay CSS px → the frame
   *     renders into the lower-left corner and CSS scales that corner up.
   * Both look like a broken visualizer and neither warns.
   *
   * So we work in DEVICE pixels throughout: width/height AND the drawing buffer are
   * the device-pixel size, with `pixelRatio: 1` (its only job is scaling texsize off
   * width/height, which we've already done). CSS keeps the element at its box size,
   * so the extra pixels become sharpness.
   */
  const dpr = Math.min(window.devicePixelRatio || 1, opts?.pixelRatioCap ?? MAX_PIXEL_RATIO);
  const box = (): { w: number; h: number } => {
    const r = canvas.getBoundingClientRect();
    // A detached or zero-size canvas would make butterchurn allocate a 0×0 texture
    // and throw; floor at 1 and let the next resize() correct it.
    return {
      w: Math.max(1, Math.round(r.width * dpr)),
      h: Math.max(1, Math.round(r.height * dpr)),
    };
  };
  const first = box();

  // Sizes butterchurn's OWN surface (renderCanvas), which is `canvas` itself unless the
  // HDR path split it off. `box()` above still measures `canvas` - the DOM element whose
  // CSS box drives the device-pixel target - in both modes.
  const applySize = (w: number, h: number): void => {
    if (renderCanvas.width !== w) renderCanvas.width = w;
    if (renderCanvas.height !== h) renderCanvas.height = h;
  };
  applySize(first.w, first.h);

  // Must precede createVisualizer - see VizMountOpts.capture for why a later
  // getContext can't add the flag. The HDR path pre-acquires with the same flag so the
  // offscreen buffer is readable when the boost pass uploads it as a texture.
  if (opts?.capture || useHdr) renderCanvas.getContext('webgl2', { preserveDrawingBuffer: true });

  // A null context is legal: butterchurn's AudioProcessor only builds its analyser
  // graph `if (context)` and allocates its sample arrays either way, which is exactly
  // the analyser-free instance the injected path wants. vendor.d.ts types the app's
  // live path, where there is always one.
  // Constructed under the seed too: the Visualizer fills its noise TEXTURES with
  // bare Math.random() at construction (butterchurn.js noiseWrap/noise init), and
  // preset shaders sample them every frame - unseeded, two deterministic runs still
  // paint different fields. loadPreset/render seeding alone cannot cover this.
  const viz = withSeed(opts?.deterministic ? 0x10dd : null, () => mod.createVisualizer(analyser?.context as BaseAudioContext, renderCanvas, {
    width: first.w,
    height: first.h,
    pixelRatio: 1,
    meshWidth: MESH.width,
    meshHeight: MESH.height,
  }));
  if (analyser) viz.connectAudio(analyser);

  // Reused across frames and pre-filled with silence, so a provider that returns a
  // short window (or nothing at all) can't leave the previous frame's tail behind - 
  // see FFT_SIZE. Allocated only on the injected path.
  const silent = (): Uint8Array => new Uint8Array(FFT_SIZE).fill(128);
  const buf = inject ? { c: silent(), l: silent(), r: silent() } : null;
  const copy = (dst: Uint8Array, src: Uint8Array | undefined): void => {
    if (!src || !src.length) { dst.fill(128); return; }
    if (src.length >= FFT_SIZE) dst.set(src.subarray(0, FFT_SIZE));
    else { dst.fill(128); dst.set(src); }
  };
  const drawOne = (elapsed: number): void => {
    if (!buf || !inject) { (viz as unknown as InjectableViz).render(); return; }
    const f = inject();
    copy(buf.c, f?.wave);
    copy(buf.l, f?.waveL ?? f?.wave);
    copy(buf.r, f?.waveR ?? f?.wave);
    withSeed(opts?.deterministic ? (f?.seed ?? 0) : null, () => {
      (viz as unknown as InjectableViz).render({
        audioLevels: { timeByteArray: buf.c, timeByteArrayL: buf.l, timeByteArrayR: buf.r },
        elapsedTime: elapsed,
      });
    });
  };

  // A fixed seed for preset LOADS, so `rand_preset`/`rand_start` - which a preset bakes
  // into its whole look - are the same on every mount rather than per-session luck.
  const loadSeed = opts?.deterministic ? 0x10dd : null;
  let currentId = presetId;
  // The last preset object handed to setRawPreset (an artist preset), so reset() can
  // reinstate it - those don't come from our registry and can't be rebuilt from an id.
  let lastRaw: VizPreset | null = null;
  const load = (id: string, blend: number): void => {
    const def = vizPresetById(id);
    withSeed(loadSeed, () => viz.loadPreset(def.build(palette), blend));
    lastRaw = null;
    currentId = def.id;
  };
  // NEVER pass 0 as the blend time. `loadPreset` unconditionally sets `blending = true`,
  // and the next frame computes `blendProgress = (time - blendStartTime) / blendDuration`.
  // With a 0 duration that's 0/0 = NaN on any frame where the clock hasn't advanced - 
  // and `NaN > 1.0` is false, so `blending` never clears. Every value then goes through
  // `mixFrameEquations(NaN, …)` and comes out NaN, so the renderer draws nothing at
  // all: a black canvas, for the whole session, with no error anywhere.
  load(presetId, MIN_BLEND_SECONDS);

  // Render loop. Driven by the rAF clock of the window the CANVAS lives in, not
  // ours - for a popped-out visualizer those differ, and an opener that's minimized
  // or in a background tab throttles its rAF to a standstill, which would freeze a
  // popout that is itself perfectly visible.
  const clock: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'> =
    canvas.ownerDocument.defaultView ?? window;
  // Bails when the canvas leaves the DOM or is hidden, so a closed overlay can't
  // keep a GL context spinning; the overlay restarts it on open by mounting afresh.
  // Sized lazily: the loop notices box changes instead of needing a ResizeObserver.
  let raf = 0;
  let alive = true;
  let lastW = first.w;
  let lastH = first.h;
  const frame = (): void => {
    if (!alive) return;
    if (!canvas.isConnected || canvas.offsetParent === null) { raf = 0; alive = false; return; }
    const { w, h } = box();
    if (w !== lastW || h !== lastH) {
      lastW = w; lastH = h;
      applySize(w, h);
      viz.setRendererSize(w, h, { pixelRatio: 1 });
    }
    // A throw anywhere inside butterchurn's frame - a preset shape the renderer
    // doesn't accept, a lost GL context - otherwise just stops the rAF chain and
    // leaves a black canvas with nothing logged near the cause. Report it once and
    // stand down, so the surface can say what happened instead of looking dead.
    try {
      drawOne(1 / 60);
      // WP-4: present butterchurn's offscreen SDR frame onto the DOM canvas as HDR. A
      // no-op branch on every SDR/WebKit/capture mount (useHdr false), so those pay nothing.
      if (useHdr) boostHdrCanvas(canvas, renderCanvas, renderCanvas.width, renderCanvas.height, 'srgb');
    } catch (err) {
      alive = false;
      raf = 0;
      onError?.(err);
      return;
    }
    raf = clock.requestAnimationFrame(frame);
  };
  // `driven` callers step the clock themselves; starting a loop as well would race
  // their frames and make the sequence depend on how many rAFs happened to land
  // between two renderFrame() calls.
  if (!opts?.driven) raf = clock.requestAnimationFrame(frame);

  return {
    setPreset(id: string): void {
      // Keep a bad preset from taking the whole visualizer down with it: report and
      // stay on the one that's already rendering.
      try {
        load(id, BLEND_SECONDS);
      } catch (err) {
        onError?.(err);
      }
    },
    setRawPreset(id: string, preset: VizPreset): void {
      try {
        withSeed(loadSeed, () => viz.loadPreset(preset, BLEND_SECONDS));
        lastRaw = preset;
        currentId = id;
      } catch (err) {
        onError?.(err);
      }
    },
    palette: () => palette,
    setPalette(next: VizPalette): void {
      // The shaders bake the palette in as GLSL constants, so a colour change means
      // rebuilding and reloading the preset - butterchurn cross-fades it like any other
      // preset change, which is exactly the transition a scheme change wants.
      try {
        palette = next;
        load(currentId, BLEND_SECONDS);
      } catch (err) {
        onError?.(err);
      }
    },
    presetId: () => currentId,
    running: () => alive,
    reset(): void {
      // Reaches butterchurn's own framebuffers, which are plain fields on the renderer
      // and not part of its API. Guarded rather than asserted: a version that renames
      // them should cost reproducibility, not the visualizer.
      try {
        const gl = renderCanvas.getContext('webgl2');
        const r = (viz as unknown as { renderer?: Record<string, unknown> }).renderer;
        if (!gl || !r) return;
        // The renderer's clock. `time` is a running accumulator (`time += 1/fps`) that
        // nothing else resets, and presets read it in both their equations and their
        // shaders - so a preview that has been up for two minutes renders a different
        // image at the same frame index than a freshly mounted one. fps starts at 30 and
        // is damped toward the history, so the history has to go back with it.
        r.time = 0;
        r.frameNum = 0;
        r.fps = 30;
        r.timeHist = [0];
        for (const key of ['targetFrameBuffer', 'prevFrameBuffer', 'compFrameBuffer']) {
          const fb = r[key] as WebGLFramebuffer | undefined;
          if (!fb) continue;
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // Re-load AFTER the clear: loadPreset resets the equation state, and a preset
        // arriving on a cleared field is exactly the state a fresh mount would be in.
        if (lastRaw) withSeed(loadSeed, () => viz.loadPreset(lastRaw!, MIN_BLEND_SECONDS));
        else load(currentId, MIN_BLEND_SECONDS);
        // loadPreset always starts a cross-fade, and the frames it mixes in come from the
        // OUTGOING preset's equation state - the very state this is trying to forget. Ending
        // it here is the one safe way to skip it: a 0-second blend duration divides by zero
        // and wedges the renderer on NaN (see MIN_BLEND_SECONDS).
        r.blending = false;
      } catch (err) {
        onError?.(err);
      }
    },
    renderFrame(elapsed = 1 / 30): void {
      if (!alive) return;
      try {
        drawOne(elapsed);
        // Driven callers are all `capture` today (useHdr false → no-op); guarded anyway so
        // a future non-capture driven surface still presents HDR through the same path.
        if (useHdr) boostHdrCanvas(canvas, renderCanvas, renderCanvas.width, renderCanvas.height, 'srgb');
      } catch (err) {
        // Same one-strike rule as the loop: a preset the renderer won't accept throws
        // every frame, and a caller stepping an export would otherwise take the throw
        // once per exported frame with a black image for each.
        alive = false;
        onError?.(err);
      }
    },
    resize(): void {
      const { w, h } = box();
      lastW = w; lastH = h;
      applySize(w, h);
      viz.setRendererSize(w, h, { pixelRatio: 1 });
    },
    destroy(): void {
      alive = false;
      if (raf) clock.cancelAnimationFrame(raf);
      raf = 0;
      // Selective disconnect: drops only analyser→butterchurn, never the
      // analyser→destination edge the player's audio actually flows through.
      if (analyser) try { viz.disconnectAudio(analyser); } catch { /* already gone */ }
      // WP-4: give BOTH GL contexts back - the HDR present context on the DOM canvas and
      // butterchurn's own on the offscreen render canvas - or a remount leaks them (browsers
      // cap WebGL2 contexts at ~16 and silently drop the oldest).
      if (useHdr) {
        releaseHdrCanvas(canvas);
        try {
          (renderCanvas.getContext('webgl2') as WebGL2RenderingContext | null)
            ?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch { /* already gone */ }
      }
    },
  };
}
