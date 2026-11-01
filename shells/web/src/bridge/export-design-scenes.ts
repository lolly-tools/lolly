// SPDX-License-Identifier: MPL-2.0
/**
 * 3D scene boxes inside an export (plan 265 milestone 3, lane C, decision Q19).
 *
 * A Design document can hold any number of `kind: '3d'` boxes, and a browser lends about
 * sixteen WebGL contexts in total, so an export can never be "photograph whatever the live
 * renderers happen to show". Every scene in every export is drawn through the studio pool
 * instead, at the size the output actually needs, and the result is what the export reads:
 *
 *   a STILL (png, svg, pdf, and the rest)   `prepareDesignScenePosters` swaps an
 *       export-quality picture into each marker before the stage shot, so the DOM walker
 *       reads an `<img>` at the box's own pixel size rather than a screen-sized poster or
 *       a live canvas that happens to be mid-frame.
 *   a MOTION format through the compositor  `designSceneFrame` answers the worker's
 *       per-frame `need-live` request with one ImageBitmap of that scene at that moment.
 *
 * Both go through lib/design-scene-mount.ts, which holds the decoded values for each box
 * and serialises the pool. That module and everything under lib/studio3d/ are reached with
 * an `await import()` gated on a marker being present, so a tool with no scene box loads
 * no three.js (shells/web/src/studio3d-boot-guard.test.ts pins it).
 */
import { toPixels } from '@lolly/engine';
import { exportDims, type ExportOpts } from './export-shared.ts';
import { RASTER_DEFAULT_SCALE } from './export-scale.ts';

/**
 * Formats that do NOT get a still poster prepared, for one of two reasons.
 *
 * The five motion formats plus the animated SVG carry a timeline of their own: the
 * sequence compositor asks for each scene per frame through `designSceneFrame` instead, and
 * preparing a frozen poster first would be a wasted render of the moment nobody sees.
 *
 * The data formats carry no picture at all (the engine has already hydrated their payload),
 * so a scene render for them would cost a GPU frame to produce nothing. Everything else -
 * every raster, every vector, the document and archive writers - photographs the DOM and
 * gets its posters.
 */
const NO_POSTER_FORMATS: ReadonlySet<string> = new Set([
  'webm', 'mp4', 'gif', 'apng', 'webp-anim', 'svg-anim',
  'md', 'txt', 'json', 'csv', 'ics', 'vcf', 'srt', 'vtt', 'ttml', 'scc', 'css', 'scss', 'gpl',
]);

/**
 * The long side a scene may be drawn at for an export, in pixels.
 *
 * The same ceiling bridge/plate-budget.ts applies to a plate on a device under 8 GB: past
 * it a browser refuses the canvas outright, and a refused render would fail an export that
 * a slightly smaller picture would have completed. A 4,096 px scene inside a document is
 * already far past what any paper size asks for at 300 DPI.
 */
export const DESIGN_SCENE_EXPORT_MAX = 4096;

/** The marker a live renderer's own canvas sits in, and what it looked like before. */
interface SwappedScene {
  canvas: HTMLElement | null;
  canvasDisplay: string;
  poster: HTMLElement | null;
  posterHidden: boolean;
}

/**
 * How many output pixels one CSS pixel of `node` becomes.
 *
 * The same arithmetic `rasterStyle` does in bridge/export.ts: a requested size converts
 * through the export DPI and divides by the node's own box; with nothing requested the
 * raster path doubles. Vector formats are given that same doubling rather than 1, because
 * what they embed is a raster either way and a scene drawn at CSS size prints soft.
 */
function exportScaleOf(node: Element, opts: ExportOpts): number {
  const dims = exportDims(node, opts);
  const requested = (opts.width != null && opts.width !== '') || (opts.height != null && opts.height !== '');
  if (requested && dims.node.w > 0) {
    const target = toPixels(dims.w, dims.dpi);
    if (Number.isFinite(target) && target > 0) return target / dims.node.w;
  }
  const scale = opts.scale ?? RASTER_DEFAULT_SCALE;
  return Number.isFinite(scale) && scale > 0 ? scale : RASTER_DEFAULT_SCALE;
}

/** One scene box's output size: its laid-out box times the export scale, held to the cap. */
function sceneSize(marker: HTMLElement, scale: number): { width: number; height: number } | null {
  let width = marker.clientWidth;
  let height = marker.clientHeight;
  if (width < 1 || height < 1) {
    const box = marker.getBoundingClientRect();
    width = box.width;
    height = box.height;
  }
  if (!(width > 0) || !(height > 0)) return null;
  width *= scale;
  height *= scale;
  const factor = Math.min(1, DESIGN_SCENE_EXPORT_MAX / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

/**
 * The moment this box is showing, as a position in the recipe's own clip length.
 *
 * `data-scene-t` is written by the playhead (views/sequence-clock.ts) whenever it drives a
 * live scene, so a still export taken with the timeline parked at four seconds embeds the
 * frame the editor is showing. A box the playhead never touched carries none, and 0 is
 * both the scene at rest and the picture its poster already holds.
 */
function sceneTimeOf(marker: HTMLElement): number {
  const t = Number(marker.dataset.sceneT);
  return Number.isFinite(t) ? t : 0;
}

/** Every scene marker under `node`, plus `node` itself when the export target IS one. */
function markersIn(node: Element): HTMLElement[] {
  const found = [...(node.querySelectorAll?.<HTMLElement>('[data-lolly-scene]') ?? [])];
  if (node instanceof HTMLElement && node.matches?.('[data-lolly-scene]')) found.unshift(node);
  return found;
}

/**
 * Take the live renderer out of the picture for the duration of a shot.
 *
 * The one selected box holds a real canvas, drawn at screen size and at whatever moment the
 * playhead last asked for. The export wants the pooled picture instead, at the output's own
 * size, so the canvas is hidden and the poster raised for the shot and both are put back
 * afterwards. A box that is already a poster needs none of this.
 */
function swapForShot(marker: HTMLElement): SwappedScene {
  const canvas = marker.querySelector<HTMLElement>('canvas');
  const poster = marker.querySelector<HTMLElement>('img.lolly-scene-poster');
  const swap: SwappedScene = {
    canvas,
    canvasDisplay: canvas?.style.display ?? '',
    poster,
    posterHidden: poster instanceof HTMLImageElement ? poster.hidden : false,
  };
  if (canvas) canvas.style.display = 'none';
  return swap;
}

function undoSwap(swap: SwappedScene): void {
  if (swap.canvas) {
    if (swap.canvasDisplay) swap.canvas.style.display = swap.canvasDisplay;
    else swap.canvas.style.removeProperty('display');
  }
  // Only a box that WAS live puts its poster back out of sight: the renderer is the picture
  // there, and leaving the export poster on top of it would hide the next scrub. A poster
  // box keeps the sharper picture it was just given, which is the same scene at the same
  // moment, and lane B redraws it at screen size the next time the box changes size.
  if (swap.canvas && swap.poster instanceof HTMLImageElement) swap.poster.hidden = swap.posterHidden;
}

/**
 * Give every 3D scene box under `node` an export-quality picture, then let the caller take
 * its editor-only chrome out of the tree, and hand back ONE teardown for both.
 *
 * `detach` is the caller's own pull-the-chrome-out step (bridge/export.ts's
 * `detachExportHidden`). It is threaded through rather than called before this, for two
 * reasons: the export funnel keeps exactly one restore handle on this path, and the poster
 * swap below writes into parts of the marker that ARE export-hidden chrome (the calm fill
 * while a box has no picture), so it has to run while those parts are still in the tree or
 * a fresh one is built behind the detach and photographed.
 *
 * A scene that refuses to render fails the export with the studio's own message, before
 * anything has been detached. That is the deliberate answer for a still (plan 265 milestone
 * 3, C6): a document quietly exported with an empty box where a scene should be is worse
 * than an export that did not happen.
 */
export async function prepareDesignScenePosters(
  node: Element,
  format: string,
  opts: ExportOpts,
  detach: (target: Element) => () => void,
): Promise<() => void> {
  const markers = NO_POSTER_FORMATS.has(format) ? [] : markersIn(node);
  if (!markers.length) return detach(node);
  const scenes = await import('../lib/design-scene-mount.ts');
  // Whatever the canvas has in flight (a first poster, a renderer starting) finishes before
  // the export reads the DOM, so no box is photographed mid-swap.
  await scenes.designScenesSettled();
  const scale = exportScaleOf(node, opts);
  const swaps: SwappedScene[] = [];
  const undo = (): void => {
    for (const swap of swaps) undoSwap(swap);
  };
  try {
    for (const marker of markers) {
      // A marker no enhancer has read holds no scene to draw: it belongs to a canvas this
      // build never mounted, and the box is photographed exactly as the tool painted it.
      if (!scenes.designSceneFor(marker)) continue;
      const size = sceneSize(marker, scale);
      if (!size) continue;
      swaps.push(swapForShot(marker));
      await scenes.prepareDesignScenePoster(marker, {
        width: size.width,
        height: size.height,
        time: sceneTimeOf(marker),
        // A gallery or chooser tile is a small picture, and milestone 2 already answers one
        // at preview quality: a scene with many samples must not hold the page for seconds
        // per tile. A real export keeps full quality.
        quality: opts.thumbnail ? 'preview' : 'export',
      });
    }
  } catch (error) {
    undo();
    throw error instanceof Error ? error : new Error(String(error));
  }
  const restore = detach(node);
  return () => {
    restore();
    undo();
  };
}

/** One frame of a scene box, as the sequence compositor asks for it. */
export interface DesignSceneFrameOpts {
  /** The box's own picture size in output pixels (its stage box times the export scale). */
  width: number;
  height: number;
  /** Normalised position in the recipe's clip length - what `designSceneTime` answers. */
  time: number;
  /**
   * The capture margin this layer's plates were shot with, or null when there is none.
   * `width`/`height` are the padded plate's own size and `inset` is the offset to draw the
   * picture at inside it, both measured by the caller with `plateShotFrame` so a scene's
   * plate and a photographed one are never a different size for the same box.
   */
  plate?: { width: number; height: number; inset: number } | null;
}

/**
 * One frame of one scene box, for the sequence compositor's per-frame request.
 *
 * Returns null when the scene could not be drawn, which is the compositor's own "use the
 * static plate" answer: a clip of the scene at rest is an honest fallback, and failing a
 * four-hundred-frame render on one refused frame is not. The reason is logged once per
 * frame that fails rather than swallowed.
 *
 * With a margin the picture is copied into a plate-sized canvas at the inset, because the
 * compositor draws every plate with its origin at (-pad, -pad) in box space and would
 * otherwise stretch an unpadded scene across the margin. With no margin - which is every
 * scene box carrying no blur and no shadow - the bitmap goes straight through.
 */
export async function designSceneFrame(
  marker: Element,
  opts: DesignSceneFrameOpts,
): Promise<CanvasImageSource | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    const scenes = await import('../lib/design-scene-mount.ts');
    if (!scenes.designSceneFor(marker)) return null;
    const width = Math.max(1, Math.round(opts.width));
    const height = Math.max(1, Math.round(opts.height));
    const poster = await scenes.renderDesignScenePoster(marker, {
      width,
      height,
      time: opts.time,
      quality: 'clip',
    });
    bitmap = await createImageBitmap(poster.blob);
    const plate = opts.plate;
    if (!plate) return bitmap;
    const canvas = document.createElement('canvas');
    canvas.width = plate.width;
    canvas.height = plate.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return bitmap;
    ctx.drawImage(bitmap, plate.inset, plate.inset, width, height);
    bitmap.close();
    return canvas;
  } catch (error) {
    bitmap?.close();
    console.warn('[design] a scene frame could not be drawn for this export:', error);
    return null;
  }
}
