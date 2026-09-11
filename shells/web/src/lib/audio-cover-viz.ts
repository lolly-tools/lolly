// SPDX-License-Identifier: MPL-2.0
/**
 * Rendering one deterministic MilkDrop frame for a cover.
 *
 * This is the bridge between lib/audio-cover-bake.ts (which owns the cache and the
 * offscreen host) and lib/butterchurn-viz.ts (which owns the GL). It is separate from
 * both so the caching logic stays unit-testable without a GPU, and so the visualizer is
 * imported lazily - butterchurn is a 44 KB chunk that a user who never opens a cover
 * picker should not pay for.
 *
 * WHY A WARM-UP RATHER THAN "RENDER ONE FRAME". MilkDrop is a feedback simulation: each
 * frame is a function of the last, so a cold first frame is a nearly empty field. Asking
 * for a single frame yields something between black and a faint smear - the exact
 * failure this area is notorious for, and it announces itself with no error at all. So
 * the visualizer is reset to a known state, driven with real injected audio for
 * BAKE_WARMUP frames, and only then read.
 *
 * WHY INJECTED AUDIO. Reading whatever the speakers happen to be playing would make a
 * cover depend on when you clicked. The frames come from host.audio's opt-in sample
 * windows instead, so (asset, preset, brand) always produces the same picture - which is
 * what makes the bake a legitimate CACHE rather than a snapshot.
 */
import { BAKE_WARMUP } from './audio-cover-bake.ts';
import { buildVizPalette } from './viz-palette.ts';
import { vizPossible } from './viz-support.ts';

/** Time-domain window length. NOT a free choice: butterchurn's AudioProcessor allocates
 *  `numSamps * 2 = 1024` and `updateAudio` copies in with a bare `.set()`, so a longer
 *  window throws RangeError inside the renderer - which stands the visualizer down for
 *  the session, silently, behind a black canvas. */
export const VIZ_SAMPLES = 1024;

/** The audio the cover is drawn from: one time-domain window per analysis frame, in
 *  butterchurn's own 0..255-centred-on-128 form (host.audio's `wave`). */
export interface VizAudio {
  bytes: Uint8Array;
  samples: number;
  count: number;
  /** The frame to READ - the loudest moment in the middle of the clip, so a cover shows
   *  the track doing something rather than the silence clips routinely open on. */
  poster: number;
}

/** Can this browser render a MilkDrop cover at all? Callers use it to decide whether to
 *  OFFER the option - a missing WebGL2 must degrade to "not shown", never to a failure. */
export function canBakeViz(): boolean {
  // The LAX probe: this is a surface someone tapped, not ambient chrome. See vizPossible.
  return vizPossible();
}

/**
 * Mount a visualizer into `el`, warm it deterministically, and hand back the canvas with
 * a readable frame on it.
 *
 * Returns null rather than throwing when the visualizer cannot mount - the caller falls
 * back to the drawn waveform, which is a fine cover and always available.
 */
export async function renderVizFrame(
  el: HTMLElement,
  presetId: string,
  pool: readonly string[],
  audio: VizAudio,
  size: number,
): Promise<HTMLCanvasElement | null> {
  if (!vizPossible() || !audio.count || !audio.samples) return null;

  const canvas = document.createElement('canvas');
  // Device pixels throughout, and the drawing buffer set to exactly the width/height the
  // visualizer is told about: butterchurn never touches canvas.width/height itself and
  // its renderToScreen uses the numbers it was given, so any mismatch renders the frame
  // into a corner of the buffer. See butterchurn-viz.ts's DPR note.
  canvas.width = size;
  canvas.height = size;
  canvas.style.cssText = `width:${size}px;height:${size}px;display:block;`;
  el.appendChild(canvas);

  const { mountViz } = await import('./butterchurn-viz.ts');
  let cur = 0;
  // Mount on a preset id we KNOW resolves, then swap an artist preset in below. Handing
  // mountViz an unrecognised id is not an error - vizPresetById falls back to
  // VIZ_PRESETS[0] silently - so a stock id passed here would bake a cover of an entirely
  // different preset, and nothing would say so.
  const handle = await mountViz(canvas, undefined, presetId, undefined, buildVizPalette(pool), {
    driven: true,          // no rAF loop - we advance it ourselves
    deterministic: true,   // seed Math.random so two bakes of one preset agree
    capture: true,         // preserveDrawingBuffer, or toBlob reads an empty buffer
    audio: {
      frame: () => ({
        wave: audio.bytes.subarray(cur * audio.samples, (cur + 1) * audio.samples),
        seed: cur,
      }),
    },
  });
  if (!handle) { canvas.remove(); return null; }

  try {
    // An artist preset lives in the staged pack, not the registry: fetch it and hand the
    // object over. `presetId` here is the BARE id stored in the cover recipe.
    const { stockPresetIndex, loadStockPreset } = await import('./viz-stock.ts');
    const isStock = (await stockPresetIndex().catch(() => [])).some(p => p.id === presetId);
    if (isStock) {
      const raw = await loadStockPreset(presetId, handle.palette(), 'strong');
      if (raw) handle.setRawPreset(presetId, raw);
    }
    // Warm from a CLEARED field, not from whatever the context inherited, so the cover
    // does not depend on what was rendered before it.
    handle.reset();
    const target = Math.min(audio.count - 1, Math.max(0, audio.poster));
    const from = Math.max(0, target - BAKE_WARMUP);
    for (let i = from; i <= target; i++) {
      cur = i;
      // A CONSTANT elapsed: butterchurn advances its preset clock by this and damps its
      // fps estimate toward it, so feeding real deltas would make the same frame index
      // render differently depending on how busy the machine was.
      handle.renderFrame(1 / 30);
    }
    return canvas;
  } finally {
    // The context is released here, before the caller reads the canvas - the pixels
    // survive because `capture` kept the drawing buffer, and holding the context open
    // would waste one of the ~16 the browser allows.
    handle.destroy();
  }
}
