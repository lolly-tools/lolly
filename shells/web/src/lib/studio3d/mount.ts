// SPDX-License-Identifier: MPL-2.0
import { buildStudioScene, studioAnimated } from '../../../../../engine/src/studio3d.ts';
import {
  type StudioValues,
  studioActiveValues,
} from '../../../../../engine/src/studio3d-collection.ts';
import type { StudioSceneV1 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { STUDIO_CONTEXT_LOST, StudioEmptyFrameError } from './capture.ts';
import { studioFit } from './controls.ts';
import { wireStudioGestures } from './gestures.ts';
import { clearStudioControls, syncStudioControls } from './toolbar.ts';
import type { StageKitPort } from '../stage-kit.ts';
import type { StudioLease } from './pool.ts';
import { StudioRenderer } from './renderer.ts';
import type { StudioSceneCounters, StudioSceneQuality, StudioSceneState } from './scene-host.ts';
import type { StudioRead, StudioShaper } from './source.ts';
import { parseFontFamilies } from '../../bridge/font-registry.ts';
import type { TextAPI } from '../../../../../packages/core/src/host-v1/text.ts';

/** Brand roles the studio's font choice may name, each a CSS variable the shell keeps current. */
const FONT_ROLES: Record<string, string> = {
  sans: '--font-brand',
  display: '--font-display',
  mono: '--font-mono',
};

/**
 * A shaper over the host's text API: a brand role or family resolves to a font file the
 * host knows (brand statics, uploads, on-device Google fonts), then HarfBuzz outlines each
 * line. Null when the host cannot outline text at all.
 */
export function studioShaperFor(host: { text?: TextAPI }): StudioShaper | null {
  const text = host.text;
  if (!text?.fontUrl) return null;
  return async (line, font, fontSize, signal) => {
    const role = FONT_ROLES[font.font];
    const variable = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    // A brand without a display or mono face falls back to its main face, as the CSS does.
    const stack = role ? variable(role) || variable(FONT_ROLES.sans!) : font.font;
    const families = role ? parseFontFamilies(stack) : [font.font];
    let resolved: { url: string; variations?: string[] } | null = null;
    let tried = '';
    for (const family of families) {
      tried = family;
      resolved = await text.fontUrl!(family, { weight: font.weight });
      signal.throwIfAborted();
      if (resolved) break;
    }
    if (!resolved)
      throw new Error(
        `The font "${tried || font.font}" is not available on this device. Add it under Brand fonts, or choose another.`
      );
    const shaped = await text.toPath({
      text: line,
      fontUrl: resolved.url,
      fontSize,
      letterSpacing: font.tracking * fontSize,
      variations: resolved.variations,
    });
    signal.throwIfAborted();
    return { d: shaped.d, advance: shaped.advanceWidth || 0 };
  };
}

type FrameCanvas = HTMLCanvasElement & {
  __lollyFrameRender?: (
    t: number,
    seconds?: number,
    size?: { width: number; height: number }
  ) => void;
  __lollyFrameDriven?: boolean;
};
/** The capture's hard limits; a larger request renders at the cap and the capture scales the rest. */
const MAX_SIDE = 4096;
const MAX_PIXELS = 12_000_000;
const STUDIO_LOADING = 'Wait for the studio preview to finish loading.';
function boundedSize(width: number, height: number): { width: number; height: number } {
  let w = Math.max(1, Math.round(width)),
    h = Math.max(1, Math.round(height));
  const factor = Math.min(1, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_PIXELS / (w * h)));
  if (factor < 1) {
    w = Math.max(1, Math.floor(w * factor));
    h = Math.max(1, Math.floor(h * factor));
  }
  return { width: w, height: h };
}
export interface StudioMountOptions {
  read: StudioRead;
  isCurrent?: () => boolean;
  setInput?: (id: string, value: unknown) => void;
  /** Write several inputs as one undo step (the tool view's history); see controls.ts commit. */
  commitMany?: (values: Record<string, unknown>, label: string) => void;
  /**
   * The stage kit (lib/stage-kit.ts) the studio's controls are drawn in, beside the
   * picture. Only the tool view passes one: multi-edit, Design scene boxes, exports and
   * one-off renders draw no controls.
   */
  chrome?: StageKitPort | null;
  reviewCollection?: () => void;
  /** Open the library to add several sources at once to the arrangement or collection. */
  addObjects?: () => void;
  /** Outlines words in a brand font; without it a text source reports that it cannot. */
  shapeText?: StudioShaper | null;
  /** Quality of the frames the export clock asks for: a tile takes preview samples. */
  frameQuality?: 'preview' | 'export';
  endGesture?: () => void;
  /**
   * A renderer leased from the pool (pool.ts) for one off-screen render, instead of a
   * context of this mount's own. The lease owns the renderer: destroying the mount hands
   * the canvas back rather than closing it, and the caller releases the lease.
   */
  lease?: StudioLease;
}

/**
 * How long a raised capture flag may stand before the mount takes the studio back. Every
 * export path clears the flag in a finally block, so reaching this means an export died
 * between its two edges, and without it the studio would stay frozen for the session.
 * Shortened by tests.
 */
export const STUDIO_CAPTURE_BUDGET = { ms: 30_000 };
/** A mount that arrived during a capture, and every caller waiting for it. */
interface DeferredMount {
  options: StudioMountOptions;
  waiters: { resolve: () => void; reject: (error: unknown) => void }[];
}
interface Entry {
  container: Element;
  marker: HTMLElement;
  canvas: FrameCanvas;
  handle: StudioRenderer;
  options: StudioMountOptions;
  recipe: StudioSceneV1;
  inputCamera: Record<string, unknown>;
  inputValues: StudioValues;
  error: Error | null;
  ready: boolean;
  state: StudioSceneState;
  generation: number;
  frame: number;
  observer: ResizeObserver;
  /** True while an export drives the canvas (the canvas's __lollyFrameDriven flag). */
  capturing: boolean;
  /** Clears a capture flag its export never lowered. */
  captureTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the last capture render was for, named in the log when the flag is cleared. */
  captureKind: StudioSceneQuality;
  /** True when this mount borrowed its renderer and canvas from the pool. */
  pooled: boolean;
  /** The first error a capture render threw since the last prepare or mount. */
  captureError: Error | null;
  /** Check the next export or clip frame for a missing subject. */
  verifyNext: boolean;
  deferred: DeferredMount | null;
  deferTimer: ReturnType<typeof setTimeout> | undefined;
  closed: boolean;
  /** The source notes the Info panel shows. */
  notes?: string;
  /** Redraw the controls from the current state; set by toolbar.ts while a kit is attached. */
  refreshChrome?: () => void;
  /** Save a camera view a wheel or key run is still previewing; set by gestures.ts. */
  flushView?: () => void;
  /** Whether the selected object shows its handles; chrome state, never saved (controls.ts). */
  selected?: boolean;
  /** Place the selected object's handles on the frame just drawn; set by gestures.ts. */
  drawHandles?: () => void;
  /** Take the handles off the stage; set by gestures.ts. */
  clearHandles?: () => void;
  /**
   * Draw a frame. Only a capture render (`capture` true: the export clock or a prepare)
   * draws while a capture is running; any other call returns without drawing.
   */
  render(
    quality: StudioSceneQuality,
    time?: number,
    seconds?: number,
    size?: { width: number; height: number },
    capture?: boolean
  ): void;
}
const registry = new Map<Element, Entry>();
/**
 * The entry a canvas belongs to now. A pooled canvas outlives the mount that used it, so
 * the listeners on it are registered once and read the live entry here instead of holding
 * a mount that has already been destroyed.
 */
const owners = new WeakMap<HTMLCanvasElement, Entry>();
const watched = new WeakSet<HTMLCanvasElement>();

function status(entry: Entry, message: string, state: StudioSceneState): void {
  entry.state = state;
  entry.marker.dataset.studioState = state;
  const label = entry.marker.querySelector<HTMLElement>('[data-studio-status]');
  if (label) {
    label.textContent = message;
    label.hidden = state === 'ready' || state === 'cancelled';
  }
  // A scene that failed shows no handles on the frame it can no longer draw.
  if (state === 'error') entry.drawHandles?.();
}

function destroy(entry: Entry): void {
  const loading = !entry.ready && !entry.error;
  entry.closed = true;
  entry.generation++;
  clearStudioControls(entry);
  cancelAnimationFrame(entry.frame);
  clearTimeout(entry.deferTimer);
  clearTimeout(entry.captureTimer);
  entry.observer.disconnect();
  // A leased renderer goes back to the pool with its environment and backdrop; only a
  // mount that opened its own context closes one.
  if (!entry.pooled) entry.handle.dispose();
  if (owners.get(entry.canvas) === entry) owners.delete(entry.canvas);
  delete entry.canvas.__lollyFrameRender;
  // Back to a plain property: a late end of an export's clock writes to nothing that listens.
  delete entry.canvas.__lollyFrameDriven;
  entry.canvas.remove();
  registry.delete(entry.container);
  if (loading) status(entry, '', 'cancelled');
  const waiting = entry.deferred?.waiters ?? [];
  entry.deferred = null;
  for (const waiter of waiting) waiter.resolve();
}

/**
 * An export raised the capture flag. Any orbit, object drag or light move in progress is
 * put back (its preview is skipped, because the flag is already up), then the renderer
 * holds the frame: previews, gestures and updates cannot change it until the flag falls.
 */
function beginCapture(entry: Entry): void {
  entry.verifyNext = true;
  entry.canvas.dispatchEvent(new Event('studio-reset-gesture'));
  entry.handle.freeze(true);
  clearTimeout(entry.captureTimer);
  entry.captureTimer = setTimeout(() => expireCapture(entry), STUDIO_CAPTURE_BUDGET.ms);
}

function endCapture(entry: Entry): void {
  clearTimeout(entry.captureTimer);
  entry.handle.freeze(false);
  if (entry.deferred) runDeferred(entry);
}

/**
 * The export that raised the flag never lowered it. Take the studio back: log why, thaw it,
 * run whatever mount was waiting, and check the next capture's frame, because the export
 * that was abandoned may have left the scene part way through an edit.
 */
function expireCapture(entry: Entry): void {
  if (!entry.capturing || entry.closed) return;
  console.warn(
    `The studio capture flag cleared after ${Math.round(STUDIO_CAPTURE_BUDGET.ms / 1000)} s (${entry.captureKind} export). The export that raised it did not finish.`
  );
  entry.capturing = false;
  endCapture(entry);
  entry.verifyNext = true;
}

/** Keep the latest mount that arrived during a capture; every earlier caller settles with it. */
function deferMount(entry: Entry, options: StudioMountOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const waiters = entry.deferred?.waiters ?? [];
    waiters.push({ resolve, reject });
    entry.deferred = { options, waiters };
  });
}

/**
 * Run the deferred mount once the export that raised the flag has finished its own steps.
 * If another capture has begun by then, the mount waits for that one to end.
 */
function runDeferred(entry: Entry): void {
  clearTimeout(entry.deferTimer);
  entry.deferTimer = setTimeout(() => {
    const deferred = entry.deferred;
    if (!deferred || entry.capturing || entry.closed) return;
    entry.deferred = null;
    mountToolStudio(entry.container, deferred.options).then(
      () => {
        for (const waiter of deferred.waiters) waiter.resolve();
      },
      (error: unknown) => {
        for (const waiter of deferred.waiters) waiter.reject(error);
      }
    );
  }, 0);
}

/** Re-adopt one canvas across tool paints; a stale load cannot publish over a newer edit. */
export async function mountToolStudio(
  container: Element,
  options: StudioMountOptions
): Promise<void> {
  for (const entry of registry.values()) if (!entry.container.isConnected) destroy(entry);
  let entry = registry.get(container);
  // A capture keeps the scene it started with; this mount runs when the capture ends.
  if (entry?.capturing) return deferMount(entry, options);
  const marker = container.querySelector<HTMLElement>('[data-lolly-studio]');
  if (!marker) {
    if (entry) destroy(entry);
    return;
  }
  let recipe: StudioSceneV1;
  let raw: { values?: Record<string, unknown> };
  try {
    raw = JSON.parse(marker.dataset.lollyStudio || '{}') as typeof raw;
    recipe = buildStudioScene(raw);
  } catch (error) {
    if (entry) {
      entry.ready = false;
      entry.error = error instanceof Error ? error : new Error(String(error));
      entry.state = 'error';
    }
    marker.dataset.studioState = 'error';
    const label = marker.querySelector('[data-studio-status]');
    if (label) label.textContent = (error as Error).message;
    throw error;
  }
  if (!entry) {
    const lease = options.lease;
    const canvas = (lease?.canvas ?? document.createElement('canvas')) as FrameCanvas;
    canvas.className = 'lolly-studio-canvas';
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
    let handle: StudioRenderer;
    try {
      handle = lease?.renderer ?? new StudioRenderer(canvas);
    } catch (error) {
      const label = marker.querySelector('[data-studio-status]');
      if (label) label.textContent = `Studio unavailable: ${(error as Error).message}`;
      marker.dataset.studioState = 'error';
      throw error;
    }
    const current: Entry = {
      container,
      marker,
      canvas,
      handle,
      options,
      recipe,
      inputCamera: {},
      inputValues: {},
      error: null,
      ready: false,
      state: 'loading',
      generation: 0,
      frame: 0,
      capturing: false,
      captureTimer: undefined,
      captureKind: 'export',
      pooled: !!lease,
      captureError: null,
      verifyNext: false,
      deferred: null,
      deferTimer: undefined,
      closed: false,
      observer: new ResizeObserver(() => {
        if (current.ready && !canvas.__lollyFrameDriven) {
          try {
            current.render('preview');
          } catch {
            /* The preview shows the failure. */
          }
        }
      }),
      render: (quality, time = 0, seconds, size, capture = false) => {
        // A capture owns the canvas: previews from gestures, resizes and edits wait for it.
        if (!capture && current.capturing) return;
        // A capture that cannot draw is recorded, so the export that asked for it fails.
        if (capture && !current.ready) current.captureError ??= current.error ?? new Error(STUDIO_LOADING);
        if (current.error) throw current.error;
        if (!current.ready) throw new Error(STUDIO_LOADING);
        const bounds = current.marker.getBoundingClientRect();
        const max = Math.max(bounds.width, bounds.height),
          scale = quality === 'preview' ? Math.min(1, 800 / Math.max(1, max)) : 1;
        // An export names its pixel size; the frame is resampled at that size (within
        // the capture limits) so a larger output is not an enlarged preview.
        const target =
          quality !== 'preview' && size && size.width > 0 && size.height > 0
            ? boundedSize(size.width, size.height)
            : {
                width: Math.max(1, Math.round(bounds.width * scale)),
                height: Math.max(1, Math.round(bounds.height * scale)),
              };
        if (capture) current.captureKind = quality;
        try {
          if (capture && quality !== 'preview') {
            const verify = current.verifyNext;
            current.verifyNext = false;
            handle.capture(target.width, target.height, quality, time, seconds, verify);
          } else {
            handle.render(target.width, target.height, quality, time, seconds);
            // The handles over the preview move in the same task as the frame they sit on.
            if (!capture && quality === 'preview') current.drawHandles?.();
          }
        } catch (error) {
          const failure = error instanceof Error ? error : new Error(String(error));
          if (capture) current.captureError ??= failure;
          // An empty frame fails this capture only: the studio stays ready, so exporting
          // again draws and checks the frame again.
          if (failure instanceof StudioEmptyFrameError) throw failure;
          current.error = failure;
          current.ready = false;
          status(current, failure.message, 'error');
          throw failure;
        }
      },
    };
    // export.ts and the test harness assign the capture flag as a plain property; an
    // accessor lets the mount act on both edges.
    Object.defineProperty(canvas, '__lollyFrameDriven', {
      configurable: true,
      enumerable: true,
      get: () => current.capturing,
      set: (value: unknown) => {
        const next = Boolean(value);
        if (next === current.capturing || current.closed) return;
        current.capturing = next;
        if (next) beginCapture(current);
        else endCapture(current);
      },
    });
    // Registered once per canvas, because a pooled canvas is mounted again and again.
    if (!watched.has(canvas)) {
      watched.add(canvas);
      canvas.addEventListener('webglcontextlost', () => {
        const owner = owners.get(canvas);
        if (!owner || owner.closed) return;
        owner.error = new Error(STUDIO_CONTEXT_LOST);
        owner.ready = false;
        status(owner, owner.error.message, 'error');
      });
    }
    owners.set(canvas, current);
    entry = current;
    registry.set(container, entry);
    // Gestures are wired for a mount that owns its canvas. A pooled canvas is reused by
    // the next off-screen render, which nobody points at, and a listener per mount on a
    // canvas that outlives them all would pile up.
    if (!lease) wireStudioGestures(entry);
    // The export clock names a clip length only for video and GIF frames; those take the
    // clip sample count, a still keeps the full export count, and a tile stays a preview.
    canvas.__lollyFrameRender = (t, seconds, size) =>
      current.render(
        current.options.frameQuality === 'preview' ? 'preview' : seconds !== undefined ? 'clip' : 'export',
        t,
        seconds,
        size,
        true
      );
    let last = 0;
    // Only an interactive mount plays motion: a template preview, a batch stage or a
    // contact sheet renders its first frame once, otherwise every preview of an
    // animated scene would run a full WebGL loop and starve the page.
    const tick = (now: number) => {
      if (!container.isConnected) {
        destroy(current);
        return;
      }
      if (
        current.ready &&
        !canvas.__lollyFrameDriven &&
        current.options.setInput !== undefined &&
        (studioAnimated(current.recipe) || current.handle.playsClip) &&
        now - last > 50
      ) {
        last = now;
        try {
          current.render(
            'preview',
            ((now / 1000) % current.recipe.motion.seconds) / current.recipe.motion.seconds
          );
        } catch {
          /* status carries the failure */
        }
      }
      current.frame = requestAnimationFrame(tick);
    };
    entry.frame = requestAnimationFrame(tick);
  }
  entry.observer.disconnect();
  entry.marker = marker;
  entry.options = options;
  entry.recipe = recipe;
  // Another source is another subject: a selection made on the old one does not carry over.
  if (entry.selected && (raw.values?.source ?? '') !== (entry.inputValues.source ?? '')) entry.selected = false;
  entry.inputValues = raw.values || {};
  entry.inputCamera = {
    azimuth: recipe.camera.azimuth,
    elevation: recipe.camera.elevation,
    fov: recipe.camera.fov,
    zoom: recipe.camera.zoom,
    ...(studioActiveValues(entry.inputValues).camera as StudioValues),
  };
  const generation = ++entry.generation;
  marker.appendChild(entry.canvas);
  entry.observer.observe(marker);
  entry.ready = false;
  syncStudioControls(entry);
  entry.error = null;
  entry.captureError = null;
  status(entry, 'Preparing the studio...', 'loading');
  try {
    const info = await entry.handle.update(recipe, options.read, options.shapeText ?? undefined, {
      pixels: previewPixels(entry),
    });
    if (generation !== entry.generation || options.isCurrent?.() === false) return;
    entry.ready = true;
    // The tool's hook writes a clip length when a loop, a light or the camera moves. Whether
    // a model file holds a baked clip is only known here, once the file has loaded, so a
    // model that plays one states the length the same way and the export sheet's Duration
    // follows.
    if (entry.handle.playsClip && !(Number(marker.dataset.clipMs) > 0))
      marker.dataset.clipMs = String(Math.round(recipe.motion.seconds * 1000));
    syncStudioControls(entry);
    entry.render('preview');
    status(entry, '', 'ready');
    // The source notes: shown by the Info control in the stage kit, and kept on the
    // marker for scripts and tests that read what the scene loaded.
    const prefix = recipe.objects
      ? `${recipe.objects.filter((object) => object.visible && !object.pending).length} of ${recipe.objects.length} objects visible, ${Math.round(info.triangles).toLocaleString()} triangles. Selected object slots: `
      : '';
    entry.notes = `${prefix}${info.slots.map((slot, i) => `${i + 1}: ${slot.id}`).join(' / ')}${info.warnings.length ? '\n' + info.warnings.join('\n') : ''}`;
    marker.dataset.studioNotes = entry.notes;
    entry.refreshChrome?.();
  } catch (error) {
    if (generation !== entry.generation || options.isCurrent?.() === false) return;
    entry.ready = false;
    entry.error = error instanceof Error ? error : new Error(String(error));
    status(entry, entry.error.message, 'error');
    throw entry.error;
  }
}

/**
 * The long side the preview is drawn at, which is what a source whose curve detail follows
 * the output is built for while the studio is on screen. A preview is capped at 800 px by
 * `render`, so this is the same number a source with no target would have chosen.
 */
function previewPixels(entry: Entry): number {
  const bounds = entry.marker.getBoundingClientRect();
  const longest = Math.max(bounds.width, bounds.height);
  // A marker that is not laid out yet measures zero, and a mesh built for zero pixels is
  // a polygon. The floor is the smallest output the preview is ever asked for.
  return Math.max(256, Math.round(Math.min(longest, 800)));
}

/**
 * Build the sources again for an export that is larger than the preview, when the recipe
 * asks for curve detail that follows the output. It returns false when there is nothing to
 * do, which is every recipe with a fixed curve count. Call it before the export runs:
 * `prepareToolStudio` and the export clock both draw, and neither can wait for a read.
 */
export async function prepareStudioDetail(
  container: Element,
  size?: { width: number; height: number }
): Promise<boolean> {
  const entry = registry.get(container);
  if (entry?.recipe.shape.detail !== 'auto' || !entry.ready) return false;
  const target = size
    ? Math.max(1, Math.round(Math.max(size.width, size.height)))
    : previewPixels(entry);
  if (target <= entry.handle.detailPixels) return false;
  await entry.handle.update(entry.recipe, entry.options.read, entry.options.shapeText ?? undefined, {
    pixels: target,
  });
  // The frame is drawn by whoever exports next: prepareToolStudio, or the export clock.
  return true;
}

/** Draw the frame an export captures, checking once that the subject is not missing. */
export function prepareToolStudio(container: Element, quality: 'preview' | 'export' = 'export'): void {
  if (!container.querySelector('[data-lolly-studio]')) return;
  const entry = registry.get(container);
  if (!entry) throw new Error('The studio renderer is unavailable.');
  entry.captureError = null;
  entry.verifyNext = true;
  entry.render(quality, 0, undefined, undefined, true);
}

/**
 * Why the last capture of this container's studio cannot be trusted, or null. The export
 * clock only logs a failed frame, so an export asks here once its frames are taken.
 */
export function studioCaptureError(container: Element): Error | null {
  if (!container.querySelector('[data-lolly-studio]')) return null;
  const entry = registry.get(container);
  if (!entry) return new Error('The studio renderer is unavailable.');
  return entry.captureError ?? entry.error;
}

/** The lifecycle state and renderer counters of this container's studio, or null. */
export function inspectToolStudio(
  container: Element
): { state: StudioSceneState; counters: StudioSceneCounters } | null {
  const entry = registry.get(container);
  return entry ? { state: entry.state, counters: entry.handle.inspect() } : null;
}

/** Frame every object once the studio is ready, as the Frame all button would (one undo step). */
export function frameToolStudio(container: Element, timeoutMs = 15_000): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const entry = registry.get(container);
      if (!entry || !container.isConnected || Date.now() - started > timeoutMs) return resolve(false);
      if (entry.ready && !entry.error && entry.options.setInput) return resolve(studioFit(entry));
      setTimeout(tick, 120);
    };
    tick();
  });
}

export function destroyToolStudio(container?: Element): void {
  for (const entry of registry.values())
    if (!container || entry.container === container) destroy(entry);
}

/** Draw the mounted preview into a canvas fitted inside the tile, without
 *  preparing a second export scene or shader set. The preview writer encodes the canvas. */
export function captureStudioCanvas(root: HTMLElement, maxWidth = 720, maxHeight = 560): HTMLCanvasElement | null {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.lolly-studio-canvas');
  const entry = canvas && owners.get(canvas);
  if (!canvas || !entry?.ready || entry.capturing || entry.closed) return null;
  entry.render('preview');
  const scale = Math.min(1, maxWidth / canvas.width, maxHeight / canvas.height);
  const output = root.ownerDocument.createElement('canvas');
  output.width = Math.max(1, Math.round(canvas.width * scale));
  output.height = Math.max(1, Math.round(canvas.height * scale));
  const context = output.getContext('2d');
  if (!context) return null;
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

/** The same picture as a PNG data URL (the catalog preview build's capture). */
export function captureStudioThumbnail(root: HTMLElement, maxWidth = 720, maxHeight = 560): string | null {
  return captureStudioCanvas(root, maxWidth, maxHeight)?.toDataURL('image/png') ?? null;
}
