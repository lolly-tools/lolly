// SPDX-License-Identifier: MPL-2.0
/**
 * Frequency-bar audio meters. drawMeterBars/drawMeterBaseline paint one frame of the
 * shared bar look, so the Neurospicy player's meter (components/music-player.ts) and
 * the catalog details modal's big preview meter stay visually identical - both read
 * their colour from the canvas's CSS `color` at draw time, so they follow the theme.
 *
 * attachAudioMeter drives a canvas from an <audio> element: the modal preview plays
 * through a plain element (outside the focus-loop graph), so it needs its own
 * analyser. One shared AudioContext serves every preview - createMediaElementSource
 * permanently reroutes an element's output, and contexts are a scarce per-page
 * resource - with one source per element, created lazily on first play (the context
 * can't run before a user gesture anyway).
 */

import { prefersReducedMotion } from './a11y-prefs.ts';

type WinAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/** One frame of frequency bars (bottom-anchored, louder = more opaque). */
export function drawMeterBars(c2d: CanvasRenderingContext2D, w: number, h: number, analyser: AnalyserNode, color: string): void {
  const bins = analyser.frequencyBinCount;
  const data = new Uint8Array(bins);
  analyser.getByteFrequencyData(data);
  const bars = Math.min(32, bins);
  const gap = 2;
  const bw = (w - gap * (bars - 1)) / bars;
  c2d.fillStyle = color;
  for (let i = 0; i < bars; i++) {
    const v = (data[Math.floor((i / bars) * bins)] ?? 0) / 255;
    const bh = Math.max(1, v * h);
    c2d.globalAlpha = 0.35 + v * 0.65;
    c2d.fillRect(i * (bw + gap), h - bh, bw, bh);
  }
  c2d.globalAlpha = 1;
}

/** The idle/paused state: a faint 1px baseline. */
export function drawMeterBaseline(c2d: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  c2d.fillStyle = color;
  c2d.globalAlpha = 0.25;
  c2d.fillRect(0, h - 1, w, 1);
  c2d.globalAlpha = 1;
}

// Shared across every preview meter (see module doc).
let previewCtx: AudioContext | null = null;

/**
 * Drive `canvas` from `audioEl`'s output while it plays. Returns a dispose fn - 
 * call it when the element's UI is torn down (it disconnects the media source,
 * which also silences a detached element that would otherwise play on).
 *
 * Only same-origin/blob sources are metered: a cross-origin element routed through
 * a MediaElementSource is CORS-tainted and outputs SILENCE - worse than no meter - 
 * so those get the plain element (the canvas hides itself).
 */
export interface MeterHandle {
  /** Tear down the meter and release its listeners. */
  (): void;
  /**
   * The live AnalyserNode, once the graph exists (first play), else null.
   *
   * Exposed because an element can only ever produce ONE MediaElementSource and can
   * never lose it - so anything else that wants this element's audio (the MilkDrop
   * visualiser in the catalog's details modal) MUST share this node rather than build a
   * second source, which would throw and leave the preview silent.
   */
  analyser(): AnalyserNode | null;
  /** The shared preview AudioContext, which butterchurn needs alongside the node. */
  context(): BaseAudioContext | null;
}

/**
 * Where a meter reads a source the element cannot hand over. A generated tune plays into
 * the element as a live stream, from its own audio graph, which already has an analyser
 * (lib/tune-preview.ts): the meter reads that one, and never wraps the element in a
 * MediaElementSource, so the element's own output stays as it is. Asked afresh each time,
 * since a tune that ends and plays again brings a new analyser.
 */
export type MeterTap = () => { analyser: AnalyserNode; context: BaseAudioContext } | null;

export function attachAudioMeter(canvas: HTMLCanvasElement, audioEl: HTMLAudioElement, tap?: MeterTap): MeterHandle {
  const c2d = canvas.getContext('2d');
  if (!c2d) return Object.assign(() => { /* nothing attached */ }, { analyser: () => null, context: () => null });
  // A function, not a captured boolean: a meter attached at page load would
  // otherwise latch the value before boot hydration applied the profile pref,
  // and never notice a later toggle.
  const reduced = prefersReducedMotion;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let disposed = false;
  let running = false;

  const idle = (): void => {
    const color = getComputedStyle(canvas).color || '#888';
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    drawMeterBaseline(c2d, canvas.width, canvas.height, color);
  };
  idle();

  // 'pending' = no src yet (e.g. a zzfxm song still rendering to its WAV blob) - a
  // play in that window must NOT latch the canvas hidden; the next 'play' retries.
  const sourceState = (): 'ok' | 'pending' | 'unsafe' => {
    const src = audioEl.currentSrc || audioEl.src;
    if (!src) return 'pending';
    try {
      const u = new URL(src, location.href);
      return u.protocol === 'blob:' || u.origin === location.origin ? 'ok' : 'unsafe';
    } catch { return 'unsafe'; }
  };

  /** The analyser to draw from: the tap's, when the meter has one, else the element's own. */
  const current = (): AnalyserNode | null => (tap ? tap()?.analyser ?? null : analyser);

  const ensureGraph = (): boolean => {
    if (tap) return current() !== null;
    if (analyser) return true;
    const state = sourceState();
    if (state !== 'ok') {
      if (state === 'unsafe') canvas.hidden = true;
      return false;
    }
    try {
      const AC = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
      if (!AC) return false;
      previewCtx ??= new AC();
      if (previewCtx.state === 'suspended') void previewCtx.resume().catch(() => { /* next gesture */ });
      source = previewCtx.createMediaElementSource(audioEl);
      analyser = previewCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(previewCtx.destination);
      return true;
    } catch { canvas.hidden = true; return false; }
  };

  const draw = (): void => {
    if (disposed || !canvas.isConnected) { running = false; return; }
    const node = current();
    if (node && !audioEl.paused && !audioEl.ended && !reduced()) {
      const color = getComputedStyle(canvas).color || '#888';
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      drawMeterBars(c2d, canvas.width, canvas.height, node, color);
      requestAnimationFrame(draw);
    } else {
      idle();
      running = false; // pause/ended park on the baseline; the next 'play' restarts
    }
  };
  const onPlay = (): void => {
    if (!ensureGraph() || running) return;
    running = true;
    requestAnimationFrame(draw);
  };
  audioEl.addEventListener('play', onPlay);
  // A live tune's analyser exists only once its stream is running, after 'play'.
  audioEl.addEventListener('playing', onPlay);

  return Object.assign(
    () => {
      disposed = true;
      audioEl.removeEventListener('play', onPlay);
      audioEl.removeEventListener('playing', onPlay);
      try { source?.disconnect(); analyser?.disconnect(); } catch { /* already torn down */ }
    },
    {
      analyser: current,
      context: () => (tap ? tap()?.context ?? null : analyser ? previewCtx : null),
    },
  );
}
