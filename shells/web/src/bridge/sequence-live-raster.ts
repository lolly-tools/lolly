// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-live-raster.ts - the per-frame re-photograph of a sequence layer whose picture
 * changes while it plays: a Lottie player, a 3D scene, an animated SVG, a size tween, split
 * text, a posed slide and (plans/328) a keyed appearance. Moved out of sequence-render.ts,
 * which keeps the plates and the frame loop; the two functions this module would otherwise
 * import back from there (the dom-to-image shot and the Lottie player lookup) arrive in
 * `LiveRasterDeps`, so the import graph stays one-directional.
 */
import { designSceneTime } from '../../../../engine/src/design-scene.ts';
import type { KfPose } from '@lolly/engine';
import { applySplitAt } from './sequence-dom.ts';
import { sequenceDrawPlan, type SeqLayer, type SeqPlanEnv } from './sequence-plan.ts';
import { applyLook, clearLook, lookKey } from './sequence-look.ts';
import type { RasterOpts } from './sequence-render.ts';
import type { SeqJobIO } from './sequence-render.worker.ts';

/** One layer the live raster re-shoots. */
export interface LiveBox { marker: Element | null; box: HTMLElement; hide: Element[] }

/** Everything `makeLiveRaster` reads, by name. */
export interface LiveRasterDeps {
  boxes: Map<number, LiveBox>;
  scaleOf(idx: number): number;
  padOf(idx: number): number;
  neutralOf(idx: number): boolean;
  clipNeutralOf(idx: number): boolean;
  /** The layer's DRAW size at that output frame, or null when it keyframes no size. */
  sizeAt(idx: number, frameIndex: number, timeMs?: number): { w: number; h: number } | null;
  /** The layer's keyed appearance at that frame (plans/328), or null when it keys none. */
  lookAt?(idx: number, frameIndex: number, timeMs?: number): KfPose | null;
  /** Split-text state at that frame (plans/175), or null when the layer splits nothing. */
  splitAt?(idx: number, frameIndex: number, timeMs?: number): { t: number; animating: boolean } | null;
  /** The sequence's total ms - applySplitAt's open-ended-box authority. */
  seqMs?: number;
  /** A posed slide at that frame (plans/184 R1): drives its boxes and lists the hidden ones. */
  slideAt?(idx: number, frameIndex: number, timeMs?: number): { t: number; animating: boolean; restKey: number; hide: Element[] } | null;
  wideColor?: boolean;
  preciseTime?: boolean;
  release?: (() => void)[];
  /** sequence-render's `rasterBox`: the one dom-to-image shot every plate is taken with. */
  raster(el: HTMLElement, S: number, hide: Element[], opts: RasterOpts): Promise<HTMLCanvasElement | null>;
  /** The mounted lottie-web player for a marker, if any. */
  playerFor(marker: Element): unknown;
}

/**
 * The DRAW size and the keyed look (plans/328) of a re-shot layer at one output frame.
 * Answered by re-running the SAME planner the executor runs, over the same layers,
 * grid, totalMs and env - never by a second evaluation of the track - so the plate is
 * shot at exactly the size and paint the draw will place it with. Memoised per frame
 * because a frame typically asks for one or two layers and the executor walks the grid
 * in order. `reshot` is the set of layers that size-tween or restyle.
 */
export function framePlanLookup(
  layers: SeqLayer[], totalMs: number, env: SeqPlanEnv, grid: number[], reshot: ReadonlySet<number>,
): Pick<LiveRasterDeps, 'sizeAt'> & Required<Pick<LiveRasterDeps, 'lookAt'>> {
  let cache: { t: number | undefined; sizes: Map<number, { w: number; h: number }>; looks: Map<number, KfPose> } | null = null;
  const at = (t: number | undefined): NonNullable<typeof cache> => {
    if (cache && cache.t === t) return cache;
    const sizes = new Map<number, { w: number; h: number }>();
    const looks = new Map<number, KfPose>();
    if (t != null) {
      for (const it of sequenceDrawPlan(layers, t, totalMs, env)) {
        if (it.sized) sizes.set(it.layer.idx, { w: it.w, h: it.h });
        if (it.look) looks.set(it.layer.idx, it.look);
      }
    }
    cache = { t, sizes, looks };
    return cache;
  };
  return {
    sizeAt: (idx, frameIndex, timeMs = grid[frameIndex]) => (reshot.has(idx) ? at(timeMs).sizes.get(idx) ?? null : null),
    lookAt: (idx, frameIndex, timeMs = grid[frameIndex]) => (reshot.has(idx) ? at(timeMs).looks.get(idx) ?? null : null),
  };
}

/** A keyed look as a memo number: FNV-1a over its stable key. */
function lookHash(look: KfPose): number {
  let h = 0x811c9dc5;
  const s = lookKey(look);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// ── the live raster, the one thing the worker cannot do ────────────────────

/**
 * The capture frame one plate shot asks dom-to-image for: canvas size in device px,
 * and the clone transform that places the box inside that canvas.
 *
 * Pure, exported and tested for one reason - `pad` (plans/104 section 5.5) changes the shot's
 * geometry, and "a document that uses no depth exports the same bytes it always did"
 * has to be a pinned property rather than a reading of the diff. At pad 0 both numbers
 * and the transform string are what they have always been.
 *
 * The translate sits INSIDE the scale so the pad stays in ELEMENT px: `scale(S)
 * translate(p,p)` maps a point x to S·(x + p), i.e. the box sits `p·S` device px in
 * from the top-left corner and the plate's origin is `(-p, -p)` in box space.
 */
export function plateShotFrame(
  bw: number, bh: number, S: number, pad = 0,
): { width: number; height: number; transform: string } {
  // Non-finite / negative pads are simply no pad: this number can arrive from a
  // budget calculation over hostile attribute values, and a NaN here would size a
  // canvas to NaN and lose the whole plate.
  const p = Number.isFinite(pad) && pad > 0 ? pad : 0;
  return {
    width: Math.max(1, Math.round((bw + p * 2) * S)),
    height: Math.max(1, Math.round((bh + p * 2) * S)),
    transform: p ? `scale(${S}) translate(${p}px, ${p}px)` : `scale(${S})`,
  };
}


/** The slice of a lottie-web player the exporter scrubs. */
export interface LottieScrubber { goToAndStop?(v: number, isFrame?: boolean): void; frameRate?: number }

/** The box's own size in stage-native px, measured exactly as `rasterBox` measures a box. */
function boxNativeSize(el: HTMLElement, size: { w: number; h: number } | null): { w: number; h: number } {
  if (size && size.w > 0 && size.h > 0) return size;
  return {
    w: Math.max(1, parseFloat(el.style.width) || el.offsetWidth || 1),
    h: Math.max(1, parseFloat(el.style.height) || el.offsetHeight || 1),
  };
}

/**
 * One frame of a 3D scene box, as a plate (plan 265 milestone 3, decision Q19).
 *
 * A scene's picture does not come from the DOM at all: it is rendered through the studio
 * pool at this moment and handed back as an ImageBitmap. Decision Q19 makes that the ONE
 * path for every export - still, video, batch and pages - because the browser lends about
 * sixteen WebGL contexts and a document may hold twenty scenes, so nothing may depend on a
 * live canvas being mounted, let alone on being in the right state at the right frame.
 *
 * `pad` is the capture margin the layer's static plates were shot with (plans/104 section
 * 5.5). The compositor draws a plate with its origin at (-pad, -pad) in box space, so when
 * there is a margin the scene is drawn INSIDE one rather than stretched across it; with no
 * margin - which is every scene box carrying no blur or shadow - the bitmap goes straight
 * through and nothing is copied.
 *
 * The studio module is reached with an `await import()` so a sequence with no scene box
 * loads no three.js.
 */
async function sceneLivePlate(
  marker: Element,
  box: HTMLElement,
  size: { w: number; h: number } | null,
  sourceSec: number,
  S: number,
  pad: number,
): Promise<CanvasImageSource | null> {
  const { w, h } = boxNativeSize(box, size);
  const seconds = Number((marker as HTMLElement).dataset?.sceneSeconds);
  const frame = plateShotFrame(w, h, S, pad);
  const { designSceneFrame } = await import('./export-design-scenes.ts');
  return await designSceneFrame(marker, {
    width: Math.max(1, Math.round(w * S)),
    height: Math.max(1, Math.round(h * S)),
    time: designSceneTime(sourceSec * 1000, Number.isFinite(seconds) ? seconds : 0),
    // The margin is expressed as the finished plate's own size and the inset the scene sits
    // at inside it, measured HERE with `plateShotFrame` so a scene plate and a photographed
    // one can never disagree about how big a padded plate is.
    plate: pad > 0 ? { width: frame.width, height: frame.height, inset: Math.round(pad * S) } : null,
  });
}

/**
 * Build the per-frame live-raster function, or `undefined` when no layer needs one.
 *
 * Memoised on the animation's OWN frame number, so a 30 fps export of a 12 fps
 * Lottie rasterises 12 times a second, not 30. A single-entry memo per layer is
 * enough (the grid is monotonic, so repeats are always consecutive) and keeps
 * the cache O(1) instead of growing with the clip. That memo is also what makes
 * the worker's per-frame request cheap: most frames are answered from it without
 * touching lottie-web or dom-to-image at all.
 */
export function makeLiveRaster(deps: LiveRasterDeps): SeqJobIO['lottieAt'] {
  const {
    boxes, scaleOf, padOf, neutralOf, clipNeutralOf, sizeAt, lookAt, splitAt, slideAt, raster, playerFor,
  } = deps;
  const seqMs = deps.seqMs ?? 0;
  const wideColor = deps.wideColor ?? false;
  const preciseTime = deps.preciseTime ?? false;
  const release = deps.release ?? [];
  if (!boxes.size) return undefined;
  // Keyed by layer AND slot: a video layer's two plates are two different pictures of
  // the same box (opaque with the media hidden, then transparent), so one memo slot per
  // layer would answer the `over` request with the `under` shot.
  const memo = new Map<string, { key: number; shot: CanvasImageSource }>();
  release.push(() => { for (const value of memo.values()) if (value.shot instanceof ImageBitmap) value.shot.close(); memo.clear(); });
  return async (layerIdx, frameIndex, sourceSec, slot = 'under', timeMs) => {
    const entry = boxes.get(layerIdx);
    if (!entry) return null;
    const memoKey = `${layerIdx}:${slot}`;
    const size = sizeAt(layerIdx, frameIndex, timeMs);
    const look = lookAt?.(layerIdx, frameIndex, timeMs) ?? null;
    let key: number;
    let slideHide: Element[] = [];
    // A 3D scene box is answered first and by a different route: its picture is rendered,
    // not photographed, so none of the DOM handling below applies to a scene. The memo key is
    // the moment (to the millisecond) and the size, which is the whole of what changes it -
    // the recipe cannot move during a render, and each layer already has its own slot.
    const scene = entry.box.matches?.('[data-lolly-scene]')
      ? entry.box
      : entry.box.querySelector?.('[data-lolly-scene]');
    if (scene) {
      const { w, h } = boxNativeSize(entry.box, size);
      key = (preciseTime ? sourceSec * 1000 : Math.round(sourceSec * 1000)) * 65537 + Math.round(w * 100) + Math.round(h * 100) * 4093;
      const held = memo.get(memoKey);
      if (held && held.key === key) return held.shot;
      const drawn = await sceneLivePlate(scene, entry.box, size, sourceSec, scaleOf(layerIdx), padOf(layerIdx));
      if (!drawn) return held?.shot ?? null;
      if (held?.shot instanceof ImageBitmap) held.shot.close();
      memo.set(memoKey, { key, shot: drawn });
      return drawn;
    }
    if (entry.box.querySelector('[data-anim-src]')) {
      const { captureSvgTime } = await import('./sequence-svg-clock.ts');
      return await captureSvgTime(entry.box, sourceSec, () => raster(entry.box, scaleOf(layerIdx), entry.hide, { wideColor, opaque: true, neutralFilter: neutralOf(layerIdx), neutralClipPath: clipNeutralOf(layerIdx), pad: padOf(layerIdx), ...(size ? { size } : {}) }));
    }
    if (entry.marker) {
      const player = playerFor(entry.marker) as LottieScrubber | null;
      if (!player?.goToAndStop) return null;
      const rate = Number.isFinite(player.frameRate) && (player.frameRate as number) > 0 ? (player.frameRate as number) : 30;
      key = preciseTime ? sourceSec * rate : Math.round(sourceSec * rate);
      // A size tween moves the picture on EVERY frame even when the animation itself
      // does not, so the memo key has to carry the size too or a stretching Lottie
      // would be answered from a plate shot at the previous width.
      if (size) key = key * 4093 + Math.round(size.w * 100) + Math.round(size.h * 100) * 65537;
      if (look) key = key * 41 + lookHash(look);
      const prev = memo.get(memoKey);
      if (prev && prev.key === key) return prev.shot;
      try { player.goToAndStop((preciseTime ? sourceSec : Math.round(sourceSec * rate) / rate) * 1000, false); } catch { return prev?.shot ?? null; }
    } else {
      // Size-only: the frame index IS the key, quantised through the size so a track
      // that holds a value for a second is photographed once rather than thirty times.
      // A split-text layer (plans/175) joins the same memo: inside an animation window
      // every frame is its own key; at rest every frame collapses onto one.
      const split = splitAt?.(layerIdx, frameIndex, timeMs) ?? null;
      const slide = slideAt?.(layerIdx, frameIndex, timeMs) ?? null;
      if (!size && !split && !slide && !look) return null;
      key = size ? Math.round(size.w * 100) + Math.round(size.h * 100) * 65537 : 0;
      // A keyed appearance (plans/328) joins the same memo: a held colour is one shot.
      if (look) key = Math.imul(key, 41) + lookHash(look);
      if (split) key = Math.imul(key, 31) + (split.animating ? (preciseTime ? split.t : Math.round(split.t)) + 2 : 1);
      // A slide mid-transition is its own frame; at rest it is one shot per set of boxes
      // on screen (a timed box arriving changes the picture without animating anything).
      if (slide) key = Math.imul(key, 37) + (slide.animating ? (preciseTime ? slide.t : Math.round(slide.t)) * 2 + 1 : slide.restKey * 2);
      slideHide = slide?.hide ?? [];
      const prev = memo.get(memoKey);
      if (prev && prev.key === key) return prev.shot;
      // Drive the unit spans to this frame's state BEFORE the shot - the box's own
      // whole-box transition is suppressed by the planner, so this write is the whole
      // difference between frames inside the window.
      if (split) applySplitAt(entry.box, split.t, seqMs);
    }
    // The SAME shot the static plate for THIS SLOT takes - same hide list, same
    // filter/clip neutralisation, identically padded, at the identical scale, and
    // transparent for `over` exactly as the static pair is. A live plate is a drop-in
    // replacement for the static one on the frames it covers, so any difference in how
    // it is framed is a jump in the picture.
    const hide = slideHide.length ? [...entry.hide, ...slideHide] : entry.hide;
    // The frame's keyed paint goes on for the shot and comes straight off again: the
    // render runs with every preview writer stood down, so the box is authored before
    // and after, and the static plates never see a pose.
    if (look) applyLook(entry.box, look, size);
    const shot = await raster(entry.box, scaleOf(layerIdx), hide, {
      wideColor, opaque: true,
      neutralFilter: neutralOf(layerIdx),
      neutralClipPath: clipNeutralOf(layerIdx),
      pad: padOf(layerIdx),
      ...(slot === 'over' ? { transparentBg: true } : {}),
      ...(size ? { size } : {}),
    }).finally(() => { if (look) clearLook(entry.box); });
    const prev = memo.get(memoKey);
    if (shot) { memo.set(memoKey, { key, shot }); return shot; }
    return prev?.shot ?? null;
  };
}
