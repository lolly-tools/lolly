// SPDX-License-Identifier: MPL-2.0
/**
 * OKLCH gamut charts - a 2D plane through colour space, painted as real pixels,
 * with the sRGB / Display-P3 / Rec.2020 boundaries visible on it.
 *
 * This is the companion to palette-wheel.ts, not a replacement. The wheel is an
 * instrument dial: it shows a palette's spread of hue and chroma at a glance.
 * What it simply cannot show is where the gamut ends, because the sRGB
 * boundary is a curve in lightness×chroma that moves with hue, and the wheel has
 * no lightness axis. That curve is the thing a brand decision turns on - it is
 * why a yellow can be twice as chromatic as a blue, why an evenly-stepped ramp
 * goes lopsided across hues, and why a colour "changes" when exported.
 *
 * ## How it's drawn: one fill, contour lines on top
 *
 * A single pass of the engine primitive (`host.color.slice` / `oklchSlice`) at
 * the widest gamut being charted, painted at FULL strength, with each narrower
 * gamut's boundary stroked over it as a thin contour - the way oklch.com reads,
 * and the way a topographic map reads.
 *
 * An earlier version drained chroma from the wide-gamut bands to mark them as
 * unshowable. It was defensible but wrong in practice: going outward past a line
 * made the colour look DULLER, which is backwards from what the axis says, and it
 * cost three slice passes instead of one - the bulk of the lag while dragging.
 * The contour carries the same information without editing the colour.
 *
 * Note, and it matters: the fill is encoded in the DISPLAY's own space - 
 * `display-p3` on a wide-gamut screen, sRGB otherwise (see lib/display-gamut.ts,
 * which acquires the context and reports the space actually granted). Colour up to
 * THAT space's boundary is the real thing; only pixels past it are painted
 * GAMUT-MAPPED - the nearest colour the surface can hold, not the real one. So on
 * a P3 display the P3 band is true colour, while a Rec.2020-limited chart is still
 * approximate past P3, and that boundary is the contour drawn with the heavier
 * weight. The contours are the facts; the colour past the outermost one is not.
 */

// No `import './oklch-slice.css'` here, deliberately: the node test runner has
// no CSS loader, so a module that imports a stylesheet cannot be exercised under
// `node --test` at all (which is why palette-wheel had to split its geometry
// into a second file to get any coverage). Mounting surfaces import
// `lib/oklch-slice.css` themselves - brand-editor.ts does, alongside the rest of
// the studio's sheet - and this module stays testable as a whole.
import {
  hexToOklch, oklchSlice, sliceGamutRegion, gamutSourceId, chromaAxisMax, resolveGamutSource,
} from '@lolly/engine';
import type { SlicePlane, GamutName, GamutLimit, PixelSpace } from '@lolly/engine';
import type { EncodeSpace } from '@lolly/engine';
import { escapeHtml } from './html.ts';
import { acquire2d, displayAnchorGamut, noteEncodeDowngrade, displaySupportsHdr } from './display-gamut.ts';
import { hdrPngUrl, hdrExposedLinearRgba } from './hdr-image.ts';
import type { HdrJob, HdrResult, HdrExposure } from './hdr-image.ts';
import { hdrCanvasSupported, paintHdrCanvas } from './hdr-canvas.ts';
import {
  SLICE_AXES, oklchSliceXY, sliceXYToOklch, sliceOffPlane, sliceTicks, tickThinned,
} from './oklch-slice-geom.ts';

export { SLICE_C_MAX, SLICE_AXES, sliceFixedOf } from './oklch-slice-geom.ts';

/** One palette swatch plotted on a chart. `idx` indexes the editor's swatch list. */
export interface SliceDot {
  idx: number;
  /** The dot's PAINT - only a displayable colour can be put in `--dot:` or read as a
   *  label, so this stays a hex even when the subject is outside sRGB. */
  hex: string;
  label: string;
  /**
   * The dot's authored colour, when the caller has one that a hex cannot hold.
   *
   * Its POSITION comes from here. Deriving the position from `hex` instead means
   * deriving it from a gamut-MAPPED bake whenever the subject sits outside sRGB, and
   * mapping preserves lightness and hue while reducing chroma - so the dot lands on
   * the sRGB contour on every plane with a chroma axis (L×C, C×H) while the L×H
   * plane, whose two axes both survive the clamp, correctly shows it outside. The
   * chart then contradicts the readout, the 3D solid and its own third view.
   *
   * The same reason `SliceChartHandlers.oklchOf` exists for the DRAG path; this is
   * the render path. Optional, so a caller whose colours genuinely are hex (the
   * brand editor's swatches) needs no change.
   */
  oklch?: { l: number; c: number; h: number } | null;
}

export interface SliceChartState {
  plane: SlicePlane;
  /** The channel the plane holds constant: hue° for 'lc', lightness for 'ch', chroma for 'lh'. */
  fixed: number;
  /** Ceiling of the chroma axis. Defaults to the ceiling `limit` implies
   *  (`chromaAxisMax`): 0.34 on sRGB, 0.5 on Rec.2020, whose green and magenta
   *  spikes a flat 0.4 used to cut flat tops across. */
  cMax?: number;
  /**
   * The gamut to chart. Default 'rec2020' - everything we can classify by name.
   * Narrowing it stops the fill (and the legend, and the P3 edge) at that gamut,
   * for a caller that wants the chart to answer one display's question.
   *
   * Any {@link GamutLimit}, so an ICC press profile charts here exactly as a
   * display gamut does. It is NOT a superset of sRGB or P3 - a press sits inside
   * them in the cyans and outside in the yellows - which is why both contours are
   * drawn against one (see `legendHtml`).
   */
  limit?: GamutLimit;
}

/**
 * The chroma ceiling a chart is drawn to: explicit if the caller set one, else
 * derived from the gamut being charted. Exported because every surface that
 * SHARES a chart's scale - its slider, its typed input, its axis labels - has to
 * ask the same question and get the same answer.
 */
export const sliceCMax = (state: Pick<SliceChartState, 'cMax' | 'limit'>): number =>
  state.cMax ?? chromaAxisMax(state.limit ?? 'rec2020');

/** Human names for the axes, used in labels and the hint line. */
const CHANNEL_NAME: Record<'l' | 'c' | 'h', string> = {
  l: 'Lightness', c: 'Chroma', h: 'Hue',
};

const PLANE_LABEL: Record<SlicePlane, string> = {
  lc: 'Lightness × Chroma',
  ch: 'Chroma × Hue',
  lh: 'Lightness × Hue',
};

/** The fixed channel's value, formatted the way that channel is normally read. */
export function formatFixed(plane: SlicePlane, fixed: number): string {
  const ch = SLICE_AXES[plane].fixed;
  if (ch === 'h') return `${Math.round(fixed)}°`;
  if (ch === 'l') return `${Math.round(fixed * 100)}%`;
  return fixed.toFixed(3);
}

// ── Markup ────────────────────────────────────────────────────────────────────

function ticksHtml(ch: 'l' | 'c' | 'h', axis: 'x' | 'y', cMax: number): string {
  const ticks = sliceTicks(ch, cMax);
  // Which labels a narrow chart drops, and which two are its ends - both are
  // stated as classes rather than left to CSS `nth-of-type`, which counted the
  // axis NAME as one of the spans and could not tell a first tick from a last.
  const thin = tickThinned(ticks.length);
  return ticks.map((t, i) => {
    // The y axis runs bottom-up (its maximum is at the top), so a tick at
    // fraction `at` sits at 1 - at from the top.
    const pos = axis === 'x' ? t.at : 1 - t.at;
    const side = axis === 'x' ? 'left' : 'top';
    const end = i === 0 ? ' okls-tick--first' : i === ticks.length - 1 ? ' okls-tick--last' : '';
    return `<span class="okls-tick${end}${thin[i] ? ' okls-tick--thin' : ''}"`
      + ` style="${side}:${(pos * 100).toFixed(3)}%">${escapeHtml(t.label)}</span>`;
  }).join('');
}

function dotHtml(d: SliceDot, plane: SlicePlane, fixed: number, cMax: number): string {
  const o = d.oklch ?? hexToOklch(d.hex);
  if (!o) return '';
  const p = oklchSliceXY(plane, o, cMax);
  const off = sliceOffPlane(plane, o, fixed, cMax);
  const fixedCh = CHANNEL_NAME[SLICE_AXES[plane].fixed].toLowerCase();
  const aria = off > 0.02
    ? `${d.label} ${d.hex} - off this slice (different ${fixedCh}); drag to recolour, click to bring the slice to it`
    : `${d.label} ${d.hex} - drag to recolour, click to edit`;
  return `<button type="button" class="okls-dot${o.l > 0.82 ? ' is-light' : ''}"
    style="left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%;--dot:${escapeHtml(d.hex)};--off:${off.toFixed(3)}"
    data-okls-idx="${d.idx}" data-hex="${escapeHtml(d.hex.toUpperCase())}"
    aria-label="${escapeHtml(aria)}"></button>`;
}

/**
 * The chart's markup - canvas fill, boundary overlay, axis ticks and the palette
 * dots. Call {@link paintSliceChart} after it is in the document (the canvas
 * needs a measured box) and {@link wireSliceChart} to make it interactive.
 */
export function renderSliceChart(
  state: SliceChartState,
  dots: readonly SliceDot[] = [],
  opts: { editable?: boolean } = {},
): string {
  const cMax = sliceCMax(state);
  const axes = SLICE_AXES[state.plane];
  const edit = opts.editable ? ' is-editable' : '';
  const label = `${PLANE_LABEL[state.plane]} at ${CHANNEL_NAME[axes.fixed].toLowerCase()} ${formatFixed(state.plane, state.fixed)}`;
  return `
    <div class="okls" data-okls data-plane="${state.plane}">
      <div class="okls-frame">
        <div class="okls-axis okls-axis--y" aria-hidden="true">
          <span class="okls-axis-name">${escapeHtml(CHANNEL_NAME[axes.y])}</span>
          ${ticksHtml(axes.y, 'y', cMax)}
        </div>
        <div class="okls-plot${edit}" data-okls-plot role="group" aria-label="${escapeHtml(label)}">
          <canvas class="okls-canvas" data-okls-canvas aria-hidden="true"></canvas>
          <img class="okls-hdr" data-okls-hdr alt="" aria-hidden="true" hidden>
          <canvas class="okls-hdr-gl" data-okls-hdr-gl aria-hidden="true" hidden></canvas>
          <svg class="okls-edges" data-okls-edges viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            <path class="okls-edge okls-edge--p3" data-okls-edge="p3" fill="none" vector-effect="non-scaling-stroke"></path>
            <path class="okls-edge okls-edge--srgb" data-okls-edge="srgb" fill="none" vector-effect="non-scaling-stroke"></path>
          </svg>
          ${dots.map(d => dotHtml(d, state.plane, state.fixed, cMax)).join('')}
        </div>
      </div>
      <div class="okls-axis okls-axis--x" aria-hidden="true">
        ${ticksHtml(axes.x, 'x', cMax)}
        <span class="okls-axis-name">${escapeHtml(CHANNEL_NAME[axes.x])}</span>
      </div>
      <p class="okls-legend">${legendHtml(state.limit ?? 'rec2020')}</p>
    </div>`;
}

/**
 * A key per CONTOUR actually drawn, plus one for the empty area.
 *
 * The keys are LINE WEIGHTS, not colour chips, because that is what distinguishes
 * the boundaries on the chart: every contour is the same white line and they are
 * told apart by thickness. A coloured dot would be describing a rendering the
 * chart no longer uses. The limit itself gets no line key - its boundary is where
 * the colour stops, so the checkerboard key is the one that names it.
 *
 * Which contours those are is decided by {@link contourGamuts}, the SAME rule
 * `paintEdges` draws by, so a key can never name a line that is not on the plot.
 * Against a press profile that is both of them at once: a press gamut is not a
 * superset of sRGB or of P3 (inside them in the cyans, outside in the yellows),
 * so the interleaving of the three is the picture worth having.
 */
function legendHtml(limit: GamutLimit): string {
  const keys = contourGamuts(limit).map(g =>
    `<span class="okls-key okls-key--line okls-key--${g}">${GAMUT_KEY_LABEL[g]}</span>`);
  // 'no display' is only true of a DISPLAY gamut. Past a press profile's boundary
  // the colour exists and your screen very likely shows it - the press just cannot
  // put it down - so the clause is dropped rather than restated.
  const builtin = typeof limit === 'string';
  keys.push(`<span class="okls-key okls-key--none">past ${escapeHtml(limitTitle(limit))}`
    + `${builtin ? ' - no display' : ''}</span>`);
  return keys.join('');
}

const GAMUT_KEY_LABEL: Record<Exclude<GamutName, 'none'>, string> = {
  srgb: 'sRGB', p3: 'Display-P3', rec2020: 'Rec.2020',
};

/** The limit's name for a legend: the built-in title, else the source's own label. */
const limitTitle = (limit: GamutLimit): string =>
  (typeof limit === 'string' ? GAMUT_KEY_LABEL[limit] : resolveGamutSource(limit).label);

/**
 * Which of the two contour gamuts are actually drawn over a fill of `limit`.
 *
 * A contour is skipped when it IS the limit (the fill's own edge is that
 * boundary) or when the fill stops short of it - a P3 contour on an sRGB chart
 * would float in empty space. Everything else is drawn, which for a profile
 * limit means BOTH, because a press gamut contains neither.
 *
 * Exported because the Lab's 3D solid draws its comparison cages by the SAME
 * rule. Two views of one colour cannot be allowed to disagree about which
 * boundaries are worth showing - and the 3D view is where "FOGRA39 is inside
 * sRGB in the cyans and outside it in the yellows" stops being a sentence.
 */
export function contourGamuts(limit: GamutLimit): ('srgb' | 'p3')[] {
  const id = gamutSourceId(limit);
  return (['srgb', 'p3'] as const).filter(g => g !== id && !(g === 'p3' && id === 'srgb'));
}

// ── Painting ──────────────────────────────────────────────────────────────────

/** What a canvas was last painted with, so an identical repaint is skipped. */
const PAINTED = new WeakMap<HTMLCanvasElement, string>();

/**
 * Paint (or repaint) a chart's fill and boundary lines. Safe to call on every
 * frame of a drag: it no-ops when nothing that affects the pixels has changed,
 * and `quality: 'draft'` halves the resolution for the duration of a scrub.
 *
 * Cost at full quality is three engine slices - about 17ms for a 320×200 plot on
 * a laptop, so this belongs inside a rAF, not in a pointermove handler.
 */
export function paintSliceChart(
  root: HTMLElement,
  state: SliceChartState,
  opts: { quality?: 'full' | 'draft'; exp?: HdrExposure; hdr?: boolean } = {},
): void {
  let canvas = root.querySelector<HTMLCanvasElement>('[data-okls-canvas]');
  const plot = root.querySelector<HTMLElement>('[data-okls-plot]');
  if (!canvas || !plot) return;
  const box = plot.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return; // not laid out yet (a folded card)

  const cMax = sliceCMax(state);
  const draft = opts.quality === 'draft';
  // HDR overlay tiering (plan 154 WP-5). On an HDR display the finished slice is
  // shown above SDR white one of two ways:
  //   Tier A - a live WebGL RGBA16F canvas (Chromium w/ configureHighDynamicRange):
  //            no encode, live even mid-drag. Preferred where available.
  //   Tier B - a Rec.2100-PQ cICP <img> (WebKit, which has no live HDR canvas):
  //            encoded off-thread, resolves on settle (full quality only).
  // Everything currently testable lacks the Tier A API, so tierA is false and the
  // behaviour is exactly Tier B. Both are in the key so a display/tier change repaints.
  //
  // `opts.hdr === false` is the SDR side of the Lab's A/B preview toggle (plan 154
  // WP-5): it forces the SDR rendering on an HDR panel so the boost can be compared
  // against no boost. It can only SUBTRACT headroom, never add it - on an SDR display
  // `displaySupportsHdr()` is already false, so this leaves that path byte-identical.
  const wantHdr = displaySupportsHdr() && opts.hdr !== false;
  const tierA = wantHdr && hdrCanvasSupported();
  // The exposure the headroom axis is set to (plan 154 WP-5). Part of the paint key
  // below so a nits change forces the repaint that reschedules the HDR encode; the
  // SDR fill is unaffected by it, so on an SDR display it changes nothing on screen.
  const exp = opts.exp;
  const expKey = exp
    ? `${exp.peakNits ?? ''},${exp.sdrWhiteNits ?? ''},${exp.kneeLo ?? ''},${exp.kneeHi ?? ''}`
    : '';
  const hdrActive = !draft && wantHdr && !tierA; // Tier B: image path, settle-only
  // Cap the backing store: past ~2 device pixels per CSS pixel the extra detail
  // is invisible on a gradient field but the paint cost is real.
  // 0.75 rather than 0.5: at half resolution the draft was visibly blocky while
  // dragging, and the engine's hoisted membership test made the finer draft cheap
  // - 5.4ms a chart against 13.9ms before it, for 2.25x the pixels.
  const scale = draft ? 0.75 : Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(box.width * scale));
  const h = Math.max(1, Math.round(box.height * scale));

  const limit: GamutLimit = state.limit ?? 'rec2020';
  // `gamutSourceId(limit)`, not the limit itself: a GamutSource object stringifies
  // to '[object Object]', so every profile would share one cache key and the second
  // one charted would silently reuse the first one's pixels.
  // `encode` is part of the key: a window dragged from a P3 monitor to an sRGB one
  // (or a latched downgrade) has to repaint, and without it the stale pixels would
  // silently be reused.
  //
  // The display's GAMUT is in the key too, and separately: a context keeps the space
  // it was created with, so a window moved between monitors can leave the encode
  // unchanged while the boundary marked as "yours" has to move - and the marking
  // happens inside the paint.
  const keyFor = (encode: EncodeSpace): string =>
    `${state.plane}|${state.fixed.toFixed(4)}|${cMax}|${gamutSourceId(limit)}|${encode}|${displayAnchorGamut()}|${hdrActive}|${tierA}|${expKey}|${w}x${h}`;

  // The context, the ImageData and the engine's `encode` MUST name the same space - 
  // mismatching them shifts every pixel with nothing on screen to say so. They are
  // kept in lockstep by asking the platform first and deriving the other two from
  // its answer, in this order, so there is no path on which they can differ.
  const acquired = acquire2d(canvas);
  if (!acquired) return;
  const ctx = acquired.ctx;
  // The canvas acquire2d actually drew a context on. It is a NEW node when the
  // display changed under us, because a 2D context cannot change colour space after
  // creation - so everything below (the size, putImageData, the repaint key) must
  // follow this one. The old node is gone from the document, and being a fresh key it
  // carries no stale PAINTED entry either.
  canvas = acquired.canvas;
  let encode = acquired.encode;
  if (PAINTED.get(canvas) === keyFor(encode)) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0, 0, w, h);

  // Second, independent check: a browser that took the context option but not this
  // one either throws on the bag or hands back an sRGB buffer. Either way `encode`
  // collapses BEFORE the expensive slice is computed, so the failure mode is
  // "today's rendering", never "every pixel shifted".
  let out: ImageData;
  try {
    out = ctx.createImageData(w, h, { colorSpace: encode });
  } catch {
    out = ctx.createImageData(w, h);
    encode = 'srgb';
  }
  if (out.colorSpace && out.colorSpace !== encode) {
    encode = out.colorSpace as EncodeSpace;
    noteEncodeDowngrade(encode);
  }

  // One pass, at the widest gamut being charted, at full strength. Anything past
  // it comes back transparent and the plot's checkerboard shows through, so "no
  // display can do this" reads as absence rather than as a colour choice.
  //
  // Last to be told which space it is in, deliberately: the authoritative, costly
  // step (~64k gamut maps) can never be computed for a space the surface did not
  // grant.
  const img = oklchSlice({ plane: state.plane, fixed: state.fixed, width: w, height: h, cMax, limit, encode });
  out.data.set(img.data);
  ctx.putImageData(out, 0, 0);
  PAINTED.set(canvas, keyFor(encode));

  const space: PixelSpace = encode === 'display-p3' ? 'display-p3-linear' : 'srgb-linear';
  const glCanvas = root.querySelector<HTMLCanvasElement>('[data-okls-hdr-gl]');
  if (tierA) {
    // Tier A: live HDR canvas. If it paints, hide the Tier B <img>; if the GPU path
    // fails at runtime, fall back to the Tier B image for this paint.
    const ok = glCanvas
      ? paintHdrCanvas(glCanvas, hdrExposedLinearRgba(img.data, w, h, space, exp), w, h, encode === 'display-p3' ? 'display-p3' : 'srgb')
      : false;
    if (glCanvas) glCanvas.hidden = !ok;
    scheduleHdrOverlay(root, img.data, w, h, encode, ok ? false : (!draft && wantHdr), exp);
  } else {
    if (glCanvas) glCanvas.hidden = true;
    scheduleHdrOverlay(root, img.data, w, h, encode, hdrActive, exp);
  }
  paintEdges(root, state, cMax, limit);
}

/** Pending settle-timer per chart, so a superseding change cancels the last one. */
const HDR_TIMERS = new WeakMap<HTMLElement, number>();
/** Latest posted job id per chart, so a late worker reply for a state that has
 *  since changed is discarded rather than painted over the current one. */
const HDR_LATEST = new WeakMap<HTMLElement, number>();
/** In-flight job id → the `<img>` to update when the worker replies. */
const HDR_PENDING = new Map<number, HTMLImageElement>();
let hdrSeq = 0;
/** undefined = not tried yet, null = no Worker here, else the shared encoder. */
let hdrWorker: Worker | null | undefined;

/** Settle delay before the (off-thread) HDR encode is posted. The SDR canvas has
 *  already painted, so the colour change is instant; only a PAUSE posts an encode,
 *  which is what keeps a mobile CPU from queuing three PNGs on every drag frame. */
const HDR_SETTLE_MS = 120;

const hideHdr = (img: HTMLImageElement): void => {
  const prev = img.getAttribute('src');
  if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); // never hold two blobs for one <img>
  img.hidden = true;
  img.removeAttribute('src');
};

/**
 * The shared HDR encode worker (hdr-image.worker.ts), created lazily on first HDR
 * use. Encoding a PNG is heavy enough to jank a phone on the UI thread, and it is
 * DOM-free, so it runs off-thread - which is what buys back full 16-bit with no
 * jank. Null where `Worker` is unavailable (a non-browser host), so callers fall
 * back to a synchronous encode.
 */
function hdrEncodeWorker(): Worker | null {
  if (hdrWorker !== undefined) return hdrWorker;
  if (typeof Worker === 'undefined') { hdrWorker = null; return null; }
  try {
    const w = new Worker(new URL('./hdr-image.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<HdrResult>): void => {
      const { id, png } = e.data;
      const img = HDR_PENDING.get(id);
      HDR_PENDING.delete(id);
      if (!img) return; // superseded or torn down while in flight - drop it
      const prev = img.getAttribute('src');
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      img.src = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
      img.hidden = false;
    };
    // If the worker fails to load or throws, retire it: the next encode falls back
    // to the synchronous path (the SDR canvas is already correct in the meantime).
    w.onerror = (ev): void => {
      hdrWorker = null;
      HDR_PENDING.clear();
      console.warn('[color-lab] HDR encode worker failed, falling back to inline encode', ev.message ?? ev);
    };
    hdrWorker = w;
  } catch { hdrWorker = null; }
  return hdrWorker;
}

/** Forget any in-flight/pending job for a chart (on hide or supersede), so its late
 *  worker reply is discarded. */
function dropHdrJob(root: HTMLElement): void {
  const id = HDR_LATEST.get(root);
  if (id !== undefined) HDR_PENDING.delete(id);
  HDR_LATEST.delete(root);
}

/**
 * Schedule the finished slice to be laid over the canvas as a Rec.2100-PQ cICP PNG
 * on an HDR display, or hide it. The `<img>` is a sibling of the canvas in
 * `.okls-plot`, so a canvas node swap (a monitor change) never orphans it, and its
 * transparent (beyond-gamut) pixels stay transparent so the plot checkerboard reads
 * through exactly as under the canvas.
 *
 * DEBOUNCED, then encoded OFF the main thread: WebKit has no live HDR canvas, so HDR
 * means a PNG encode - expensive on a phone, and it janked the iPad when it ran
 * synchronously on every colour change. The settle coalesces rapid changes and the
 * worker keeps the encode off the UI thread, so the SDR update stays instant, the
 * HDR image catches up a beat later, and it can be full 16-bit again. Failure or a
 * missing worker degrades to a synchronous 8-bit encode (or, on error, the SDR
 * canvas alone), never a blank.
 */
function scheduleHdrOverlay(
  root: HTMLElement,
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  encode: EncodeSpace,
  active: boolean,
  exp?: HdrExposure,
): void {
  const img = root.querySelector<HTMLImageElement>('[data-okls-hdr]');
  if (!img) return;
  const pending = HDR_TIMERS.get(root);
  if (pending !== undefined) { clearTimeout(pending); HDR_TIMERS.delete(root); }
  if (!active) { dropHdrJob(root); hideHdr(img); return; }
  // `rgba` is a fresh oklchSlice buffer (never mutated in place), so capturing it
  // for the deferred encode is safe even if another paint arrives first.
  const space: PixelSpace = encode === 'display-p3' ? 'display-p3-linear' : 'srgb-linear';
  const timer = window.setTimeout(() => {
    HDR_TIMERS.delete(root);
    const worker = hdrEncodeWorker();
    if (worker) {
      const id = ++hdrSeq;
      dropHdrJob(root); // discard any earlier in-flight result for this chart
      HDR_LATEST.set(root, id);
      HDR_PENDING.set(id, img);
      const buf = rgba.slice().buffer; // a detachable copy; the caller's buffer is left intact
      worker.postMessage({ id, rgba: buf, width: w, height: h, space, depth: 16, exp } satisfies HdrJob, [buf]);
    } else {
      try { img.src = hdrPngUrl(rgba, w, h, space, exp, 8); img.hidden = false; } catch { hideHdr(img); }
    }
  }, HDR_SETTLE_MS);
  HDR_TIMERS.set(root, timer);
}

/** Trace the sRGB and P3 boundaries as polylines, where the plane has one. */
/**
 * Stroke each narrower gamut's boundary as a contour over the fill.
 *
 * Built from `sliceGamutRegion` (closed rings) rather than the open-curve
 * `sliceGamutEdge`, because rings exist for ALL THREE planes - 'lh' has no
 * single-valued boundary curve, and it used to be left with no contour at all.
 * The ring also runs along the achromatic edge, which sits on the plot border
 * where it reads as part of the frame.
 *
 * One of the contours is also THE DISPLAY'S - when the chart reaches wider than the
 * screen does, the boundary of what you are actually seeing is already on the plot,
 * so it is given the heavier weight (`data-display="1"`, and the same marker on its
 * legend key) rather than being explained in new prose. No extra wash, no second
 * opacity system, no added strings.
 */
function paintEdges(
  root: HTMLElement, state: SliceChartState, cMax: number,
  limit: GamutLimit,
): void {
  const svg = root.querySelector<SVGSVGElement>('[data-okls-edges]');
  if (!svg) return;
  const displayGamut = displayAnchorGamut();
  // One rule, shared with the legend, so a key and a line cannot disagree.
  const drawn = new Set(contourGamuts(limit));
  let marked: 'srgb' | 'p3' | null = null;
  for (const edge of ['srgb', 'p3'] as const) {
    const path = svg.querySelector<SVGPathElement>(`[data-okls-edge="${edge}"]`);
    if (!path) continue;
    const skip = !drawn.has(edge);
    const rings = skip ? [] : sliceGamutRegion(state.plane, state.fixed, edge, 128, cMax);
    path.setAttribute('d', rings.map(ring =>
      `${ring.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(5)} ${p.y.toFixed(5)}`).join(' ')} Z`,
    ).join(' '));
    // Mark it (and its legend key) as the display's boundary only when it is
    // actually drawn - `skip` already covers "the chart stops here anyway", which is
    // the case where the fill's own edge IS the display's edge and needs no line.
    const mine = !skip && edge === displayGamut;
    if (mine) marked = edge;
    const key = root.querySelector<HTMLElement>(`.okls-key--${edge}`);
    if (mine) {
      path.dataset.display = '1';
      if (key) key.dataset.display = '1';
    } else {
      delete path.dataset.display;
      if (key) delete key.dataset.display;
    }
  }
  // The container carries the marker too, so the weight SWAP is scoped to the case
  // where one contour is the display's: the other line goes fine, and a chart with
  // no marked contour keeps the drawing it has always had.
  const legend = root.querySelector<HTMLElement>('.okls-legend');
  if (marked) {
    svg.dataset.display = marked;
    if (legend) legend.dataset.display = marked;
  } else {
    delete svg.dataset.display;
    if (legend) delete legend.dataset.display;
  }
  svg.classList.remove('is-empty');
}

/**
 * Reposition + recolour one dot in place during a drag, without re-rendering.
 *
 * `oklch` is the authored colour, for the same reason `SliceDot.oklch` exists: the
 * hex is a gamut-mapped bake, and positioning from it puts an out-of-sRGB dot on the
 * sRGB contour instead of past it. Omit it and the hex is used, which is right for a
 * caller whose swatches are hexes.
 */
export function updateSliceDot(
  root: HTMLElement, idx: number, hex: string, state: SliceChartState,
  oklch?: { l: number; c: number; h: number } | null,
): void {
  const dot = root.querySelector<HTMLElement>(`[data-okls-idx="${idx}"]`);
  if (!dot) return;
  const cMax = sliceCMax(state);
  const o = oklch ?? hexToOklch(hex);
  if (o) {
    const p = oklchSliceXY(state.plane, o, cMax);
    dot.style.left = `${(p.x * 100).toFixed(3)}%`;
    dot.style.top = `${(p.y * 100).toFixed(3)}%`;
    dot.style.setProperty('--off', sliceOffPlane(state.plane, o, state.fixed, cMax).toFixed(3));
    dot.classList.toggle('is-light', o.l > 0.82);
  }
  dot.style.setProperty('--dot', hex || 'transparent');
  dot.dataset.hex = (hex || '').toUpperCase();
}

// ── Interaction ───────────────────────────────────────────────────────────────

export interface SliceChartHandlers {
  /** Live during a drag: the dot moved to this position on the plane. */
  onRecolor(idx: number, oklch: { l: number; c: number; h: number; alpha?: number }): void;
  /** The drag ended - a good moment to persist. */
  onCommit(idx: number): void;
  /** A dot was clicked, not dragged - open its editor. */
  onPick(idx: number): void;
  /** Empty space was clicked - drop a new swatch at this colour. */
  onAdd(seed: { l: number; c: number; h: number }): void;
  /** Current hex of a dot, so a drag can keep the channels the plane doesn't move.
   *  Lossy for anything outside sRGB - see `oklchOf`, which supersedes it. */
  hexOf(idx: number): string;
  /**
   * The dot's colour as OKLCH, when the caller has one that is not a hex.
   *
   * A drag holds the plane's FIXED channel - lightness while you move around the
   * chroma × hue plane, and so on - and that value has to come from the colour
   * itself. Recovering it from `hexOf` means recovering it from a **gamut-mapped**
   * bake whenever the subject sits outside sRGB, which is a feedback loop and not a
   * subtle one: each frame re-derives the plane from a colour that is not the
   * subject, the dot lands somewhere the pointer is not, and the next frame
   * re-derives it again from the new bake. It shakes, and it only shakes past the
   * gamut boundary - which is exactly where a wide-gamut pick lives.
   *
   * Optional so a caller whose colours genuinely ARE hex (the brand editor's
   * swatches) needs no change; when present it wins.
   */
  oklchOf?(idx: number): { l: number; c: number; h: number; alpha?: number } | null;
  /** The chart's current state, read fresh on each event (plane/fixed can change under it). */
  stateOf(): SliceChartState;
}

/**
 * Make a chart interactive: drag a dot to recolour it, click one to edit, click
 * empty space to add. Returns a teardown.
 *
 * A drag moves ONLY the two channels the plane has axes for. The swatch keeps
 * its own value on the fixed channel - dragging a dot on the L×C plane at hue
 * 145 does not rotate a blue swatch to green. That is why an off-plane dot stays
 * off-plane (and stays faded) while you drag it: the projection is telling the
 * truth about where the colour is, and quietly snapping its hue to the plane's
 * would be the chart editing something the user did not point at.
 */
/** How far from a dot's centre a TOUCH still counts as that dot, in CSS px - 
 *  half a 44px target. See `dotNear`. */
export const TOUCH_SLOP = 22;

export function wireSliceChart(root: HTMLElement, h: SliceChartHandlers): () => void {
  const plot = root.querySelector<HTMLElement>('[data-okls-plot]');
  if (!plot) return () => {};

  let dragIdx = -1;
  /** True while `dragIdx` came from the near-miss slop rather than a direct hit - a
   *  guess awaiting the axis lock in `onMove`. */
  let adopted = false;
  let moved = false;
  let startX = 0, startY = 0;
  let pointerId = -1;
  /** True when the press was RETARGETED onto a dot it did not land on. The dot is
   *  `touch-action: none`, and the browser reads that from the retargeted node, so
   *  no native pan will ever start for this gesture however far the finger travels.
   *  See `panFor`. */
  let panBlocked = false;
  /** Last client Y while we are carrying a scroll the browser refused to start. */
  let panY = -1;

  /** Pointer → position on the plane, as 0–1 fractions of the plot box. */
  const posOf = (e: PointerEvent): { x: number; y: number } => {
    const r = plot.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  /**
   * The colour at a position, holding the dragged dot's value on the fixed channel.
   *
   * `oklchOf` is preferred over `hexOf` for that held value: see the note on the
   * handler. Falls back to the hex, then to the chart's own `fixed`.
   */
  const colorAt = (e: PointerEvent, idx?: number): { l: number; c: number; h: number; alpha?: number } => {
    const st = h.stateOf();
    const { x, y } = posOf(e);
    const cur = idx == null ? null
      : (h.oklchOf?.(idx) ?? (() => { const hex = h.hexOf(idx); return hex ? hexToOklch(hex) : null; })());
    const fixedCh = SLICE_AXES[st.plane].fixed;
    const fixed = cur ? (fixedCh === 'h' ? cur.h : fixedCh === 'l' ? cur.l : cur.c) : st.fixed;
    const o = sliceXYToOklch(st.plane, x, y, fixed, sliceCMax(st));
    return cur?.alpha != null ? { ...o, alpha: cur.alpha } : o;
  };

  /**
   * The dot a touch MEANT, when it did not land on one.
   *
   * The dot is 20px across on a coarse pointer against the 44px target floor, so a
   * thumb misses it routinely - and a miss used to do nothing whatsoever: the drag
   * was not a recolour, and the release was not a click either, so the gesture was
   * silently inert while the caption said "drag the chart to pick". Adopt the
   * nearest dot within a thumb's width of the press instead.
   *
   * Touch only, deliberately: a mouse and a pen are precise, and on the brand
   * editor's plots a click NEAR a swatch is how you add a new one beside it. Only
   * the imprecise pointer gets the slop.
   */
  const dotNear = (e: PointerEvent): HTMLElement | null => {
    if (e.pointerType !== 'touch') return null;
    let best: HTMLElement | null = null;
    let bestD = TOUCH_SLOP;
    for (const el of plot.querySelectorAll<HTMLElement>('[data-okls-idx]')) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (d <= bestD) { bestD = d; best = el; }
    }
    return best;
  };

  /**
   * Did this press actually land ON the dot the event was delivered to?
   *
   * `e.target` cannot answer that for a finger. Chrome's touch adjustment enlarges
   * the hit region by the touch radius and RETARGETS the pointerdown onto a small
   * button up to ~24px from its centre, so a pure vertical scroll swipe beside the
   * 20px dot arrived as `target === dot`, took the direct-hit exemption below,
   * skipped the axis lock and drove lightness to 100% with the page frozen - 
   * exactly the defect the lock exists to prevent, at every offset a thumb can
   * realistically land on (measured 0–24px at 390×844, radiusX 18 / radiusY 22).
   *
   * So on touch the geometry decides, not the retarget: inside the dot's own box is
   * a direct hit, anything else is at most an adopted guess. A mouse and a pen are
   * delivered honestly and are taken at their word.
   */
  const pressedOn = (e: PointerEvent, el: HTMLElement): boolean => {
    if (e.pointerType !== 'touch') return true;
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right
      && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  /**
   * The thing that should scroll when we hand a vertical swipe back.
   *
   * Normally nothing has to: the plot is `touch-action: pan-y`, so abandoning the
   * adoption is enough and the browser pans. But a RETARGETED press is hit-tested
   * against the dot, which is `touch-action: none` for its own 2D drag, and the
   * browser decides that before our first `pointermove` ever runs - so for those
   * gestures there is no native pan waiting to be handed anything, and letting go
   * simply left the page dead under the finger. Carry it ourselves instead: nearest
   * scrollable ancestor, else the window.
   */
  const panFor = (): { by: (dy: number) => void } | null => {
    const win = plot.ownerDocument?.defaultView;
    for (let el = plot.parentElement; el; el = el.parentElement) {
      const oy = win?.getComputedStyle(el).overflowY ?? '';
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        return { by: (dy) => { el!.scrollTop += dy; } };
      }
    }
    return win ? { by: (dy) => win.scrollBy(0, dy) } : null;
  };

  const onDown = (e: PointerEvent): void => {
    const on = (e.target as HTMLElement).closest<HTMLElement>('[data-okls-idx]');
    const hit = on && pressedOn(e, on) ? on : null;
    // A retargeted touch is still evidence of INTENT even when it is not a hit: the
    // browser aimed the finger at that dot, so keep it as the adoption candidate
    // (it can sit slightly beyond TOUCH_SLOP, which `dotNear` would miss).
    const near = hit ?? dotNear(e) ?? on;
    dragIdx = near ? Number(near.dataset.oklsIdx) : -1;
    // An ADOPTED dot (near the press, not under it) is a guess, and a guess must not
    // claim the gesture until the gesture says it is a drag. See `adopted` below.
    adopted = dragIdx >= 0 && !hit;
    panBlocked = adopted && on != null;
    panY = -1;
    moved = false; startX = e.clientX; startY = e.clientY; pointerId = e.pointerId;
    // Capture only for a real drag on a dot we are SURE about. Pressing bare plot is a
    // tap (or, on touch, the start of a page scroll - the plot is `touch-action:
    // pan-y`), and capturing that pointer would be claiming a gesture we are not
    // going to use.
    if (dragIdx >= 0 && !adopted) plot.setPointerCapture(e.pointerId);
    // Not on an adopted dot either: preventDefault here would cancel the pan that
    // `touch-action: pan-y` just handed back, which is how a scroll became a recolour.
    if (!adopted) e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (panY >= 0) { panFor()?.by(panY - e.clientY); panY = e.clientY; return; }
    if (!moved && Math.hypot(dx, dy) < 4) return;
    // ── Axis lock, for an ADOPTED dot only ──────────────────────────────────
    // The near-miss slop fixed a real defect (a thumb 25px off did nothing at all)
    // and introduced a worse one: a vertical page-scroll swipe that happens to start
    // within 22px of a dot was destroying the colour, because the adoption fired on
    // pointerdown regardless of where the finger then went. Measured: a 120px pure
    // vertical drag 12px from the dot drove lightness 61% → 100% with the page
    // frozen.
    //
    // So the FIRST movement decides. Mostly sideways: the guess was right, take the
    // gesture. Mostly vertical: the user is scrolling past the chart, so abandon the
    // adoption entirely and let the page have it. A DIRECT hit on the dot is exempt - 
    // pressing the dot itself is unambiguous, and dragging it up to change lightness
    // is the whole point of the control.
    if (adopted) {
      if (Math.abs(dy) >= Math.abs(dx)) {
        dragIdx = -1; adopted = false; moved = true;
        // Give the page the travel it already spent deciding, then carry the rest - 
        // but only where the browser has been shut out (see `panFor`). Where it has
        // not, it is already panning and doing this too would scroll twice.
        if (panBlocked) { panFor()?.by(startY - e.clientY); panY = e.clientY; }
        return;
      }
      adopted = false;
      plot.setPointerCapture(e.pointerId);
    }
    moved = true;
    if (dragIdx < 0) return; // a drag across empty space isn't a recolour
    h.onRecolor(dragIdx, colorAt(e, dragIdx));
  };
  const onUp = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    if (plot.hasPointerCapture(e.pointerId)) plot.releasePointerCapture(e.pointerId);
    pointerId = -1;
    const wasAdopted = adopted;
    adopted = false; panBlocked = false; panY = -1;
    if (moved) { if (dragIdx >= 0) h.onCommit(dragIdx); }
    // An adoption that never travelled is a TAP near a dot - pick it, which is what
    // the slop is for. One that was abandoned by the axis lock has already cleared
    // dragIdx and set moved, so it lands in neither branch and nothing happens,
    // which is correct: the page scrolled, the user did not ask for a colour.
    else if (dragIdx >= 0) h.onPick(dragIdx);
    else if (!wasAdopted) h.onAdd(colorAt(e));
    dragIdx = -1;
  };
  /**
   * The gesture was taken away from us - on a phone that means the page started
   * scrolling under the press, which the plot now allows (`touch-action: pan-y`).
   *
   * NOT the same as a release: a cancelled press must never be read as a click,
   * or a vertical swipe over the chart would set the colour it happened to start
   * on. A recolour already in flight is committed, because those frames have
   * already changed the colour and abandoning them would leave the report showing
   * a value nothing recorded.
   */
  const onCancel = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return;
    if (plot.hasPointerCapture(e.pointerId)) plot.releasePointerCapture(e.pointerId);
    pointerId = -1;
    if (moved && dragIdx >= 0) h.onCommit(dragIdx);
    dragIdx = -1;
    adopted = false; panBlocked = false; panY = -1;
  };

  plot.addEventListener('pointerdown', onDown);
  plot.addEventListener('pointermove', onMove);
  plot.addEventListener('pointerup', onUp);
  plot.addEventListener('pointercancel', onCancel);
  return () => {
    plot.removeEventListener('pointerdown', onDown);
    plot.removeEventListener('pointermove', onMove);
    plot.removeEventListener('pointerup', onUp);
    plot.removeEventListener('pointercancel', onCancel);
  };
}
